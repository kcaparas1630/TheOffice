import { describe, expect, test } from "vitest";
import { buildSystemPrompt, formatWorkState, type AgentProfile, type WorkState } from "./prompts";

const edna: AgentProfile = {
  name: "Edna",
  jobTitle: "CTO",
  jobDescription:
    "The job of CTO is to regulate and facilitate growth in the tech space of this company.",
  successfulDay: [
    "Reporting to the CEO with brief news",
    "Research on where growth should be",
    "Filter out relevant tech news",
  ],
  personality: { traits: ["strict", "pessimistic"], notes: "Dry humor, no filler." },
};

describe("buildSystemPrompt", () => {
  test("identity comes from name and job title", () => {
    const prompt = buildSystemPrompt(edna);
    expect(prompt).toContain("You are Edna, the CTO");
  });

  test("includes the job description and every successful-day item", () => {
    const prompt = buildSystemPrompt(edna);
    expect(prompt).toContain("regulate and facilitate growth");
    for (const item of edna.successfulDay) {
      expect(prompt).toContain(`- ${item}`);
    }
  });

  test("personality traits and notes shape the persona", () => {
    const prompt = buildSystemPrompt(edna);
    expect(prompt).toContain("strict, pessimistic");
    expect(prompt).toContain("Dry humor, no filler.");
    expect(prompt).toContain("never the facts");
  });

  test("missing traits fall back to neutral instead of an empty list", () => {
    const bland = { ...edna, personality: { traits: [], notes: "" } };
    expect(buildSystemPrompt(bland)).toContain("stay neutral");
  });

  test("always carries the anti-hallucination rule", () => {
    expect(buildSystemPrompt(edna)).toContain("Never invent progress");
  });
});

describe("formatWorkState", () => {
  const empty: WorkState = {
    status: "idle",
    reportNames: [],
    jobs: [],
    runs: [],
    artifacts: [],
  };

  test("empty state says so explicitly (nothing for the LLM to invent)", () => {
    const text = formatWorkState(empty);
    expect(text).toContain("Status: idle");
    expect(text).toContain("Standing jobs: none");
    expect(text).toContain("Recent runs: none");
    expect(text).toContain("Documents produced: none");
  });

  test("populated state lists jobs, runs, and artifacts with details", () => {
    const state: WorkState = {
      status: "working",
      supervisorName: "Edna",
      reportNames: ["Milton"],
      jobs: [{ title: "Daily Tech Brief", schedule: "0 14 * * *", active: true }],
      runs: [
        {
          trigger: "schedule",
          status: "failed",
          startedAt: Date.UTC(2026, 7, 31, 14, 0),
          finishedAt: Date.UTC(2026, 7, 31, 14, 1),
          error: "feed timeout",
        },
      ],
      artifacts: [
        { title: "Tech Brief — Aug 31", kind: "brief", version: 2, createdAt: Date.UTC(2026, 7, 31) },
      ],
    };
    const text = formatWorkState(state);
    expect(text).toContain("Status: working");
    expect(text).toContain("You report to: Edna");
    expect(text).toContain("You supervise: Milton");
    expect(text).toContain("Daily Tech Brief");
    expect(text).toContain("[failed] trigger=schedule");
    expect(text).toContain("error: feed timeout");
    expect(text).toContain('"Tech Brief — Aug 31" (brief v2');
  });
});
