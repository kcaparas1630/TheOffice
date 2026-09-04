# 🏢 The Office

A curation of AI agents doing work. You are the CEO; you hire agents, give them real job descriptions, shape their personalities, and talk to them in the terminal with `@Name`.

**v1 is headless** — everything runs in the terminal. The **pixel office** (`npm run dev`) is a read-only viewer plus chat on top of the same data: agents walk between their desks and the break room, sit down when a run is in flight, and stand beside a report's desk while a delegation runs — all derived from the runs table, never from prose.

## Milestones

- [x] **M1 — Foundation**: agent model + personality, `/hire` wizard, `@Name` chat grounded in real work state, vitest suite
- [x] **M2 — The job pipeline**: feeds (HN + RSS) → daily brief artifact, manual trigger + 14:00 UTC cron, revisions with lessons accretion
- [x] **M3 — Outbound email**: scheduled briefs are emailed to the CEO via Resend (send-only; inbound never)
- [x] **M4 — Delegation**: supervisors hand tasks to their reports as structured child runs (one level max); the worker's report artifact closes both runs
- [x] **v2 — The pixel office**: `[Office] | [Chat]` web app; sprites animate off run records, chat shares the terminal's threads, documents open in-pane

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
npm run office        # terminal
npm run dev           # pixel office at http://localhost:3000
```

## Using the office

```
you> /hire                      # interactive: name, job title, real job description,
                                # "a successful day would be:", personality traits
you> /roster                    # who works here
you> @Edna introduce yourself   # talk to an agent
you> /status Edna               # her real work state (runs, jobs, documents)
you> /supervisor Milton Edna    # Edna now supervises Milton
you> /look Hazel c04            # pick their sprite for the pixel office (empty = auto)
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

## The pixel office (web)

`npm run dev` with `npx convex dev` running. Left pane: the office. The team lead sits in the private office, everyone else takes a desk in hire order; people wander when idle, sit at their desk while a run is in flight, and a supervisor walks over and stands beside a report's desk while a delegated child run is running. Labels and "done/failed" bubbles come straight from the runs table. Under the scene, **Activity** lists recent runs with links to what they produced.

The hamburger menu (top-left) has two entries. **Roles** defines jobs once — name, description, department, and which role it reports to — grouped by department, with a one-click starter org chart (Front desk, Corporate, IT, Sales, Marketing, Customer Success). People are assigned a role from a dropdown when hired or edited and inherit its title and description; editing a role re-syncs everyone holding it. **Skills** is the central catalogue: import verified skills from Smithery's registry (needs `SMITHERY_API_KEY` in the Convex env: `npx convex env set SMITHERY_API_KEY …`), or add your own; each is knowledge (SKILL.md-style instructions that go into the agent's prompt) and, later, tools from the repo — nothing imported ever runs. People hold skills at a level from 1 (learning) to 5 (expert), picked when hiring or on the Employees → Skills tab; levels climb on their own as completed runs use the skill's tools (50 uses to reach 2, then 150, 450, 950) and never fall. **Employees** opens one person at a time, `← →` at the top to switch, tabs on the left (Profile, Job, Personality, Look), their sprite on the right. Every tab edits in place and saves through `agents.update`; a red **Fire** button sits under the tabs, and **+ Hire a new employee** is the last tab (same profile the terminal wizard asks for, plus a look from the sprite catalogue). Right pane: one chat for the whole office — every agent's thread merged by time, each person in their own colour with a bold name; your messages sit on the right with who they went to. Same threads as the terminal underneath. `@Name …` talks to someone; a plain message goes to the person in the **to** chip (click them in the office to switch). Click into the composer (or type `/`) for command suggestions with a runnable example each: `/task`, `/run`, `/redo`, `/email`, `/help` (job setup and feeds stay in the terminal). **Docs** lists every document in the office; open one to read it with its version chain and sources.

Sprites live in `public/office/sprites/<set>_<front|back|right>.png` (left views are mirrored) and are listed in `src/lib/office/sprites.ts` — add a set there to make it hireable; walking is faked from single frames by lifting and striding the leg halves. Seats and idle spots are hand-placed in `src/lib/office/layout.ts`; walks are planned with A* over a walkability grid generated from the artwork (`python scripts/navmask.py` → `src/lib/office/navmask.ts`, doors as overrides in the script), so nobody cuts through walls or desks. Add `?nav` to the dev URL to see blocked cells and planned paths.

## Development

```sh
npm test            # vitest: unit tests + convex-test backend tests
npx tsc --noEmit    # typecheck
npx tsx scripts/smoke.ts   # end-to-end check against the running local backend
```

Repo layout and conventions: see [AGENTS.md](AGENTS.md). Original spec: `pixel-office-v1-spec.md` (job descriptions, headless-first, and delegation-in-v1-scope are deliberate departures from it).
