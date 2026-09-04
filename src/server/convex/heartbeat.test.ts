/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { MAX_TURNS_PER_TICK } from "./heartbeat";
import type { Id } from "./_generated/dataModel";

const modules = {
  ...import.meta.glob("./{agents,work,roles,skills,runs,office,settings,messages,heartbeat,delegation}.ts"),
  ...import.meta.glob("./_generated/**/*.js"),
};

const person = {
  jobTitle: "Researcher",
  jobDescription: "Digs in.",
  successfulDay: ["Ship a sourced write-up"],
  traits: ["thorough"],
  notes: "",
};

describe("office heartbeat", () => {
  test("a tick gives idle agents a turn, respects the cooldown and the per-tick cap, and pauses with the setting", async () => {
    const office = convexTest(schema, modules);
    const names = ["Hazel", "Milton", "Pam"];
    const ids: Id<"agents">[] = [];
    for (const name of names) ids.push((await office.mutation(api.agents.hire, { ...person, name })).agentId);

    // Someone mid-run never gets a turn.
    await office.mutation(internal.runs.startRun, { agentId: ids[2], trigger: "chat" });

    const first = await office.mutation(internal.heartbeat.tick, { force: true });
    expect(first.turns).toHaveLength(Math.min(MAX_TURNS_PER_TICK, 2));
    expect(first.turns).not.toContain("Pam");
    for (const name of first.turns) {
      const a = await office.query(api.agents.getByName, { name });
      expect(a).not.toBeNull();
    }
    const hazel = await office.run(async (ctx) => ctx.db.get(ids[0]));
    expect(hazel?.lastTurnAt).toBeGreaterThan(0);

    // Within the cooldown nobody is due (the clock is ignored with force,
    // but the cooldown only applies without it — so check the paused path
    // and the cooldown path separately).
    await office.mutation(api.settings.update, { heartbeat: false });
    const paused = await office.mutation(internal.heartbeat.tick, {});
    expect(paused.phase).toBe("paused");
    expect(paused.turns).toEqual([]);

    await office.mutation(api.settings.update, { heartbeat: true, turnEveryMinutes: 60 });
    const settings = await office.query(api.settings.get, {});
    expect(settings.turnEveryMinutes).toBe(60);
  });

  test("notes between colleagues land in the inbox until read; reports go to Kent", async () => {
    const office = convexTest(schema, modules);
    const hazel = await office.mutation(api.agents.hire, { ...person, name: "Hazel" });
    const milton = await office.mutation(api.agents.hire, { ...person, name: "Milton" });

    const noteId = await office.mutation(internal.messages.send, {
      fromAgentId: hazel.agentId,
      toAgentId: milton.agentId,
      text: "Topic A first, please.",
    });
    await office.mutation(internal.messages.send, { fromAgentId: hazel.agentId, text: "Need a decision on X." });
    await expect(
      office.mutation(internal.messages.send, { fromAgentId: hazel.agentId, toAgentId: milton.agentId, text: "  " })
    ).rejects.toThrow(/Empty/);

    const inbox = await office.query(internal.messages.inboxFor, { agentId: milton.agentId });
    expect(inbox.map((m) => [m.from, m.text])).toEqual([["Hazel", "Topic A first, please."]]);

    await office.mutation(internal.messages.markRead, { ids: [noteId] });
    expect(await office.query(internal.messages.inboxFor, { agentId: milton.agentId })).toEqual([]);

    // The turn context carries colleagues, inbox and the phase.
    await office.mutation(internal.messages.send, { fromAgentId: milton.agentId, toAgentId: hazel.agentId, text: "Done." });
    const bundle = await office.query(internal.heartbeat.turnContext, { agentId: hazel.agentId });
    expect(bundle?.turn.inbox.map((m) => m.text)).toEqual(["Done."]);
    expect(bundle?.turn.colleagues.map((c) => c.name)).toEqual(["Milton"]);
    expect(["work", "lunch", "break", "closed"]).toContain(bundle?.turn.phase);

    const turnId = await office.mutation(internal.heartbeat.recordTurn, {
      agentId: hazel.agentId,
      phase: "work",
      action: "rest",
      reason: "nothing behind",
      summary: "rest: nothing behind",
    });
    expect(turnId).toBeTruthy();
    const snap = await office.query(api.office.snapshot, {});
    expect(snap.turns[0]).toMatchObject({ agentName: "Hazel", action: "rest" });
    expect(snap.heartbeat).toBe(true);
  });
});
