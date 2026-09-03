/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { STARTER_ROLES } from "./roles";

const modules = {
  ...import.meta.glob("./{agents,work,roles}.ts"),
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
