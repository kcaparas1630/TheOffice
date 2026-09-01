/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

// LLM-calling modules (briefs, delegation, chat) are excluded; runs.ts and
// artifacts.ts are pure db plumbing and safe to exercise directly.
const modules = {
  ...import.meta.glob("./{agents,work,jobs,runs,artifacts}.ts"),
  ...import.meta.glob("./_generated/**/*.js"),
};

const t = () => convexTest(schema, modules);

const hazel = {
  name: "Hazel",
  jobTitle: "CTO",
  jobDescription: "Track the tech landscape for the CEO.",
  successfulDay: ["Deliver the daily brief"],
  traits: ["direct"],
  notes: "",
};

const briefJob = {
  agentName: "Hazel",
  title: "Daily Tech Brief",
  spec: "5-8 items, why-it-matters first, link every claim.",
};

describe("jobs.assign", () => {
  test("assigns a job and lists it", async () => {
    const office = t();
    await office.mutation(api.agents.hire, hazel);
    const assigned = await office.mutation(api.jobs.assign, briefJob);
    expect(assigned).toMatchObject({ agent: "Hazel", title: "Daily Tech Brief" });

    const jobs = await office.query(api.jobs.listForAgent, { agentName: "hazel" });
    expect(jobs).toHaveLength(1);
    expect(jobs![0]).toMatchObject({
      title: "Daily Tech Brief",
      schedule: "0 14 * * *", // default when none given
      active: true,
      lessons: [],
    });
  });

  test("rejects unknown agents and duplicate titles", async () => {
    const office = t();
    await expect(office.mutation(api.jobs.assign, briefJob)).rejects.toThrow(/works here/);
    await office.mutation(api.agents.hire, hazel);
    await office.mutation(api.jobs.assign, briefJob);
    await expect(
      office.mutation(api.jobs.assign, { ...briefJob, title: "daily tech brief" })
    ).rejects.toThrow(/already has a job/);
  });
});

describe("jobs.appendLesson", () => {
  test("cleans and appends lessons", async () => {
    const office = t();
    await office.mutation(api.agents.hire, hazel);
    const { jobId } = await office.mutation(api.jobs.assign, briefJob);
    await office.mutation(internal.jobs.appendLesson, {
      jobId,
      lesson: ' "Never include funding announcements." ',
    });
    const jobs = await office.query(api.jobs.listForAgent, { agentName: "Hazel" });
    expect(jobs![0].lessons).toEqual(["Never include funding announcements."]);
  });
});

describe("run lifecycle", () => {
  test("startRun marks working; failRun records the error and frees the agent", async () => {
    const office = t();
    const { agentId } = await office.mutation(api.agents.hire, hazel);
    const runId = await office.mutation(internal.runs.startRun, {
      agentId,
      trigger: "schedule",
    });

    let state = await office.query(api.work.statusForAgent, { agentId });
    expect(state?.status).toBe("working");
    expect(state?.runs[0].status).toBe("running");

    await office.mutation(internal.runs.failRun, { runId, error: "feed timeout" });
    state = await office.query(api.work.statusForAgent, { agentId });
    expect(state?.status).toBe("idle");
    expect(state?.runs[0]).toMatchObject({ status: "failed", error: "feed timeout" });
  });

  test("parallel runs: the agent stays working until the LAST run finishes", async () => {
    const office = t();
    const { agentId } = await office.mutation(api.agents.hire, hazel);
    const runA = await office.mutation(internal.runs.startRun, {
      agentId,
      trigger: "chat",
      task: "task A",
    });
    const runB = await office.mutation(internal.runs.startRun, {
      agentId,
      trigger: "chat",
      task: "task B",
    });

    let state = await office.query(api.work.statusForAgent, { agentId });
    expect(state?.status).toBe("working");
    expect(state?.runs.filter((r) => r.status === "running")).toHaveLength(2);

    await office.mutation(internal.runs.failRun, { runId: runA, error: "x" });
    state = await office.query(api.work.statusForAgent, { agentId });
    expect(state?.status).toBe("working"); // runB still going

    const artifactId = await office.mutation(internal.runs.saveArtifact, {
      agentId,
      runId: runB,
      kind: "note",
      title: "B",
      contentMd: "b",
      version: 1,
      sources: [],
    });
    await office.mutation(internal.runs.finishRun, { runId: runB, artifactId });
    state = await office.query(api.work.statusForAgent, { agentId });
    expect(state?.status).toBe("idle");
  });

  test("finishRun links the artifact and the docs become readable", async () => {
    const office = t();
    const { agentId } = await office.mutation(api.agents.hire, hazel);
    const runId = await office.mutation(internal.runs.startRun, {
      agentId,
      trigger: "chat",
    });
    const artifactId = await office.mutation(internal.runs.saveArtifact, {
      agentId,
      runId,
      kind: "brief",
      title: "Daily Tech Brief — 2026-08-31",
      contentMd: "# Daily Tech Brief\n\ncontent",
      version: 1,
      sources: [{ title: "HN", url: "https://news.ycombinator.com" }],
    });
    await office.mutation(internal.runs.finishRun, { runId, artifactId, costUsd: 0 });

    const state = await office.query(api.work.statusForAgent, { agentId });
    expect(state?.status).toBe("idle");
    expect(state?.runs[0].status).toBe("done");

    const docs = await office.query(api.artifacts.docsForAgent, { agentName: "Hazel" });
    expect(docs).toHaveLength(1);
    expect(docs![0]).toMatchObject({ title: "Daily Tech Brief — 2026-08-31", version: 1 });

    const read = await office.query(api.artifacts.readDoc, { agentName: "Hazel" });
    expect(read?.doc?.contentMd).toContain("content");
  });
});
