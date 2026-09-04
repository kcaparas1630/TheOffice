import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Roles are defined once and assigned to people. A role carries the job
  // title and the real job description; the org chart lives here too (a
  // role may report to another role). Grouped into departments by name.
  roles: defineTable({
    roleName: v.string(), // "Receptionist"
    roleDescription: v.string(), // a description of the job, not a command
    department: v.optional(v.string()), // "Front desk", "Sales", …
    supervisorId: v.optional(v.id("roles")), // the role this one reports to
    duties: v.optional(v.array(v.string())), // what the holder does on a turn
    // A successful week, scored from records (src/lib/metrics.ts): each line
    // names the measure the office counts; "manual" = not tracked yet.
    metrics: v.optional(
      v.array(v.object({ statement: v.string(), target: v.number(), unit: v.string(), measure: v.string() }))
    ),
  }).index("by_name", ["roleName"]),

  // The skills catalogue: imported from Smithery's registry or hand-made.
  // A skill is knowledge (its prompt text) plus, later, tools from the
  // repo's registry keyed by slug. Nothing imported ever executes.
  skills: defineTable({
    name: v.string(),
    slug: v.string(), // "namespace/slug" (Smithery) or a plain slug (custom); unique
    description: v.string(),
    category: v.optional(v.string()),
    source: v.union(v.literal("smithery"), v.literal("custom")),
    namespace: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    hasPrompt: v.boolean(), // instructions live in `skillPrompts` (they can be long)
    verified: v.boolean(),
    popularity: v.number(), // activations on the registry; sort key for pickers
    importedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_popularity", ["popularity"]),

  // SKILL.md-style instructions, one per skill, read only when a prompt is
  // built or the skill is opened — never when listing the catalogue.
  skillPrompts: defineTable({
    skillId: v.id("skills"),
    prompt: v.string(),
  }).index("by_skill", ["skillId"]),

  // Who holds which skill, at what level (1–5). `uses` counts completed runs
  // that invoked the skill's tools; the level only ever rises from it.
  agentSkills: defineTable({
    agentId: v.id("agents"),
    skillId: v.id("skills"),
    level: v.number(),
    uses: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_skill", ["skillId"]),

  // The cast. Each agent is data — it "comes alive" only when a cron or
  // mention invokes a function that loads its row and calls the LLM.
  agents: defineTable({
    roleId: v.optional(v.id("roles")), // the role they hold; title/description copy from it
    name: v.string(), // "Edna" — addressed in chat as @Edna
    jobTitle: v.string(), // "CTO"
    // A real job description (prose), not a command.
    jobDescription: v.string(),
    // "A successful day would be:" — one bullet per entry.
    successfulDay: v.array(v.string()),
    personality: v.object({
      traits: v.array(v.string()), // e.g. ["jolly", "optimistic"] or ["strict", "pessimistic"]
      notes: v.string(), // free-form detail about how they carry themselves
    }),
    supervisorId: v.optional(v.id("agents")), // set when this agent reports to another
    sprite: v.optional(v.string()), // chosen look (see src/lib/office/sprites.ts); absent = auto
    status: v.union(v.literal("idle"), v.literal("working")),
    chatThreadId: v.optional(v.string()), // @convex-dev/agent thread for this agent's chat
    // future: per-agent provider/model config
  }).index("by_name", ["name"]),

  // Recurring mandates owned by an agent (e.g. "Daily Tech Brief").
  jobs: defineTable({
    agentId: v.id("agents"),
    title: v.string(),
    schedule: v.string(), // cron expr, informational in v1
    spec: v.string(), // what "good" means — used in prompts AND critiques
    lessons: v.array(v.string()), // durable rules distilled from critiques
    // Per-job source list; absent = office defaults (DEFAULT_FEEDS).
    feeds: v.optional(v.array(v.object({ name: v.string(), url: v.string() }))),
    active: v.boolean(),
  }).index("by_agent", ["agentId"]),

  // Every execution of a job or ad-hoc request.
  runs: defineTable({
    jobId: v.optional(v.id("jobs")),
    agentId: v.id("agents"),
    parentRunId: v.optional(v.id("runs")), // delegation = child run, one level max
    trigger: v.union(v.literal("schedule"), v.literal("chat"), v.literal("delegation")),
    task: v.optional(v.string()), // what was asked, recorded on the run itself
    skillIds: v.optional(v.array(v.id("skills"))), // skills whose tools this run invoked
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("done"),
      v.literal("failed")
    ),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    artifactId: v.optional(v.id("artifacts")),
    error: v.optional(v.string()),
    costUsd: v.optional(v.number()),
  }).index("by_agent", ["agentId"]),

  // Addressable outputs; the knowledge-base seed.
  artifacts: defineTable({
    agentId: v.id("agents"),
    runId: v.id("runs"),
    kind: v.union(v.literal("brief"), v.literal("report"), v.literal("note")),
    title: v.string(),
    contentMd: v.string(),
    version: v.number(),
    parentId: v.optional(v.id("artifacts")), // revision lineage v1 -> v2
    sources: v.array(v.object({ title: v.string(), url: v.string() })),
  })
    .index("by_agent", ["agentId"])
    .index("by_parent", ["parentId"]),
});
