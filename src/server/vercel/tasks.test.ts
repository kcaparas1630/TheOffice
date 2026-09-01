import { describe, expect, test } from "vitest";
import { buildTaskPrompt, taskTitle } from "./tasks";

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
      supervisorName: "Hazel",
      task: "Summarize the Convex components ecosystem",
    });
    expect(system).toContain("You are Milton, the Researcher");
    expect(system).toContain("Hazel, your supervisor");
    expect(prompt).toContain("Summarize the Convex components ecosystem");
  });

  test("forbids fabricated specifics", () => {
    const { system } = buildTaskPrompt({ worker: milton, supervisorName: "H", task: "t" });
    expect(system).toContain("no fabricated");
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
