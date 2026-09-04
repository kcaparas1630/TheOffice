// Metrics: what "a successful week" means for a role, scored from records.
//
// A role metric is a statement, a target, and a *measure* — the thing the
// office actually counts. Measures are computed here from run and artifact
// rows, never by the model, so a scorecard can only say what the records
// say. Metrics that need a source the office lacks (calendar, bank data,
// analytics, health) use the `manual` measure and show as "not tracked yet".

export type Better = "higher" | "lower";

export interface MeasureSpec {
  label: string;
  unit: "%" | "count";
  better: Better;
  how: string;
}

export const MEASURES = {
  "delegations.reported_same_day": {
    label: "Delegations reported back within a day",
    unit: "%",
    better: "higher",
    how: "Of the tasks this person handed out that finished in the window, the share that finished within 24 hours.",
  },
  "delegations.open_over_day": {
    label: "Delegations still open after a day",
    unit: "count",
    better: "lower",
    how: "Tasks this person handed out that are still running more than 24 hours later.",
  },
  "delegations.made": {
    label: "Tasks delegated",
    unit: "count",
    better: "higher",
    how: "Tasks this person handed to someone else in the window.",
  },
  "runs.completed": {
    label: "Runs completed",
    unit: "count",
    better: "higher",
    how: "This person's own runs that finished successfully in the window.",
  },
  "runs.failed": {
    label: "Runs failed",
    unit: "count",
    better: "lower",
    how: "This person's own runs that failed in the window.",
  },
  "jobs.on_time": {
    label: "Scheduled jobs delivered",
    unit: "count",
    better: "higher",
    how: "Scheduled (cron) runs that finished successfully in the window.",
  },
  "artifacts.delivered": {
    label: "Documents delivered",
    unit: "count",
    better: "higher",
    how: "Documents this person produced in the window.",
  },
  manual: {
    label: "Not tracked yet",
    unit: "count",
    better: "higher",
    how: "Needs a source the office does not have yet (calendar, bank export, analytics, health data). Never scored by the model.",
  },
} as const satisfies Record<string, MeasureSpec>;

export type MeasureId = keyof typeof MEASURES;
export const MEASURE_IDS = Object.keys(MEASURES) as MeasureId[];
export const isMeasureId = (x: string): x is MeasureId => x in MEASURES;

// One line of a role's "successful week".
export interface RoleMetric {
  statement: string;
  target: number;
  unit: string; // "%", "count", or a word like "days"
  measure: string; // a MeasureId; unknown ids behave like "manual"
}

export const SCORE_WINDOW_MS = 7 * 86_400_000;
export const SAME_DAY_MS = 86_400_000;

export interface RunRow {
  agentId: string;
  parentAgentId?: string | null; // who delegated this run, when it is a child run
  trigger: string;
  status: string;
  startedAt: number;
  finishedAt?: number | null;
}

// Everything the measures need, already narrowed to the window: the person's
// own runs, runs they delegated (parentAgentId === agentId), and when their
// documents were produced.
export interface RecordWindow {
  agentId: string;
  now: number;
  runs: RunRow[];
  artifactsAt: number[];
}

export function computeMeasures(w: RecordWindow): Record<MeasureId, number | null> {
  const since = w.now - SCORE_WINDOW_MS;
  const inWindow = (t: number) => t >= since && t <= w.now;
  const own = w.runs.filter((r) => r.agentId === w.agentId && inWindow(r.startedAt));
  const delegated = w.runs.filter((r) => r.parentAgentId === w.agentId);
  const delegatedInWindow = delegated.filter((r) => inWindow(r.startedAt));
  const finishedDelegations = delegatedInWindow.filter((r) => r.finishedAt != null);
  const sameDay = finishedDelegations.filter((r) => (r.finishedAt ?? 0) - r.startedAt <= SAME_DAY_MS);

  return {
    "delegations.reported_same_day":
      finishedDelegations.length === 0 ? null : Math.round((100 * sameDay.length) / finishedDelegations.length),
    "delegations.open_over_day": delegated.filter((r) => r.status === "running" && w.now - r.startedAt > SAME_DAY_MS)
      .length,
    "delegations.made": delegatedInWindow.length,
    "runs.completed": own.filter((r) => r.status === "done").length,
    "runs.failed": own.filter((r) => r.status === "failed").length,
    "jobs.on_time": own.filter((r) => r.trigger === "schedule" && r.status === "done").length,
    "artifacts.delivered": w.artifactsAt.filter(inWindow).length,
    manual: null,
  };
}

export interface MetricScore extends RoleMetric {
  value: number | null; // null = not tracked yet
  met: boolean | null;
}

export function scoreMetrics(metrics: RoleMetric[], values: Record<MeasureId, number | null>): MetricScore[] {
  return metrics.map((m) => {
    const id: MeasureId = isMeasureId(m.measure) ? m.measure : "manual";
    const value = values[id];
    if (value === null || value === undefined) return { ...m, value: null, met: null };
    const met = MEASURES[id].better === "higher" ? value >= m.target : value <= m.target;
    return { ...m, value, met };
  });
}

export function formatMetric(m: MetricScore): string {
  const target = `${m.target}${m.unit === "%" ? "%" : ` ${m.unit}`}`.replace(/ count$/, "");
  if (m.value === null) return `${m.statement} — target ${target} — not tracked yet`;
  const value = m.unit === "%" ? `${m.value}%` : `${m.value}`;
  return `${m.statement} — ${value} of ${target} — ${m.met ? "met" : "behind"}`;
}

// Parse a one-per-line editor format: "statement | target unit | measure".
export function parseMetricLine(line: string): RoleMetric | null {
  const parts = line.split("|").map((p) => p.trim());
  if (parts.length < 2 || !parts[0]) return null;
  const m = /^(-?\d+(?:\.\d+)?)\s*(.*)$/.exec(parts[1]);
  if (!m) return null;
  const unit = (m[2] || "count").trim();
  const measure = parts[2] && isMeasureId(parts[2]) ? parts[2] : "manual";
  return { statement: parts[0], target: Number(m[1]), unit, measure };
}

export function formatMetricLine(m: RoleMetric): string {
  return `${m.statement} | ${m.target} ${m.unit} | ${m.measure}`;
}
