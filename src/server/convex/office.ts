// The office viewer's single reactive snapshot: cast + live runs + recent
// documents. The pixel office animates directly off these records (spec
// principle #5) — nothing here is prose, and the client never invents state.
import { query } from "./_generated/server";
import { officeSettings } from "./settings";

const RECENT_RUNS = 40;
const RECENT_ARTIFACTS = 30;
const RECENT_TURNS = 12;

export const snapshot = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    const runs = await ctx.db.query("runs").order("desc").take(RECENT_RUNS);
    const artifacts = await ctx.db.query("artifacts").order("desc").take(RECENT_ARTIFACTS);
    const turns = await ctx.db.query("turns").order("desc").take(RECENT_TURNS);
    const settings = await officeSettings(ctx);
    const jobs = await ctx.db.query("jobs").collect();
    const roles = await ctx.db.query("roles").collect();
    const holds = await ctx.db.query("agentSkills").collect();
    const skills = await ctx.db.query("skills").collect();
    const skillName = new Map(skills.map((s) => [s._id, s.name]));
    const roleName = new Map(roles.map((r) => [r._id, r.roleName]));
    const jobTitle = new Map(jobs.map((j) => [j._id, j.title]));
    const agentName = new Map(agents.map((a) => [a._id, a.name]));

    return {
      timeZone: settings.timeZone,
      heartbeat: settings.heartbeat,
      turns: turns.map((t) => ({
        _id: t._id,
        agentId: t.agentId,
        agentName: agentName.get(t.agentId) ?? "?",
        at: t.at,
        phase: t.phase,
        action: t.action,
        summary: t.summary,
        runId: t.runId ?? null,
      })),
      agents: agents.map((a) => ({
        _id: a._id,
        name: a.name,
        jobTitle: a.jobTitle,
        roleId: a.roleId ?? null,
        roleName: a.roleId ? (roleName.get(a.roleId) ?? null) : null,
        jobDescription: a.jobDescription,
        successfulDay: a.successfulDay,
        notes: a.personality.notes,
        status: a.status,
        traits: a.personality.traits,
        supervisorId: a.supervisorId ?? null,
        supervisorName: a.supervisorId ? (agentName.get(a.supervisorId) ?? null) : null,
        sprite: a.sprite ?? null,
        hiredAt: a._creationTime,
        skills: holds
          .filter((h) => h.agentId === a._id)
          .map((h) => ({ skillId: h.skillId, name: skillName.get(h.skillId) ?? "?", level: h.level, uses: h.uses }))
          .sort((x, y) => y.level - x.level || x.name.localeCompare(y.name)),
      })),
      roles: roles
        .map((r) => ({
          _id: r._id,
          roleName: r.roleName,
          roleDescription: r.roleDescription,
          department: r.department ?? null,
          supervisorId: r.supervisorId ?? null,
          duties: r.duties ?? [],
          metrics: r.metrics ?? [],
        }))
        .sort((a, b) => (a.department ?? "").localeCompare(b.department ?? "") || a.roleName.localeCompare(b.roleName)),
      jobs: jobs.map((j) => ({
        _id: j._id,
        agentId: j.agentId,
        title: j.title,
        schedule: j.schedule,
        active: j.active,
        lessons: j.lessons,
        feeds: (j.feeds ?? []).map((f) => f.name),
      })),
      runs: runs.map((r) => ({
        _id: r._id,
        agentId: r.agentId,
        agentName: agentName.get(r.agentId) ?? "?",
        parentRunId: r.parentRunId ?? null,
        trigger: r.trigger,
        status: r.status,
        label: r.task ?? (r.jobId ? jobTitle.get(r.jobId) : undefined) ?? "run",
        startedAt: r.startedAt,
        finishedAt: r.finishedAt ?? null,
        artifactId: r.artifactId ?? null,
        error: r.error ?? null,
        costUsd: r.costUsd ?? null,
      })),
      artifacts: artifacts.map((a) => ({
        _id: a._id,
        agentId: a.agentId,
        agentName: agentName.get(a.agentId) ?? "?",
        kind: a.kind,
        title: a.title,
        version: a.version,
        createdAt: a._creationTime,
      })),
    };
  },
});
