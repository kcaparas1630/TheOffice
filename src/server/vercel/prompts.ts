// Pure prompt construction — no I/O, fully unit-testable.
// The persona is built from the agent's profile (job description + personality),
// and grounded with hard rules so status answers come from real work state only.

export interface AgentProfile {
  name: string;
  jobTitle: string;
  jobDescription: string;
  successfulDay: string[];
  personality: {
    traits: string[];
    notes: string;
  };
  // Skills on record, with a 1–5 level. Absent = none known.
  skills?: { name: string; level: number }[];
}

const SKILL_LEVEL_WORDS = ["", "learning", "working", "solid", "strong", "expert"];

export interface WorkState {
  status: "idle" | "working";
  supervisorName?: string;
  reportNames: string[]; // agents this one supervises
  jobs: { title: string; schedule: string; active: boolean }[];
  runs: {
    trigger: string;
    status: string;
    startedAt: number;
    finishedAt?: number;
    error?: string;
    task?: string;
  }[];
  artifacts: { title: string; kind: string; version: number; createdAt: number }[];
}

export function buildSystemPrompt(profile: AgentProfile): string {
  const traits = profile.personality.traits.join(", ");
  const lines = [
    `You are ${profile.name}, the ${profile.jobTitle} at Kent's office ("The Office").`,
    `You report to Kent, the CEO. You are a colleague, not a chatbot.`,
    ``,
    `## Your job description`,
    profile.jobDescription,
    ``,
    `## A successful day for you looks like`,
    ...profile.successfulDay.map((item) => `- ${item}`),
    ``,
    `## Your personality`,
    traits ? `Traits: ${traits}.` : `Traits: none specified — stay neutral and professional.`,
  ];
  if (profile.personality.notes.trim()) {
    lines.push(profile.personality.notes.trim());
  }
  if (profile.skills && profile.skills.length > 0) {
    lines.push(``, `## Your skills (on record)`);
    for (const s of profile.skills) {
      const word = SKILL_LEVEL_WORDS[Math.min(5, Math.max(1, Math.round(s.level)))];
      lines.push(`- ${s.name} — level ${Math.round(s.level)}/5 (${word})`);
    }
    lines.push(`Claim only these skills. Let the level set how confident and detailed you are with each.`);
  }
  lines.push(
    ``,
    `Let your personality shape your tone and word choice, never the facts.`,
    ``,
    `## Hard rules`,
    `- Report status ONLY from the work state provided below. If the state does not contain the answer, say so plainly. Never invent progress, runs, or documents.`,
    `- When criticized, extract the concrete standard being applied and improve against it — don't apologize, improve.`,
    `- Keep replies terminal-friendly: short paragraphs, no decorative headers unless asked.`
  );
  return lines.join("\n");
}

const fmtTime = (ms: number) => new Date(ms).toISOString().replace("T", " ").slice(0, 16) + " UTC";

export function formatWorkState(state: WorkState): string {
  const lines = [`## Your current work state (source of truth — do not contradict it)`];
  lines.push(`Status: ${state.status}`);
  if (state.supervisorName) lines.push(`You report to: ${state.supervisorName}`);
  if (state.reportNames.length > 0) lines.push(`You supervise: ${state.reportNames.join(", ")}`);

  if (state.jobs.length === 0) {
    lines.push(`Standing jobs: none assigned yet.`);
  } else {
    lines.push(`Standing jobs:`);
    for (const job of state.jobs) {
      lines.push(`- ${job.title} (schedule: ${job.schedule}, ${job.active ? "active" : "paused"})`);
    }
  }

  if (state.runs.length === 0) {
    lines.push(`Recent runs: none — you have not executed any tasks yet.`);
  } else {
    lines.push(`Recent runs (newest first):`);
    for (const run of state.runs) {
      const finished = run.finishedAt ? `, finished ${fmtTime(run.finishedAt)}` : "";
      const error = run.error ? `, error: ${run.error}` : "";
      const task = run.task ? `, task: "${run.task}"` : "";
      lines.push(
        `- [${run.status}] trigger=${run.trigger}, started ${fmtTime(run.startedAt)}${finished}${task}${error}`
      );
    }
  }

  if (state.artifacts.length === 0) {
    lines.push(`Documents produced: none yet.`);
  } else {
    lines.push(`Documents produced (newest first):`);
    for (const artifact of state.artifacts) {
      lines.push(
        `- "${artifact.title}" (${artifact.kind} v${artifact.version}, ${fmtTime(artifact.createdAt)})`
      );
    }
  }
  return lines.join("\n");
}
