# 🏢 The Office

A curation of AI agents doing work. You are the CEO; you hire agents, give them real job descriptions, shape their personalities, and talk to them in the terminal with `@Name`.

**v1 is headless** — everything runs in the terminal. The pixel office (sprites, v2) renders on top of the same data later.

## Milestones

- [x] **M1 — Foundation**: agent model + personality, `/hire` wizard, `@Name` chat grounded in real work state, vitest suite
- [ ] **M2 — The job pipeline**: feeds → daily brief artifact, manual trigger + cron, revisions ("redo it because X")
- [ ] **M3 — Outbound email**: the agent emails the brief to the CEO (send-only)
- [ ] **M4 — Delegation**: hire a second agent, first agent supervises, delegate simple tasks as structured child runs

## Setup

```sh
npm install

# 1. Start the local Convex backend (no account needed) and keep it running:
npx convex dev

# 2. Give the office an LLM (in another terminal):
npx convex env set OPENROUTER_API_KEY sk-or-...
# optional: npx convex env set OPENROUTER_MODEL anthropic/claude-haiku-4.5

# 3. Open the office:
npm run office
```

## Using the office

```
you> /hire                      # interactive: name, job title, real job description,
                                # "a successful day would be:", personality traits
you> /roster                    # who works here
you> @Edna introduce yourself   # talk to an agent
you> /status Edna               # her real work state (runs, jobs, documents)
you> /supervisor Milton Edna    # Edna now supervises Milton
you> /fire Milton               # remove an agent and their records
```

Agents answer status questions **only from real task state** stored in Convex — an agent with no runs will tell you they haven't done anything yet, not invent progress.

## Development

```sh
npm test            # vitest: unit tests + convex-test backend tests
npx tsc --noEmit    # typecheck
npx tsx scripts/smoke.ts   # end-to-end check against the running local backend
```

Repo layout and conventions: see [AGENTS.md](AGENTS.md). Original spec: `pixel-office-v1-spec.md` (job descriptions, headless-first, and delegation-in-v1-scope are deliberate departures from it).
