/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

// delegation.ts's LLM call lives in the `delegate` action, which we don't
// invoke here — we test the records: pair validation, parent/child runs,
// the one-level rule, and how state surfaces the task.
const modules = {
  ...import.meta.glob("./{agents,work,jobs,runs,artifacts,delegation}.ts"),
  ...import.meta.glob("./_generated/**/*.js"),
};

const t = () => convexTest(schema, modules);

const profile = (name: string, jobTitle: string, supervisorName?: string) => ({
  name,
  jobTitle,
  jobDescription: `${jobTitle} of the office.`,
  successfulDay: ["Do good work"],
  traits: ["direct"],
  notes: "",
  supervisorName,
});

describe("delegation.delegationPair", () => {
  test("resolves a valid supervisor/report pair case-insensitively", async () => {
    const office = t();
    await office.mutation(api.agents.hire, profile("Hazel", "Chief of Staff"));
    await office.mutation(api.agents.hire, profile("Milton", "Researcher", "Hazel"));
    const pair = await office.query(internal.delegation.delegationPair, {
      supervisorName: "hazel",
      workerName: "MILTON",
    });
    expect(pair.supervisor.name).toBe("Hazel");
    expect(pair.worker.name).toBe("Milton");
  });

  test("rejects when the worker does not report to the supervisor", async () => {
    const office = t();
    await office.mutation(api.agents.hire, profile("Hazel", "Chief of Staff"));
    await office.mutation(api.agents.hire, profile("Milton", "Researcher"));
    await expect(
      office.query(internal.delegation.delegationPair, {
        supervisorName: "Hazel",
        workerName: "Milton",
      })
    ).rejects.toThrow(/does not report to/);
  });
});

describe("delegation run records", () => {
  test("parent and child runs record the task; state surfaces it", async () => {
    const office = t();
    const { agentId: hazelId } = await office.mutation(api.agents.hire, profile("Hazel", "CoS"));
    const { agentId: miltonId } = await office.mutation(
      api.agents.hire,
      profile("Milton", "Researcher", "Hazel")
    );

    const parentRunId = await office.mutation(internal.runs.startRun, {
      agentId: hazelId,
      trigger: "chat",
      task: "Delegate to Milton: research components",
    });
    const childRunId = await office.mutation(internal.runs.startRun, {
      agentId: miltonId,
      trigger: "delegation",
      parentRunId,
      task: "research components",
    });

    const miltonState = await office.query(api.work.statusForAgent, { agentId: miltonId });
    expect(miltonState?.status).toBe("working");
    expect(miltonState?.runs[0]).toMatchObject({
      trigger: "delegation",
      status: "running",
      task: "research components",
    });

    const artifactId = await office.mutation(internal.runs.saveArtifact, {
      agentId: miltonId,
      runId: childRunId,
      kind: "report",
      title: "Task: research components — 2026-09-02",
      contentMd: "# report",
      version: 1,
      sources: [],
    });
    await office.mutation(internal.runs.finishRun, { runId: childRunId, artifactId });
    await office.mutation(internal.runs.finishRun, { runId: parentRunId, artifactId });

    const hazelState = await office.query(api.work.statusForAgent, { agentId: hazelId });
    expect(hazelState?.status).toBe("idle");
    expect(hazelState?.runs[0]).toMatchObject({ status: "done", task: "Delegate to Milton: research components" });

    const docs = await office.query(api.artifacts.docsForAgent, { agentName: "Milton" });
    expect(docs![0].title).toBe("Task: research components — 2026-09-02");
  });

  test("one level max: a child run cannot become a parent", async () => {
    const office = t();
    const { agentId } = await office.mutation(api.agents.hire, profile("Hazel", "CoS"));
    const parent = await office.mutation(internal.runs.startRun, {
      agentId,
      trigger: "chat",
    });
    const child = await office.mutation(internal.runs.startRun, {
      agentId,
      trigger: "delegation",
      parentRunId: parent,
    });
    await expect(
      office.mutation(internal.runs.startRun, {
        agentId,
        trigger: "delegation",
        parentRunId: child,
      })
    ).rejects.toThrow(/one level max/);
  });
});
