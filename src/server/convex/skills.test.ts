/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { mapSmitherySkill } from "../../lib/skills";
import { SEED_CATEGORIES, SKILL_SEED } from "../../lib/skillSeed";

const modules = {
  ...import.meta.glob("./{agents,work,roles,skills,runs,office}.ts"),
  ...import.meta.glob("./_generated/**/*.js"),
};

const t = () => convexTest(schema, modules);

const person = {
  jobTitle: "Researcher",
  jobDescription: "Digs in.",
  successfulDay: ["Ship a sourced write-up"],
  traits: ["thorough"],
  notes: "",
};

describe("skills catalogue", () => {
  test("custom skills are created once, searchable, and guarded while held", async () => {
    const office = t();
    const { skillId } = await office.mutation(api.skills.create, {
      name: "Deck building (PPTX)",
      description: "Turns notes into slide decks.",
      category: "Documents",
    });
    await expect(
      office.mutation(api.skills.create, { name: "deck building pptx", description: "dup" })
    ).rejects.toThrow(/already exists/);

    const found = await office.query(api.skills.list, { search: "slide" });
    expect(found.matched).toBe(1);
    expect(found.skills[0]).toMatchObject({ slug: "deck-building-pptx", source: "custom", holders: [] });

    await office.mutation(api.agents.hire, { ...person, name: "Milton", skills: [{ skillId, level: 3 }] });
    await expect(office.mutation(api.skills.remove, { skillId })).rejects.toThrow(/held by Milton/);
    await office.mutation(api.skills.unassign, { agentName: "milton", skillId });
    await office.mutation(api.skills.remove, { skillId });
    expect((await office.query(api.skills.list, {})).total).toBe(0);
  });

  test("assigning sets a clamped level; agents carry their skills into prompts and the snapshot", async () => {
    const office = t();
    await office.mutation(api.agents.hire, { ...person, name: "Milton" });
    const a = await office.mutation(api.skills.create, { name: "PDF", description: "PDF files." });
    const b = await office.mutation(api.skills.create, { name: "Spreadsheets", description: "XLSX." });
    await office.mutation(api.skills.assign, { agentName: "Milton", skillId: a.skillId, level: 9 });
    await office.mutation(api.skills.assign, { agentName: "Milton", skillId: b.skillId });
    await office.mutation(api.skills.assign, { agentName: "Milton", skillId: b.skillId, level: 2 }); // re-assign = set level

    const held = await office.query(api.skills.forAgent, { agentName: "Milton" });
    expect(held.map((h) => [h.name, h.level, h.uses])).toEqual([
      ["PDF", 5, 0],
      ["Spreadsheets", 2, 0],
    ]);
    const internalAgent = await office.query(internal.agents.getByNameInternal, { name: "Milton" });
    expect(internalAgent?.skills.map((s) => s.name)).toEqual(["PDF", "Spreadsheets"]);
    const snap = await office.query(api.office.snapshot, {});
    expect(snap.agents[0].skills[0]).toMatchObject({ name: "PDF", level: 5 });
  });

  test("finished runs count uses and promote on the ladder, never demoting", async () => {
    const office = t();
    const { agentId } = await office.mutation(api.agents.hire, { ...person, name: "Milton" });
    const { skillId } = await office.mutation(api.skills.create, { name: "PDF", description: "PDF files." });
    await office.mutation(api.skills.assign, { agentName: "Milton", skillId, level: 1 });
    await office.run(async (ctx) => {
      const row = (await ctx.db.query("agentSkills").first())!;
      await ctx.db.patch(row._id, { uses: 49 });
    });

    const finish = async () => {
      const runId = await office.mutation(internal.runs.startRun, { agentId, trigger: "chat", task: "merge" });
      const artifactId = await office.run(async (ctx) =>
        ctx.db.insert("artifacts", { agentId, runId, kind: "report", title: "x", contentMd: "x", version: 1, sources: [] })
      );
      return office.mutation(internal.runs.finishRun, { runId, artifactId, skillIds: [skillId] });
    };
    const first = await finish();
    expect(first?.promoted).toEqual([{ skillId, level: 2 }]);
    const second = await finish();
    expect(second?.promoted).toEqual([]);
    const held = await office.query(api.skills.forAgent, { agentName: "Milton" });
    expect(held[0]).toMatchObject({ uses: 51, level: 2 });
  });

  test("imports upsert by slug, so re-importing updates instead of duplicating", async () => {
    const office = t();
    const rows = [mapSmitherySkill({ namespace: "anthropics", slug: "pdf", displayName: "PDF", description: "v1", totalActivations: 10 })];
    const first = await office.mutation(internal.skills.upsertBatch, { rows });
    expect(first).toEqual({ created: 1, updated: 0 });
    rows[0].description = "v2";
    rows[0].popularity = 20;
    const again = await office.mutation(internal.skills.upsertBatch, { rows });
    expect(again).toEqual({ created: 0, updated: 1 });
    const list = await office.query(api.skills.list, {});
    expect(list.total).toBe(1);
    expect(list.skills[0]).toMatchObject({ slug: "anthropics/pdf", description: "v2", popularity: 20, source: "smithery" });
  });
});

describe("office catalogue seed", () => {
  test("seeds every sector once, lists by category, and re-seeding never duplicates", async () => {
    const office = t();
    const first = await office.mutation(api.skills.seed, {});
    expect(first).toEqual({ created: SKILL_SEED.length, updated: 0 });

    const all = await office.query(api.skills.list, {});
    expect(all.total).toBe(SKILL_SEED.length);
    expect(all.skills).toHaveLength(SKILL_SEED.length); // the whole catalogue, not a page
    const names = new Set(all.categories.map((c) => c.name));
    for (const c of SEED_CATEGORIES) expect(names.has(c)).toBe(true);

    const finance = await office.query(api.skills.list, { category: "Finance" });
    expect(finance.matched).toBe(SKILL_SEED.filter((s) => s.category === "Finance").length);
    expect(finance.skills.every((s) => s.category === "Finance")).toBe(true);

    const soft = await office.query(api.skills.list, { search: "listening" });
    expect(soft.skills.map((s) => s.name)).toContain("Active listening");
    const detail = await office.query(api.skills.get, { skillId: soft.skills[0]._id });
    expect(detail?.prompt).toMatch(/Summarise what they said/);

    const again = await office.mutation(api.skills.seed, {});
    expect(again).toEqual({ created: 0, updated: SKILL_SEED.length });
    expect((await office.query(api.skills.list, {})).total).toBe(SKILL_SEED.length);
  });

  test("seed names are unique and every entry has a prompt", () => {
    const slugs = SKILL_SEED.map((s) => s.name.toLowerCase());
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of SKILL_SEED) {
      expect(s.description.length).toBeGreaterThan(10);
      expect(s.prompt.length).toBeGreaterThan(40);
    }
  });
});
