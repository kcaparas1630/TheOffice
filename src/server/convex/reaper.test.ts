/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = {
  ...import.meta.glob("./{agents,work,roles,skills,runs,office}.ts"),
  ...import.meta.glob("./_generated/**/*.js"),
};

const person = {
  jobTitle: "Researcher",
  jobDescription: "Digs in.",
  successfulDay: ["Ship a sourced write-up"],
  traits: ["thorough"],
  notes: "",
};

describe("stale run reaper", () => {
  test("fails runs whose process died and settles the agent; fresh runs are left alone", async () => {
    const office = convexTest(schema, modules);
    const hazel = await office.mutation(api.agents.hire, { ...person, name: "Hazel" });
    const milton = await office.mutation(api.agents.hire, { ...person, name: "Milton" });

    const old = await office.mutation(internal.runs.startRun, { agentId: hazel.agentId, trigger: "schedule" });
    const fresh = await office.mutation(internal.runs.startRun, { agentId: milton.agentId, trigger: "chat" });
    await office.run(async (ctx) => {
      await ctx.db.patch(old, { startedAt: Date.now() - 60 * 60_000 }); // an hour ago
    });

    const reaped = await office.mutation(internal.runs.reapStaleRuns, {});
    expect(reaped).toBe(1);

    await office.run(async (ctx) => {
      const dead = await ctx.db.get(old);
      expect(dead?.status).toBe("failed");
      expect(dead?.error).toMatch(/timed out/i);
      expect((await ctx.db.get(fresh))?.status).toBe("running");
      expect((await ctx.db.get(hazel.agentId))?.status).toBe("idle");
      expect((await ctx.db.get(milton.agentId))?.status).toBe("working");
    });
  });
});
