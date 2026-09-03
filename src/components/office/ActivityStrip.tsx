"use client";

// The records the office animates from, in plain text: recent runs with
// their status, who ran them, and a link to whatever they produced.
import type { Id } from "@/server/convex/_generated/dataModel";
import type { Snapshot } from "./OfficeCanvas";
import { duration, timeAgo } from "@/lib/time";

const GLYPH: Record<Snapshot["runs"][number]["status"], { text: string; className: string }> = {
  queued: { text: "○", className: "text-muted" },
  running: { text: "●", className: "text-working animate-pulse" },
  done: { text: "✓", className: "text-working" },
  failed: { text: "✗", className: "text-failed" },
};

export function ActivityStrip({
  runs,
  now,
  onOpenArtifact,
  onSelectAgent,
}: {
  runs: Snapshot["runs"];
  now: number;
  onOpenArtifact: (id: Id<"artifacts">) => void;
  onSelectAgent: (agentId: string) => void;
}) {
  const shown = runs.slice(0, 8);
  return (
    <section className="border-t border-hairline px-4 py-2 text-xs font-mono">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-muted uppercase tracking-wider text-[10px]">Activity</h2>
        <span className="text-muted">
          {runs.filter((r) => r.status === "running").length} running
        </span>
      </div>
      {shown.length === 0 ? (
        <p className="text-muted">No runs yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {shown.map((run) => {
            const glyph = GLYPH[run.status];
            return (
              <li key={run._id} className="flex items-baseline gap-2 truncate">
                <span className={glyph.className}>{glyph.text}</span>
                <button
                  onClick={() => onSelectAgent(run.agentId)}
                  className="font-semibold hover:underline"
                >
                  {run.agentName}
                </button>
                {run.parentRunId && <span className="text-muted">↳</span>}
                <span className="truncate">{run.label}</span>
                <span className="text-muted">{run.trigger}</span>
                <span className="text-muted ml-auto shrink-0">
                  {run.status === "running"
                    ? `${duration(run.startedAt, now)} so far`
                    : timeAgo(run.finishedAt ?? run.startedAt, now)}
                </span>
                {run.artifactId && (
                  <button
                    onClick={() => onOpenArtifact(run.artifactId!)}
                    className="shrink-0 text-accent hover:underline"
                  >
                    open
                  </button>
                )}
                {run.error && (
                  <span className="shrink-0 text-failed" title={run.error}>
                    error
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
