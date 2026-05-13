# MyPresentationCoach — Build Plan

## Problem
HireVue removed facial / body-language / tone analysis from their AI scoring after lawsuits. But human recruiters still watch the recorded videos. Candidates are blind to how they come across on camera. We give them that feedback.

## MVP scope (2 days, solo)
- Auth: Supabase magic link
- Upload: max 10s video, client-direct to Supabase Storage
- Analyze: Gemini 2.0 Flash for 5 visual dimensions, Python+librosa for vocal presence
- Report: Glass Box — 6 cards, score 1–5, observation, fix
- Recordings list page
- Deployed live on Vercel + Railway

## Out of scope
Answer rewriting, conversational follow-ups, exports, sharing, dark mode, mobile-perfect.

## Stack
- Monorepo: /web (Next.js 14 App Router, TS, Tailwind, shadcn) + /python-service (FastAPI, librosa, ffmpeg)
- Supabase: Postgres + Auth + Storage
- Gemini 2.0 Flash (free tier) for vision
- Vercel for /web, Railway for /python-service

## TODO
- [ ] Repo init, .claude/agents/ in place, Next.js scaffold, Python scaffold
- [ ] Verify Gemini API key works with a video (script test)
- [ ] Verify ffmpeg + librosa work locally with a sample video
- [ ] Supabase project, schema, RLS, magic link auth
- [ ] Upload flow (client-direct to Storage)
- [ ] Python /analyze-audio endpoint working locally
- [ ] /api/analyze orchestration — parallel Gemini + Python, merge, write report
- [ ] Glass Box report UI (the demo surface)
- [ ] Recordings list, loading/empty/error states
- [ ] Deploy /web to Vercel, /python-service to Railway
- [ ] End-to-end test on live URLs
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
