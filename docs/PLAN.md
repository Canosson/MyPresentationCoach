# MyPresentationCoach — Build Plan

## Problem
HireVue removed facial / body-language / tone analysis from their AI scoring after lawsuits. But human recruiters still watch the recorded videos. Candidates are blind to how they come across on camera. We give them that feedback.

## MVP scope (2 days, solo)
- Auth: Supabase magic link
- Upload: max 10s video, client-direct to Supabase Storage
- Analyze: Gemini 2.5 Flash for 5 visual dimensions, Python+librosa for vocal presence
- Report: Glass Box — 6 cards, score 1–5, observation, fix
- Recordings list page
- Deployed live on Vercel + Railway

## Out of scope
Answer rewriting, conversational follow-ups, exports, sharing, dark mode, mobile-perfect.

## Stack
- Monorepo: /web (Next.js 14 App Router, TS, Tailwind, shadcn) + /python-service (FastAPI, librosa, ffmpeg)
- Supabase: Postgres + Auth + Storage
- Gemini 2.5 Flash for vision
- Vercel for /web, Railway for /python-service

## TODO
- [x] Repo init, .claude/agents/ in place, Next.js scaffold, Python scaffold
- [x] Verify Gemini API key works with a video (script test)
      → PASSED with gemini-2.5-flash — file upload, ACTIVE state, structured 5-dimension response all verified
- [x] Verify ffmpeg + librosa work locally with a sample video
      → PASSED — generated docs/test-clip.mp4, extracted audio, all 5 metrics numeric, vocal_presence scoring works
- [x] Supabase project, schema, RLS, magic link auth
      → SQL migration: docs/migrations/001_initial_schema.sql
      → Auth: proxy.ts gate, login page, /auth/callback route handler
      → Supabase clients: lib/supabase/{server,client,middleware}.ts
      → Zod schemas: lib/schemas/report.ts
- [x] Upload flow (client-direct to Storage)
      → POST /api/recordings creates row, returns { id, storage_path }
      → lib/upload.ts: uploadRecording() uploads file direct to Supabase Storage
      → app/upload/page.tsx: file picker, 10s validation, progress, redirect to /recordings/{id}
- [x] Python /analyze-audio endpoint working locally
      → storage_path-based download via Supabase service role key
- [x] /api/analyze orchestration — parallel Gemini + Python, merge, write report
      → web/app/api/analyze/route.ts + web/lib/ai/gemini.ts
- [x] Glass Box report UI (the demo surface)
      → web/app/recordings/[id]/page.tsx — 6 dimension cards with score dots
- [x] Recordings list, loading/empty/error states
      → web/app/recordings/page.tsx, web/app/page.tsx (landing/redirect)
- [x] Deploy /web to Vercel, /python-service to Railway
      → Vercel: https://web-sigma-eight-17.vercel.app
      → Railway: https://mypresentationcoach-python-production.up.railway.app
- [x] End-to-end test on live URLs
      → PASSED — upload → Gemini (5 visual dims) + Python (vocal presence) → Glass Box report → persists on refresh → recordings list correct
- [ ] README with architecture diagram + subagent descriptions
- [ ] Slides + demo rehearsal + backup demo video

## Risks
- Gemini free-tier rate limit during demo → pre-run analysis 30min before
- Railway cold start → warmup ping before demo
- ffmpeg missing in Docker → test deployed Python service early
- Auth eating Day 1 → fallback: fake-auth demo user, ship without

## Hard cutoffs
- Hour 3: if auth not working, fake it and move on
- Hour 10: end of Day 1 — must have end-to-end JSON working, UI can be ugly
- Hour 15: deploy must be live with 3h of buffer
