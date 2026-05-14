---
name: user_profile
description: Solo developer building MyPresentationCoach, comfortable with Next.js 15 and FastAPI, uses smoke tests in lieu of an automated suite
metadata:
  type: user
---

Ruben is the sole developer on this project. He works across the full stack (Next.js 15 App Router frontend/API routes, FastAPI Python audio service) and manages the infrastructure himself (Vercel, Railway, Supabase). There is no automated test suite; correctness is verified via manual smoke tests documented in `scripts/` and `docs/DEPLOYMENT.md`. He uses Claude Code subagents to build features and the code-reviewer agent to gate quality.

He expects concise, actionable feedback with file:line references and concrete fixes -- not summaries of what the code already does.
