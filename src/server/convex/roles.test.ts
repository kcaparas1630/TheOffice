/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { STARTER_ROLES } from "./roles";
import { internal } from "./_generated/api";
import { DEPARTMENTS } from "../../lib/orgSeed";

const modules = {
  ...import.meta.glob("./{agents,work,roles,skills,runs}.ts"),
  ...import.meta.glob("./_generated/**/*.js"),
};

const t = () => convexTest(schema, modules);

const person = {
  successfulDay: ["Answer every visitor", "Route requests to the right person"],
  traits: ["warm"],
  notes: "",
};

describe("roles", () => {
  test("a role is created once, then assigned; title and description copy onto the holder", async () => {
    const office = t();
    const { roleId } = await office.mutation(api.roles.create, {
      roleName: "Receptionist",
      roleDescription: "First point of contact for the office.",
      department: "Front desk",
    });
    await expect(
      office.mutation(api.roles.create, { roleName: "receptionist", roleDescription: "dup" })
    ).rejects.toThrow(/already exists/);

    await office.mutation(api.agents.hire, { ...person, name: "Pam", roleId });
    let pam = await office.query(api.agents.getByName, { name: "Pam" });
    expect(pam?.roleId).toBe(roleId);
    expect(pam?.jobTitle).toBe("Receptionist");
    expect(pam?.jobDescription).toBe("First point of contact for the office.");

    // Editing the role re-syncs everyone who holds it.
    await office.mutation(api.roles.update, { roleId, roleName: "Front Desk Lead", roleDescription: "Runs the front desk." });
    pam = await office.query(api.agents.getByName, { name: "Pam" });
    expect(pam?.jobTitle).toBe("Front Desk Lead");
    expect(pam?.jobDescription).toBe("Runs the front desk.");

    const list = await office.query(api.roles.list, {});
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ roleName: "Front Desk Lead", department: "Front desk", holders: ["Pam"] });
    expect(typeof list[0].createdAt).toBe("number");
  });

  test("hiring needs a role or a free-text title; reassigning switches the copy", async () => {
    const office = t();
    await expect(office.mutation(api.agents.hire, { ...person, name: "Pam" })).rejects.toThrow(/Pick a role/);
    await office.mutation(api.agents.hire, { ...person, name: "Pam", jobTitle: "Temp", jobDescription: "Fills in." });
    const { roleId } = await office.mutation(api.roles.create, { roleName: "Researcher", roleDescription: "Digs in." });
    await office.mutation(api.agents.update, { name: "Pam", roleId });
    const pam = await office.query(api.agents.getByName, { name: "Pam" });
    expect(pam?.jobTitle).toBe("Researcher");
    expect(pam?.roleId).toBe(roleId);
  });

  test("roles report to roles, no self or two-way loops, and held roles cannot be removed", async () => {
    const office = t();
    const boss = await office.mutation(api.roles.create, { roleName: "Head of Sales", roleDescription: "Runs sales." });
    const rep = await office.mutation(api.roles.create, {
      roleName: "Account Executive",
      roleDescription: "Works deals.",
      supervisorId: boss.roleId,
    });
    await expect(office.mutation(api.roles.update, { roleId: rep.roleId, supervisorId: rep.roleId })).rejects.toThrow(
      /itself/
    );
    await expect(office.mutation(api.roles.update, { roleId: boss.roleId, supervisorId: rep.roleId })).rejects.toThrow(
      /already reports/
    );

    await office.mutation(api.agents.hire, { ...person, name: "Jim", roleId: rep.roleId });
    await expect(office.mutation(api.roles.remove, { roleId: rep.roleId })).rejects.toThrow(/held by Jim/);
    await office.mutation(api.roles.remove, { roleId: boss.roleId });
    const list = await office.query(api.roles.list, {});
    expect(list).toHaveLength(1);
    expect(list[0].supervisorId).toBeNull();
  });

  test("seed populates every department once and adopts people by title", async () => {
    const office = t();
    await office.mutation(api.agents.hire, {
      ...person,
      name: "Hazel",
      jobTitle: "Chief of Staff",
      jobDescription: "typed by hand",
    });
    const first = await office.mutation(api.roles.seed, {});
    expect(first.created).toHaveLength(STARTER_ROLES.length);
    expect(first.adopted).toEqual(["Hazel → Chief of Staff"]);
    const again = await office.mutation(api.roles.seed, {});
    expect(again.created).toEqual([]);

    const list = await office.query(api.roles.list, {});
    const departments = new Set(list.map((r) => r.department));
    for (const d of ["Front desk", "Corporate", "IT", "Sales", "Marketing", "Customer Success"]) {
      expect(departments.has(d), d).toBe(true);
    }
    const ae = list.find((r) => r.roleName === "Account Executive");
    expect(ae?.supervisorName).toBe("Head of Sales");
    const hazel = await office.query(api.agents.getByName, { name: "Hazel" });
    expect(hazel?.jobDescription).not.toBe("typed by hand");
  });
});

describe("duties and metrics", () => {
  test("the seed covers every department with duties and metrics, and backfills roles that lack them", async () => {
    const office = t();
    // A hand-made Chief of Staff from before duties existed.
    const { roleId } = await office.mutation(api.roles.create, {
      roleName: "Chief of Staff",
      roleDescription: "My own wording.",
    });
    const r = await office.mutation(api.roles.seed, {});
    expect(r.created).toHaveLength(STARTER_ROLES.length - 1);
    expect(r.filled).toContain("Chief of Staff");

    const roles = await office.query(api.roles.list, {});
    const departments = new Set(roles.map((x) => x.department));
    for (const d of DEPARTMENTS) expect(departments.has(d)).toBe(true);
    const cos = roles.find((x) => x._id === roleId)!;
    expect(cos.roleDescription).toBe("My own wording."); // edits are kept
    expect(cos.department).toBe("Corporate");
    expect(cos.duties.length).toBeGreaterThan(0);
    expect(cos.metrics.some((m) => m.measure === "delegations.reported_same_day")).toBe(true);
    for (const role of roles) {
      expect(role.duties.length).toBeGreaterThan(0);
      expect(role.metrics.length).toBeGreaterThan(0);
    }
  });

  test("a holder's profile carries the role's duties and metrics, and the scorecard is counted from runs", async () => {
    const office = t();
    await office.mutation(api.roles.seed, {});
    const roles = await office.query(api.roles.list, {});
    const cos = roles.find((x) => x.roleName === "Chief of Staff")!;
    const researcher = roles.find((x) => x.roleName === "Researcher")!;
    const hazel = await office.mutation(api.agents.hire, { ...person, name: "Hazel", roleId: cos._id });
    const milton = await office.mutation(api.agents.hire, { ...person, name: "Milton", roleId: researcher._id });

    const profile = await office.query(internal.agents.getByNameInternal, { name: "Hazel" });
    expect(profile?.duties).toEqual(cos.duties);
    expect(profile?.metrics).toEqual(cos.metrics);

    // Hazel delegates twice; one comes back at once, one is still open after two days.
    const parent = await office.mutation(internal.runs.startRun, { agentId: hazel.agentId, trigger: "chat" });
    const quick = await office.mutation(internal.runs.startRun, {
      agentId: milton.agentId,
      trigger: "delegation",
      parentRunId: parent,
    });
    const artifactId = await office.mutation(internal.runs.saveArtifact, {
      agentId: milton.agentId,
      runId: quick,
      kind: "note",
      title: "Back already",
      contentMd: "done",
      version: 1,
      sources: [],
    });
    await office.mutation(internal.runs.finishRun, { runId: quick, artifactId });
    const slow = await office.mutation(internal.runs.startRun, {
      agentId: milton.agentId,
      trigger: "delegation",
      parentRunId: parent,
    });
    await office.run(async (ctx) => {
      await ctx.db.patch(slow, { startedAt: Date.now() - 2 * 86_400_000 });
    });

    const card = await office.query(api.work.scorecardForAgent, { agentId: hazel.agentId });
    const by = Object.fromEntries(card!.scorecard.map((m) => [m.measure, m]));
    expect(by["delegations.reported_same_day"].value).toBe(100);
    expect(by["delegations.reported_same_day"].met).toBe(true);
    expect(by["delegations.open_over_day"].value).toBe(1);
    expect(by["delegations.open_over_day"].met).toBe(false);
    expect(by["manual"].value).toBeNull();

    // The same numbers reach the prompt's work state.
    const state = await office.query(api.work.statusForAgent, { agentId: hazel.agentId });
    expect(state?.scorecard?.some((m) => m.measure === "delegations.open_over_day" && m.value === 1)).toBe(true);
  });
});
