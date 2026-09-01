import { describe, expect, test } from "vitest";
import {
  buildTaskPrompt,
  taskTitle,
  buildRoutingPrompt,
  resolveRouting,
  buildHandoffPrompt,
  handoffTitle,
} from "./tasks";

const milton = {
  name: "Milton",
  jobTitle: "Researcher",
  jobDescription: "Digs into topics the office needs understood.",
  successfulDay: ["Deliver one well-grounded write-up"],
  personality: { traits: ["meticulous"], notes: "" },
};

describe("buildTaskPrompt", () => {
  test("carries the worker persona, the supervisor, and the task", () => {
    const { system, prompt } = buildTaskPrompt({
      worker: milton,
      assignedBy: { role: "supervisor", name: "Hazel" },
      task: "Summarize the Convex components ecosystem",
    });
    expect(system).toContain("You are Milton, the Researcher");
    expect(system).toContain("Hazel, your supervisor");
    expect(prompt).toContain("Summarize the Convex components ecosystem");
  });

  test("CEO-direct assignments say so instead of naming a supervisor", () => {
    const { system } = buildTaskPrompt({
      worker: milton,
      assignedBy: { role: "ceo" },
      task: "t",
    });
    expect(system).toContain("The CEO has assigned a task to you directly.");
    expect(system).not.toContain("your supervisor, has delegated");
  });

  test("forbids fabricated specifics", () => {
    const { system } = buildTaskPrompt({
      worker: milton,
      assignedBy: { role: "ceo" },
      task: "t",
    });
    expect(system).toContain("no fabricated");
  });
});

describe("buildRoutingPrompt", () => {
  const hazel = {
    name: "Hazel",
    jobTitle: "Chief of Staff",
    jobDescription: "Keeps the CEO focused by handling operational noise.",
    successfulDay: ["Clear summaries"],
    personality: { traits: ["jolly"], notes: "" },
  };

  test("lists each report with their job description and the routing rules", () => {
    const { system, prompt } = buildRoutingPrompt({
      supervisor: hazel,
      reports: [
        { name: "Milton", jobTitle: "Researcher", jobDescription: "Digs into topics." },
      ],
      task: "Research Convex components",
    });
    expect(system).toContain("You are Hazel, the Chief of Staff");
    expect(system).toContain("- Milton — Researcher: Digs into topics.");
    expect(system).toContain("Never invent a name.");
    expect(system).toContain("you remain accountable");
    expect(prompt).toContain("Research Convex components");
  });
});

describe("resolveRouting", () => {
  const reports = ["Milton", "Pam"];

  test("valid delegation resolves to the canonical report name", () => {
    const routing = resolveRouting(
      { decision: "delegate", workerName: "milton", reason: "research fits him", refinedTask: "Dig in" },
      reports
    );
    expect(routing).toEqual({
      kind: "delegate",
      workerName: "Milton",
      reason: "research fits him",
      task: "Dig in",
    });
  });

  test("self decisions pass through", () => {
    expect(
      resolveRouting({ decision: "self", workerName: null, reason: "my call to make" }, reports)
    ).toEqual({
      kind: "self",
      reason: "my call to make",
    });
  });

  test("a missing workerName is recovered when the reasoning names exactly one report", () => {
    const routing = resolveRouting(
      {
        decision: "delegate",
        workerName: null,
        reason: "Research fits Milton's job description better than mine.",
      },
      reports
    );
    expect(routing).toMatchObject({ kind: "delegate", workerName: "Milton" });
  });

  test("invented, missing, or ambiguous worker names fall back to self, on the record", () => {
    const invented = resolveRouting(
      { decision: "delegate", workerName: "Dwight", reason: "sounds right" },
      reports
    );
    expect(invented.kind).toBe("self");
    expect(invented.reason).toContain('"Dwight"');

    const ambiguous = resolveRouting(
      { decision: "delegate", workerName: null, reason: "Either Milton or Pam could take this." },
      reports
    );
    expect(ambiguous.kind).toBe("self");

    const noMention = resolveRouting(
      { decision: "delegate", workerName: null, reason: "someone should do it" },
      reports
    );
    expect(noMention.kind).toBe("self");
  });
});

describe("buildHandoffPrompt / handoffTitle", () => {
  test("the covering brief carries the ask, the worker, and the report", () => {
    const { system, prompt } = buildHandoffPrompt({
      supervisor: {
        name: "Hazel",
        jobTitle: "Chief of Staff",
        jobDescription: "Handles operational noise.",
        successfulDay: ["Clear summaries"],
        personality: { traits: ["jolly"], notes: "" },
      },
      workerName: "Milton",
      task: "Why is a whale a mammal?",
      reportMd: "# Report\n\nWhales nurse their young.",
    });
    expect(system).toContain("You are Hazel, the Chief of Staff");
    expect(system).toContain("You delegated a task to Milton");
    expect(system).toContain("Do not rewrite or pad the report");
    expect(prompt).toContain("Why is a whale a mammal?");
    expect(prompt).toContain("Whales nurse their young.");
  });

  test("handoff title is deterministic and truncated", () => {
    expect(handoffTitle("Why is a whale a mammal?", "2026-09-01")).toBe(
      "Report to CEO: Why is a whale a mammal? — 2026-09-01"
    );
    expect(handoffTitle("x".repeat(80), "2026-09-01")).toContain("…");
  });
});

describe("taskTitle", () => {
  test("short tasks appear whole", () => {
    expect(taskTitle("Research Convex components", "2026-09-02")).toBe(
      "Task: Research Convex components — 2026-09-02"
    );
  });

  test("long tasks are truncated with an ellipsis and whitespace collapsed", () => {
    const long = "Write a  very   detailed report about everything that happened in the office this quarter including all metrics";
    const title = taskTitle(long, "2026-09-02");
    expect(title).toContain("…");
    expect(title.length).toBeLessThan(70);
    expect(title).not.toMatch(/\s{2,}/);
  });
});
