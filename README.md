# 🏢 The Office

A curation of AI agents doing work. You are the CEO; you hire agents, give them real job descriptions, shape their personalities, and talk to them in the terminal with `@Name`.

**v1 is headless** — everything runs in the terminal. The pixel office (sprites, v2) renders on top of the same data later.

## Milestones

- [x] **M1 — Foundation**: agent model + personality, `/hire` wizard, `@Name` chat grounded in real work state, vitest suite
- [x] **M2 — The job pipeline**: feeds (HN + RSS) → daily brief artifact, manual trigger + 14:00 UTC cron, revisions with lessons accretion
- [x] **M3 — Outbound email**: scheduled briefs are emailed to the CEO via Resend (send-only; inbound never)
- [x] **M4 — Delegation**: supervisors hand tasks to their reports as structured child runs (one level max); the worker's report artifact closes both runs

## Setup

```sh
npm install

# 1. Start the local Convex backend (no account needed) and keep it running:
npx convex dev

# 2. Give the office an LLM (in another terminal):
npx convex env set OPENROUTER_API_KEY sk-or-...
# optional: npx convex env set OPENROUTER_MODEL anthropic/claude-haiku-4.5

# 3. (Optional) Email delivery of scheduled briefs — resend.com free tier:
npx convex env set RESEND_API_KEY re_...
npx convex env set OFFICE_CEO_EMAIL you@example.com
# optional custom sender (needs a verified domain on Resend):
# npx convex env set OFFICE_EMAIL_FROM "Edna <edna@yourdomain.com>"

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

you> /assign Edna               # give her a standing job (spec = what "good" means)
you> /run Edna                  # run it now instead of waiting for the daily cron
you> /docs Edna                 # documents she has produced
you> /read Edna                 # print the latest one
you> /redo Edna too long, cut the fluff   # revision; the critique is distilled
                                          # into a durable lesson for future runs
you> /email Edna                # email her latest document to the CEO now
                                # (cron-scheduled briefs email automatically)

you> /task Edna write a report on X   # assign work to anyone; if they lead a
                                # team, THEY decide (against their reports' job
                                # descriptions) whether to keep it or delegate.
                                # After a delegation, the supervisor reports
                                # back with a covering brief (emailed if
                                # configured) with the full report attached
you> /delegate Edna Milton write a primer on X   # force the routing yourself:
                                # parent run on Edna, child run on Milton

you> /task Edna research X &    # append & to /task or /run to dispatch in the
you> /run Edna &                # background — agents work in parallel; watch
                                # /roster, results land in /docs and email
```

Agents answer status questions **only from real task state** stored in Convex — an agent with no runs will tell you they haven't done anything yet, not invent progress.

## Development

```sh
npm test            # vitest: unit tests + convex-test backend tests
npx tsc --noEmit    # typecheck
npx tsx scripts/smoke.ts   # end-to-end check against the running local backend
```

Repo layout and conventions: see [AGENTS.md](AGENTS.md). Original spec: `pixel-office-v1-spec.md` (job descriptions, headless-first, and delegation-in-v1-scope are deliberate departures from it).
