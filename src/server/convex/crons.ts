import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 15:00 UTC ≈ 08:00 PT. Static; per-job schedules move to @convex-dev/crons
// when that's earned (v3+) — jobs.schedule is informational until then.
// DST drift accepted.
crons.daily("daily jobs", { hourUTC: 15, minuteUTC: 0 }, internal.briefs.runScheduledJobs, {});

// The office heartbeat: during working hours, idle agents get a turn to
// decide what to do next (src/server/convex/heartbeat.ts).
crons.interval("office heartbeat", { minutes: 10 }, internal.heartbeat.tick, {});

// Close out runs whose process died before it could report back.
crons.interval("reap stale runs", { minutes: 15 }, internal.runs.reapStaleRuns, {});

export default crons;
