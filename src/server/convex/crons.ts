import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 14:00 UTC ≈ 07:00 PT. Static per spec; jobs-as-data pick their own
// schedules via @convex-dev/crons when that's earned (v3+). DST drift accepted.
crons.daily("daily jobs", { hourUTC: 14, minuteUTC: 0 }, internal.pipeline.runScheduledJobs, {});

export default crons;
