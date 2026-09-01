# Pixel Office — v1 Spec ("Edna, headless")

**Status:** Draft v2 (updated with post-review decisions)
**Owner:** Kent
**Scope:** One agent, one job, chat interface. No office graphics, no delegation.

---

## 1. Goal

Prove the core loop is fun and useful before building the pixel office:

> A named agent (Edna) runs a scheduled daily tech brief, stores it as an addressable document, and can be @-mentioned in chat to report status, answer questions about her work, and revise outputs.

**Success criteria (2 weeks after ship):**
- Kent still reads the daily brief.
- At least one revision request ("this sucks, redo it because X") produced a meaningfully better v2.
- @Edna status answers reflect real task state, never hallucinated progress.

## 2. Non-Goals (v1)

- ❌ Pixel office rendering (v2 — read-only viewer over run/artifact state)
- ❌ Multiple agents / delegation (v3 — Edna + one worker)
- ❌ Agent creation/CRUD UI (Edna is seeded in code; admin tooling earns its place in v3+)
- ❌ Interrupting a running task mid-flight
- ❌ Multi-level delegation chains (explicitly never; one level max)
- ❌ Finance agent (v4 — see §10 principles, decided now so nothing blocks it later)
- ❌ Inbound channels (agents never read email/inboxes — see §10)

## 3. Architecture

```
┌─────────────────────────────┐
│  Next.js app                │
│  ┌──────────────────────┐   │
│  │ Chat UI (@mentions)  │◄──┼── Convex reactive queries
│  └──────────────────────┘   │    (free real-time, no SSE wiring)
└─────────────┬───────────────┘
              │ mutations / actions
┌─────────────▼───────────────┐
│  Convex (the whole runtime) │
│  • schema (below)           │
│  • @convex-dev/agent        │  ← chat threads, history, KB search
│  • built-in cron: dailyBrief│  ← crons.ts, static; UTC times
│  • action: runTask          │  ← fetch feeds → LLM filter/synth
└─────────────┬───────────────┘
              │ Vercel AI SDK 7 (pinned)
      ┌───────▼────────┐   ┌────────────────────┐
      │ OpenRouter     │   │ Free feed sources  │
      │ (cheap model,  │   │ • HN Algolia API   │
      │  Haiku/Flash   │   │ • 2–4 RSS feeds    │
      │  class)        │   └────────────────────┘
      └────────────────┘
```

**LLM client (decided):** Vercel AI SDK 7, pinned — used as *provider abstraction + typed generation only* (`generateText`, `generateObject` with Zod). Its Agent/ToolLoopAgent/WorkflowAgent abstractions are **not** used: orchestration lives in Convex as task records (our design), not inside an SDK loop. Provider behind the SDK is OpenRouter for v1 (public data, model flexibility); per-agent provider config later makes direct-Anthropic or Ollama a field change, not a migration.

**Agents are data, not processes.** An agent exists as rows (agent + jobs + runs + artifacts). It "comes alive" only when a cron or mention invokes a Convex function that loads its row and calls the LLM. Nothing to keep alive, nothing to crash — this is also why "web is fragile for background agents" doesn't apply: nothing agentic runs in the browser.

**Key pipeline principle:** feeds are fetched deterministically (cheap, no hallucination surface); the LLM only filters, ranks, and synthesizes. No open-ended web search in v1.

**Scheduling (decided):** Convex built-in crons (`crons.ts`), no external scheduler ever. Times are UTC — 7:00 PT brief ≈ `0 14 * * *`; accept DST drift in v1. One-shot retries via `ctx.scheduler.runAfter` if flakiness ever warrants it. When jobs become user-created data (v3+), migrate schedules to the first-party `@convex-dev/crons` component for runtime registration.

## 4. Convex Schema

```ts
// agents — seeded, not user-created in v1
agents: defineTable({
  name: v.string(),              // "Edna"
  role: v.string(),              // "Supervisor" (cosmetic in v1)
  jobDescription: v.string(),    // standing mandate (see §6)
  systemPrompt: v.string(),      // persona + rules
  status: v.union(v.literal("idle"), v.literal("working")),
  // future: provider/model config per agent (finance → direct key or Ollama)
})

// jobs — recurring mandates owned by an agent
jobs: defineTable({
  agentId: v.id("agents"),
  title: v.string(),             // "Daily Tech Brief"
  schedule: v.string(),          // cron expr, informational in v1
  spec: v.string(),              // what "good" means — used in prompts AND critiques
  lessons: v.array(v.string()),  // v1.1: durable rules distilled from critiques
  schema: v.optional(v.string()),// optional JSON Schema for structured output
                                 // (v1: hand-written for the brief; schema
                                 //  accretion/derivation deferred until a second
                                 //  task type actually exists)
  active: v.boolean(),
})

// runs — every execution of a job or ad-hoc request
runs: defineTable({
  jobId: v.optional(v.id("jobs")),
  agentId: v.id("agents"),
  parentRunId: v.optional(v.id("runs")), // unused until v3; delegation = child run
  trigger: v.union(v.literal("schedule"), v.literal("chat")),
  status: v.union(
    v.literal("queued"), v.literal("running"),
    v.literal("done"), v.literal("failed")
  ),
  startedAt: v.number(),
  finishedAt: v.optional(v.number()),
  artifactId: v.optional(v.id("artifacts")),
  error: v.optional(v.string()),
  costUsd: v.optional(v.number()),   // verify "basically free" instead of assuming
}).index("by_agent", ["agentId"])

// artifacts — addressable outputs; the knowledge-base seed
artifacts: defineTable({
  agentId: v.id("agents"),
  runId: v.id("runs"),
  kind: v.union(v.literal("brief"), v.literal("report"), v.literal("note")),
  title: v.string(),
  contentMd: v.string(),
  version: v.number(),
  parentId: v.optional(v.id("artifacts")),  // revision lineage v1 → v2
  sources: v.array(v.object({ title: v.string(), url: v.string() })),
}).index("by_agent", ["agentId"]).index("by_parent", ["parentId"])

// messages — REMOVED. Chat threads, message history, and context management
// are owned by the first-party @convex-dev/agent component (built on AI SDK).
// Edna = one Agent instance; artifact refs travel as message metadata.
```

**Two-layer split (decided):** `@convex-dev/agent` owns the **conversation layer** — threads, persistent history, context assembly, and (later) vector search over conversations/documents for the knowledge base. Our tables above own the **work layer** — jobs, runs, artifacts, delegation records. The component never owns orchestration; principle #5 (§10) is unchanged.

## 5. Core Flows

### 5.1 Scheduled daily brief
1. Convex cron fires `dailyBrief` (14:00 UTC ≈ 07:00 PT).
2. Create `run` (`running`), set Edna `working`.
3. Fetch candidates deterministically: HN Algolia top stories (last 24h, points threshold) + RSS feeds (start: Simon Willison, Anthropic news, Latent Space; tune weekly).
4. One `generateObject` call: filter/rank per `jobs.spec` + `jobs.lessons`, synthesize brief against the brief schema (items: headline, why-it-matters, url).
5. Write `artifact` (v1), close `run` (`done`), Edna `idle`.
6. Edna posts to chat: "Morning brief is ready" + artifact ref.

**Failure handling:** run → `failed` with `error`; Edna posts the failure. No silent losses. No auto-retry in v1 (graduate to scheduler-based retry / retrier component only if flakiness proves annoying).

### 5.2 @Edna status question
1. Mention → component-managed thread continuation (thread history handled automatically).
2. We inject **work-layer state** on top: last N runs with statuses/timestamps + recent artifact titles + `jobs.lessons`.
3. Rule: answer **from injected state only**; if state doesn't contain it, say so. Never invent progress.
4. Reply posts into the thread; UI renders reactively.

**Hour-one validation:** confirm the component's context assembly lets us inject run/job state per call alongside its thread history. Fallback if awkward: use it as message store only, compose prompts ourselves.

### 5.3 Revision request ("this report sucks, I want X")
1. Mention + artifact reference (v1 heuristic: latest artifact wins).
2. New `run` (trigger `chat`), context = original `contentMd` + critique + `jobs.spec`.
3. Output = new artifact, `version = parent + 1`, `parentId` set.
4. Edna replies linking the new version.
5. **v1.1 (lessons accretion):** after a revision, one extra LLM call distills the critique into a one-line durable rule appended to `jobs.lessons`, injected into all future runs. Critiques compound instead of evaporating.

## 6. Edna's Job Description (seed content)

> **Daily Tech Brief.** Every morning, find what changed in the last 24 hours that matters to someone building agentic AI systems and legal-tech products in Canada. Priorities: agent frameworks & SDK releases, Claude/Anthropic ecosystem changes, LLM capability or pricing shifts, legal-tech developments, notable engineering write-ups. Skip: funding announcements, consumer gadgets, opinion pieces with no new information. Format: 5–8 items max, one tight paragraph each, why-it-matters first, link every claim. If it was a slow day, say so — a short honest brief beats a padded one.

**System prompt rules (persona layer):**
- You are Edna, supervisor at Kent's office. Direct, dry, no filler.
- Report only from provided task state; admit gaps plainly.
- When criticized, extract the concrete standard being applied and revise against it — don't apologize, improve.

## 7. Chat UI (v1)

- Two-pane layout reserved (`[Office placeholder] | [Chat]`); office pane shows status text only ("Edna: working") until v2.
- No card containers — hairline dividers and typographic hierarchy.
- Markdown messages; artifact refs open a simple artifact view (title, version chain, content, sources).
- `@` mention picker (one entry; builds the habit).

## 8. Model & Cost

- Vercel AI SDK 7 → OpenRouter, cheap-tier model (Haiku/Flash class) for brief + chat.
- Expected: ~1 brief call + a handful of chat calls per day → cents/month. `runs.costUsd` verifies instead of assumes.
- No `:free` models — rate limits are the wrong failure mode for a cron job.

## 9. Build Sequence (revised)

1. **Dev env** — Convex + Next.js + AI SDK 7 (pinned) + OpenRouter key.
2. **Schema + seed Edna** — seed function, no CRUD UI.
3. **Brief pipeline** — feeds → `generateObject` → artifact; manual trigger for debugging.
4. **Stateful chat** — @Edna with injected run/artifact state.
5. **Cron** — ship the daily schedule (it's the value prop, not an enhancement).
6. **Two-week gate** — live with it. Brief worth reading + chat fun → v2 (office viewer). If not, fix the job spec, not the graphics.
7. **v3** — delegation: Edna + one worker.

**v1.1 (during/after the gate, small):**
- Lessons accretion (§5.3.5).
- Outbound-only notification: Edna emails the brief from her own dedicated account (send-only). Solves the "I won't see it until I open the tab" gap.

## 10. Security & Data Principles (decided now, enforced from v1)

These came out of the finance discussion but govern the whole office:

1. **Data flows down.** Agents pulling public sources (feeds) may be autonomous. Agents touching Kent's private data operate **only on what Kent explicitly hands them** (e.g., CSV drops for the future finance agent). No agent goes and *gets* personal data.
2. **LLMs see derived data, not raw sensitive data.** Deterministic code parses/aggregates; models receive summaries and pseudonymized aggregates. Applies regardless of provider. For anything that truly needs raw rows: local model (Ollama), per-agent config.
3. **No inbound channels.** Agents never read email/inboxes or any channel strangers can write to — untrusted input + write capability is the lethal combination. Send-only email is fine.
4. **Capability ladder.** Public reads: free. Writes to own Convex datastore: free. Outbound notifications to Kent: cheap. Any action in the world beyond that: specific justification + human approval. Finance agent is **read-only forever** — no credentials, no transaction capability.
5. **Records drive prose, never the reverse.** Inter-agent "communication" is structured task records (`parentRunId` child runs + artifacts + status). Flavor dialogue is cosmetic, generated *from* events, never load-bearing. Full observability, replayability, and the v2 office animates directly off the runs table.
6. **Client choice ≠ privacy.** The AI SDK is a library and adds no party to the data path; privacy is decided by provider config (OpenRouter vs direct vs local) per agent, and mostly by principle #2.

## 11. Open Questions (decide during build, don't block on)

- Exact RSS feed list (start with 2–3, tune weekly).
- Mention→artifact resolution with multiple artifacts (v1: latest-wins).
- Whether chat replies can be stored as `note` artifacts ("write that up") — cheap later via existing schema.
- DST handling for the cron (accept drift vs in-function check).
- Agent-component context assembly: per-call injection of run/job state alongside thread history (validate hour one).

## 12. Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Server-side agents, web as viewer | Browser can't background; Convex crons run regardless of client |
| 2 | Vercel AI SDK 7 (pinned) as client; skip its Agent framework | TS-native in Convex; orchestration stays in our task records |
| 3 | OpenRouter behind the SDK for v1; per-agent provider later | Public data now; direct/local keys become a config flip |
| 4 | No LiteLLM | Python-first proxy = always-on infra the architecture exists to avoid |
| 5 | Convex built-in crons; `@convex-dev/crons` when jobs become data | Native, durable, zero new services |
| 6 | No CRUD UI in v1; Edna seeded in code | Admin tooling for a cast that doesn't exist yet |
| 7 | Cron ships in v1, not as enhancement | The daily brief *is* the value prop and the gate metric |
| 8 | Delegation = structured child runs, not agent chat | Observable, replayable, drives office animation for free |
| 9 | Hand-written brief schema; schema accretion deferred | One task type = nothing to abstract over yet |
| 10 | Lessons accretion in v1.1 | Critiques become durable rules instead of evaporating |
| 11 | Finance agent: v4, CSV hand-down, derived-data-only, read-only | "Solely mine" delivered by design, not vendor choice |
| 12 | Send-only email OK; inbound channels never | Notification without an injection surface |
| 13 | `@convex-dev/agent` for conversation layer; work layer stays ours | First-party, deletes chat plumbing, adds KB vector search; jobs/runs/artifacts remain the domain model |
