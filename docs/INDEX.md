# Documentation Index

This is the map. Every subagent should read this first when invoked to know where to find what they need.

## For the PM subagent

Always read in this order at the start of every session:

1. **`PLAN.md`** — current state of the build, TODO list, hard cutoffs
2. **`ARCHITECTURE.md`** — the system you're orchestrating the build of
3. **This index** — to know what other docs exist for context

When delegating, attach the relevant doc to the Task prompt. Don't make specialists hunt.

## By topic

| If you need... | Read |
|---|---|
| The build plan and TODO list | `PLAN.md` |
| Non-technical product overview | `PROJECT_BRIEF.md` |
| System design, request flow, failure modes | `ARCHITECTURE.md` |
| Database schema, API shapes, Zod types | `CONTRACTS.md` |
| Gemini prompt and response schema | `PROMPTS.md` |
| Environment variable names and values | `ENV.md` |
| How to deploy each service | `DEPLOYMENT.md` |
| Manual smoke tests and edge cases | `TEST_PLAN.md` |
| First-30-minutes setup steps | `RUNBOOK.md` |
| The 6-minute demo script | `DEMO_SCRIPT.md` |

## By subagent

### `frontend`
Primary: `CONTRACTS.md` (Zod schemas to import), `ARCHITECTURE.md` (request flow)
Secondary: `ENV.md` (which env vars are NEXT_PUBLIC_)

### `next-backend`
Primary: `CONTRACTS.md` (DB schema, API contracts, Zod), `ARCHITECTURE.md` (failure modes)
Secondary: `ENV.md`, `PROMPTS.md` (calling Gemini)

### `python-service`
Primary: `CONTRACTS.md` (the `/analyze-audio` contract and Vocal Presence rubric)
Secondary: `ENV.md`, `DEPLOYMENT.md` (Stage 2 — Railway specifics)

### `ai-integration`
Primary: `PROMPTS.md` (the authoritative prompt), `CONTRACTS.md` (the Zod DimensionSchema)
Secondary: `ARCHITECTURE.md` (where this module fits)

### `deploy`
Primary: `DEPLOYMENT.md` (the playbook), `ENV.md` (every variable)
Secondary: `TEST_PLAN.md` (production smoke test)

## Doc owners

When a subagent finds an error or needs a doc updated:

- `PLAN.md` — owned by `pm`. Specialists report status; PM updates.
- `ARCHITECTURE.md`, `CONTRACTS.md` — owned by `pm`. Specialists propose changes; PM approves.
- `PROMPTS.md` — owned by `ai-integration`.
- `DEPLOYMENT.md`, `ENV.md`, `README.md` — owned by `deploy`.
- `TEST_PLAN.md`, `RUNBOOK.md`, `DEMO_SCRIPT.md` — owned by the developer (you), updated only if explicitly asked.

Never modify a doc you don't own without going through the PM.

## Document hygiene rules

- Keep docs short. Long docs don't get read.
- Code blocks should be runnable, not pseudocode.
- Every "MUST" or "NEVER" should be backed by a real reason somewhere.
- If a doc gets stale, mark it `<!-- STALE -->` at the top so the next reader knows.
