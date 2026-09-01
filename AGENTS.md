<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# The Office

A curation of AI agents doing work. v1 is **headless**: everything is controlled from the terminal (`npm run office`); the Next.js app is a placeholder until the pixel-office viewer (v2).

## Layout

- `src/app/` — Next.js App Router (placeholder in v1)
- `src/components/` — shared UI components (empty until v2)
- `src/server/convex/` — the runtime. Convex functions dir (see `convex.json`); each file is an API namespace:
  - `schema.ts`, `convex.config.ts`, `crons.ts` — infrastructure
  - `model/` — shared ctx helpers (agent lookup, run settling); NOT Convex functions, never in the API
  - `agents.ts` / `jobs.ts` — CRUD for the cast and their standing jobs
  - `runs.ts` — run + artifact lifecycle (internal); every unit of work goes through it
  - `briefs.ts` — the brief pipeline: feeds → generateObject → artifact, cron entry, revisions
  - `delegation.ts` — task routing (supervisor decides), delegation, report-backs
  - `artifacts.ts` — reading documents (/docs, /read, email lookups)
  - `work.ts` — work-state queries injected into chat
  - `chat.ts` / `email.ts` — @mention conversations; send-only Resend delivery
- `src/server/vercel/` — AI SDK layer: model client (OpenRouter) + pure prompt builders/parsers
- `src/cli/` — the headless terminal control (REPL, @mention parsing)
- `src/lib/` — pure helpers shared by CLI and server
- `scripts/smoke.ts` — one-shot end-to-end check against the running local deployment

## Principles (from the spec, enforced)

- **Agents are data, not processes.** An agent is a row; it "comes alive" only when a cron or mention invokes a Convex function.
- **A job description is a description, not a command.** Agents have `jobTitle`, prose `jobDescription`, and a `successfulDay` list. Personality (traits + notes) shapes tone, never facts.
- **Status answers come from injected work state only** (runs/jobs/artifacts). Never let the LLM invent progress.
- **Records drive prose, never the reverse.** Delegation is structured child runs (`delegation.ts`), one level max — enforced in `startRun`.
- **No inbound channels.** Send-only email later; agents never read inboxes.

## Commands

- `npx convex dev` — local Convex backend (anonymous mode, no account); keep running while using the office
- `npm run office` — the terminal office
- `npm test` — vitest (unit + convex-test); convex tests need `_generated` (run `npx convex codegen` after schema changes)
- `npx tsc --noEmit` — typecheck

## Conventions

- Convex functions use args/returns validators; internal functions for anything the CLI shouldn't call.
- Pure logic (prompts, parsing, validation) lives outside Convex handlers so vitest covers it without a backend.
- Chat/LLM code (`chat.ts`) is excluded from convex-test module globs — it needs the installed agent component and a live key.
