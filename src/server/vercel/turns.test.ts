import { describe, expect, test } from "vitest";
import { buildTurnPrompt, resolveTurn, turnSummary, type TurnContext } from "./turns";

const now = Date.UTC(2026, 8, 3, 18, 0);

const ctx: TurnContext = {
  now,
  phase: "work",
  profile: {
    name: "Hazel",
    jobTitle: "Chief of Staff",
    jobDescription: "Runs the office on Kent's behalf.",
    successfulDay: [],
    personality: { traits: ["jolly"], notes: "" },
    duties: ["Run the staff: check every delegated task is reported back the same day."],
    metrics: [{ statement: "No delegation left open past a day", target: 0, unit: "count", measure: "delegations.open_over_day" }],
  },
  state: {
    status: "idle",
    reportNames: ["Milton"],
    jobs: [],
    runs: [],
    artifacts: [{ title: "Weekly review — 2026-09-01", kind: "note", version: 1, createdAt: now - 86_400_000 }],
    scorecard: [
      { statement: "No delegation left open past a day", target: 0, unit: "count", measure: "delegations.open_over_day", value: 1, met: false },
    ],
  },
  colleagues: [
    { name: "Milton", jobTitle: "Researcher", relation: "report", status: "idle" },
    { name: "Pam", jobTitle: "Receptionist", relation: "peer", status: "working" },
  ],
  inbox: [{ from: "Milton", text: "Which topic first?", at: now - 20 * 60_000 }],
  recentTurns: [{ at: now - 3_600_000, action: "rest", summary: "rest: nothing behind" }],
};

describe("buildTurnPrompt", () => {
  test("puts duties, scorecard, colleagues, inbox and past turns in front of the agent", () => {
    const { system, prompt } = buildTurnPrompt(ctx);
    expect(system).toContain("## Your duties");
    expect(system).toContain("Your scorecard (last 7 days");
    expect(system).toContain("No delegation left open past a day — 1 of 0 — behind");
    expect(system).toContain("Milton (Researcher) — reports to you, idle");
    expect(system).toContain('from Milton, 20m ago: "Which topic first?"');
    expect(system).toContain("1h ago: rest — rest: nothing behind");
    expect(prompt).toContain("It is working hours at the office");
    expect(prompt).toContain("delegate: hand one concrete task to someone who reports to you (Milton)");
    expect(prompt).toContain("answer the inbox before anything else");
  });

  test("says when delegation is unavailable", () => {
    const { prompt } = buildTurnPrompt({ ...ctx, colleagues: ctx.colleagues.filter((c) => c.relation !== "report") });
    expect(prompt).toContain("delegate: not available");
  });
});

describe("resolveTurn", () => {
  test("accepts well-formed decisions", () => {
    expect(resolveTurn({ action: "work", reason: "behind", task: "Write the plan" }, ctx)).toEqual({
      action: "work",
      task: "Write the plan",
      reason: "behind",
    });
    expect(resolveTurn({ action: "delegate", reason: "fits", to: "milton", task: "Dig in" }, ctx)).toEqual({
      action: "delegate",
      to: "Milton",
      task: "Dig in",
      reason: "fits",
    });
    expect(resolveTurn({ action: "message", reason: "answer", to: "Milton", message: "Topic A first." }, ctx)).toEqual({
      action: "message",
      to: "Milton",
      text: "Topic A first.",
      reason: "answer",
    });
    expect(resolveTurn({ action: "report", reason: "decide", message: "Need a call on X." }, ctx)).toEqual({
      action: "report",
      text: "Need a call on X.",
      reason: "decide",
    });
  });

  test("turns malformed or out-of-chain decisions into a rest with the reason on record", () => {
    expect(resolveTurn({ action: "work", reason: "r" }, ctx).action).toBe("rest");
    expect(resolveTurn({ action: "delegate", reason: "r", to: "Pam", task: "x" }, ctx)).toMatchObject({
      action: "rest",
      reason: expect.stringMatching(/does not report/),
    });
    expect(resolveTurn({ action: "delegate", reason: "r", to: "Ghost", task: "x" }, ctx).reason).toMatch(/unknown/);
    expect(resolveTurn({ action: "message", reason: "r", to: "Milton" }, ctx).reason).toMatch(/wrote nothing/);
    expect(resolveTurn({ action: "report", reason: "r" }, ctx).action).toBe("rest");
  });

  test("summaries are one short line", () => {
    expect(turnSummary({ action: "delegate", to: "Milton", task: "Dig in", reason: "" })).toBe("delegate to Milton: Dig in");
    expect(turnSummary({ action: "rest", reason: "nothing behind" })).toBe("rest: nothing behind");
    const long = "x".repeat(200);
    expect(turnSummary({ action: "work", task: long, reason: "" }).length).toBeLessThan(100);
  });
});
