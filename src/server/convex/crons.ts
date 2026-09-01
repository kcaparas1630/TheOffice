import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 15:00 UTC ≈ 08:00 PT. Static; per-job schedules move to @convex-dev/crons
// when that's earned (v3+) — jobs.schedule is informational until then.
// DST drift accepted.
crons.daily("daily jobs", { hourUTC: 15, minuteUTC: 0 }, internal.pipeline.runScheduledJobs, {});

export default crons;
