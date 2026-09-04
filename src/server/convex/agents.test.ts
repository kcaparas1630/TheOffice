/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

// chat.ts is excluded: it needs the installed agent component and a live LLM.
// _generated is included so convex-test can locate the functions root.
const modules = {
  ...import.meta.glob("./{agents,work,roles,skills}.ts"),
  ...import.meta.glob("./_generated/**/*.js"),
};

const t = () => convexTest(schema, modules);

const ednaProfile = {
  name: "Edna",
  jobTitle: "CTO",
  jobDescription: "Regulate and facilitate growth in the tech space of this company.",
  successfulDay: ["Report to the CEO with brief news", "Filter relevant tech news"],
  traits: ["Strict", " pessimistic "],
  notes: "Dry, no filler.",
};

describe("agents.hire", () => {
  test("hires an agent and shows them on the roster", async () => {
    const office = t();
    const hired = await office.mutation(api.agents.hire, ednaProfile);
    expect(hired.name).toBe("Edna");

    const roster = await office.query(api.agents.roster, {});
    expect(roster).toHaveLength(1);
    expect(roster[0]).toMatchObject({
      name: "Edna",
      jobTitle: "CTO",
      status: "idle",
      supervisorName: null,
    });
    // traits are normalized to lowercase and trimmed
    expect(roster[0].traits).toEqual(["strict", "pessimistic"]);
  });

  test("stores a chosen sprite and rejects unknown ones", async () => {
    const office = t();
    await expect(
      office.mutation(api.agents.hire, { ...ednaProfile, sprite: "c99" })
    ).rejects.toThrow(/Unknown sprite/);
    await office.mutation(api.agents.hire, { ...ednaProfile, sprite: "c03" });
    let edna = await office.query(api.agents.getByName, { name: "Edna" });
    expect(edna?.sprite).toBe("c03");
    await office.mutation(api.agents.setSprite, { name: "edna", sprite: "c04" });
    edna = await office.query(api.agents.getByName, { name: "Edna" });
    expect(edna?.sprite).toBe("c04");
  });

  test("update edits only the fields given and keeps the one-level rule", async () => {
    const office = t();
    await office.mutation(api.agents.hire, ednaProfile);
    await office.mutation(api.agents.hire, { ...ednaProfile, name: "Milton", jobTitle: "Analyst" });

    await office.mutation(api.agents.update, {
      name: "edna",
      jobTitle: "  Chief Technology Officer ",
      traits: ["Jolly"],
      supervisorName: "Milton",
    });
    let edna = await office.query(api.agents.getByName, { name: "Edna" });
    expect(edna?.jobTitle).toBe("Chief Technology Officer");
    expect(edna?.personality).toEqual({ traits: ["jolly"], notes: "Dry, no filler." });
    expect(edna?.jobDescription).toBe(ednaProfile.jobDescription);
    expect(edna?.supervisorId).toBeDefined();

    // Milton now reports to Edna? No: Edna reports to Milton, so no chains.
    await expect(
      office.mutation(api.agents.update, { name: "Milton", supervisorName: "Edna" })
    ).rejects.toThrow(/no chains/);
    await expect(office.mutation(api.agents.update, { name: "Edna", successfulDay: [" "] })).rejects.toThrow(
      /successful day/
    );

    await office.mutation(api.agents.update, { name: "Edna", supervisorName: "" });
    edna = await office.query(api.agents.getByName, { name: "Edna" });
    expect(edna?.supervisorId).toBeUndefined();
  });

  test("rejects duplicate names case-insensitively", async () => {
    const office = t();
    await office.mutation(api.agents.hire, ednaProfile);
    await expect(
      office.mutation(api.agents.hire, { ...ednaProfile, name: "EDNA" })
    ).rejects.toThrow(/already works here/);
  });

  test("rejects invalid names and empty profiles", async () => {
    const office = t();
    await expect(
      office.mutation(api.agents.hire, { ...ednaProfile, name: "Edna K" })
    ).rejects.toThrow(/single word/);
    await expect(
      office.mutation(api.agents.hire, { ...ednaProfile, jobDescription: "  " })
    ).rejects.toThrow(/Job description/);
    await expect(
      office.mutation(api.agents.hire, { ...ednaProfile, successfulDay: [] })
    ).rejects.toThrow(/successful day/);
  });

  test("hires with a supervisor by name", async () => {
    const office = t();
    await office.mutation(api.agents.hire, ednaProfile);
    await office.mutation(api.agents.hire, {
      ...ednaProfile,
      name: "Milton",
      jobTitle: "Researcher",
      supervisorName: "edna",
    });
    const roster = await office.query(api.agents.roster, {});
    const milton = roster.find((a) => a.name === "Milton");
    expect(milton?.supervisorName).toBe("Edna");
  });
});

describe("agents.assignSupervisor", () => {
  test("assigns and forbids self-supervision and chains", async () => {
    const office = t();
    await office.mutation(api.agents.hire, ednaProfile);
    await office.mutation(api.agents.hire, { ...ednaProfile, name: "Milton" });

    await expect(
      office.mutation(api.agents.assignSupervisor, { agentName: "Edna", supervisorName: "Edna" })
    ).rejects.toThrow(/themselves/);

    await office.mutation(api.agents.assignSupervisor, {
      agentName: "Milton",
      supervisorName: "Edna",
    });
    // Milton reports to Edna, so Edna cannot report to Milton (one level max).
    await expect(
      office.mutation(api.agents.assignSupervisor, { agentName: "Edna", supervisorName: "Milton" })
    ).rejects.toThrow(/no chains/);
  });
});

describe("work.statusForAgent", () => {
  test("empty state is explicit about having nothing", async () => {
    const office = t();
    const { agentId } = await office.mutation(api.agents.hire, ednaProfile);
    const state = await office.query(api.work.statusForAgent, { agentId });
    expect(state).toMatchObject({ status: "idle", jobs: [], runs: [], artifacts: [] });
  });

  test("reflects real runs, artifacts, and reports", async () => {
    const office = t();
    const { agentId } = await office.mutation(api.agents.hire, ednaProfile);
    await office.mutation(api.agents.hire, {
      ...ednaProfile,
      name: "Milton",
      supervisorName: "Edna",
    });

    await office.run(async (ctx) => {
      const runId = await ctx.db.insert("runs", {
        agentId,
        trigger: "schedule",
        status: "done",
        startedAt: Date.now() - 60_000,
        finishedAt: Date.now(),
      });
      await ctx.db.insert("artifacts", {
        agentId,
        runId,
        kind: "brief",
        title: "Tech Brief",
        contentMd: "# Brief",
        version: 1,
        sources: [{ title: "HN", url: "https://news.ycombinator.com" }],
      });
    });

    const state = await office.query(api.work.statusForAgent, { agentId });
    expect(state?.reportNames).toEqual(["Milton"]);
    expect(state?.runs).toHaveLength(1);
    expect(state?.runs[0]).toMatchObject({ trigger: "schedule", status: "done" });
    expect(state?.artifacts[0]).toMatchObject({ title: "Tech Brief", kind: "brief", version: 1 });
  });
});

describe("agents.fire", () => {
  test("removes the agent, their records, and unlinks reports", async () => {
    const office = t();
    const { agentId } = await office.mutation(api.agents.hire, ednaProfile);
    await office.mutation(api.agents.hire, {
      ...ednaProfile,
      name: "Milton",
      supervisorName: "Edna",
    });
    await office.run(async (ctx) => {
      const runId = await ctx.db.insert("runs", {
        agentId,
        trigger: "chat",
        status: "done",
        startedAt: Date.now(),
      });
      await ctx.db.insert("artifacts", {
        agentId,
        runId,
        kind: "note",
        title: "Note",
        contentMd: "note",
        version: 1,
        sources: [],
      });
    });

    await office.mutation(api.agents.fire, { name: "Edna" });

    const roster = await office.query(api.agents.roster, {});
    expect(roster.map((a) => a.name)).toEqual(["Milton"]);
    expect(roster[0].supervisorName).toBeNull();
    await office.run(async (ctx) => {
      expect(await ctx.db.query("runs").collect()).toHaveLength(0);
      expect(await ctx.db.query("artifacts").collect()).toHaveLength(0);
    });
  });
});
