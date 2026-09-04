import { describe, expect, test } from "vitest";
import {
  computeMeasures,
  formatMetric,
  formatMetricLine,
  parseMetricLine,
  scoreMetrics,
  type RecordWindow,
} from "./metrics";

const H = 3_600_000;
const D = 24 * H;
const now = 100 * D;

const window: RecordWindow = {
  agentId: "hazel",
  now,
  runs: [
    // Hazel's own runs this week: two done (one scheduled), one failed, one older than the window.
    { agentId: "hazel", trigger: "schedule", status: "done", startedAt: now - 1 * D, finishedAt: now - 1 * D + H },
    { agentId: "hazel", trigger: "chat", status: "done", startedAt: now - 2 * D, finishedAt: now - 2 * D + H },
    { agentId: "hazel", trigger: "chat", status: "failed", startedAt: now - 3 * D, finishedAt: now - 3 * D + H },
    { agentId: "hazel", trigger: "schedule", status: "done", startedAt: now - 10 * D, finishedAt: now - 10 * D + H },
    // Delegations Hazel handed to Milton: one back same day, one took two days, one still open for 3 days.
    { agentId: "milton", parentAgentId: "hazel", trigger: "delegation", status: "done", startedAt: now - 2 * D, finishedAt: now - 2 * D + 2 * H },
    { agentId: "milton", parentAgentId: "hazel", trigger: "delegation", status: "done", startedAt: now - 5 * D, finishedAt: now - 3 * D },
    { agentId: "milton", parentAgentId: "hazel", trigger: "delegation", status: "running", startedAt: now - 3 * D },
    // Milton's own run, not Hazel's business.
    { agentId: "milton", trigger: "chat", status: "done", startedAt: now - 1 * D, finishedAt: now - 1 * D + H },
  ],
  artifactsAt: [now - 1 * D, now - 4 * D, now - 20 * D],
};

describe("computeMeasures", () => {
  test("counts only this person's records inside the 7-day window", () => {
    const v = computeMeasures(window);
    expect(v["runs.completed"]).toBe(2);
    expect(v["runs.failed"]).toBe(1);
    expect(v["jobs.on_time"]).toBe(1);
    expect(v["artifacts.delivered"]).toBe(2);
    expect(v["delegations.made"]).toBe(3);
    expect(v["delegations.reported_same_day"]).toBe(50);
    expect(v["delegations.open_over_day"]).toBe(1);
    expect(v.manual).toBeNull();
  });

  test("a share with nothing to count is null, not zero", () => {
    const v = computeMeasures({ agentId: "x", now, runs: [], artifactsAt: [] });
    expect(v["delegations.reported_same_day"]).toBeNull();
    expect(v["runs.completed"]).toBe(0);
  });
});

describe("scoreMetrics", () => {
  test("higher-is-better and lower-is-better targets, plus untracked", () => {
    const values = computeMeasures(window);
    const scored = scoreMetrics(
      [
        { statement: "Delegations back within a day", target: 100, unit: "%", measure: "delegations.reported_same_day" },
        { statement: "Nothing left open past a day", target: 0, unit: "count", measure: "delegations.open_over_day" },
        { statement: "Documents delivered", target: 2, unit: "count", measure: "artifacts.delivered" },
        { statement: "Every meeting briefed", target: 100, unit: "%", measure: "manual" },
        { statement: "Unknown measure behaves as manual", target: 1, unit: "count", measure: "nope" },
      ],
      values
    );
    expect(scored.map((s) => s.met)).toEqual([false, false, true, null, null]);
    expect(formatMetric(scored[0])).toBe("Delegations back within a day — 50% of 100% — behind");
    expect(formatMetric(scored[2])).toBe("Documents delivered — 2 of 2 — met");
    expect(formatMetric(scored[3])).toBe("Every meeting briefed — target 100% — not tracked yet");
  });
});

describe("metric lines", () => {
  test("round-trip the editor format and tolerate sloppy input", () => {
    const m = parseMetricLine("Documents delivered | 3 count | artifacts.delivered");
    expect(m).toEqual({ statement: "Documents delivered", target: 3, unit: "count", measure: "artifacts.delivered" });
    expect(formatMetricLine(m!)).toBe("Documents delivered | 3 count | artifacts.delivered");
    expect(parseMetricLine("Back within a day | 100%")).toEqual({
      statement: "Back within a day",
      target: 100,
      unit: "%",
      measure: "manual",
    });
    expect(parseMetricLine("just words")).toBeNull();
    expect(parseMetricLine("statement | not a number")).toBeNull();
  });
});
