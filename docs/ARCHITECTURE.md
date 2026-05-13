# Architecture

## System overview

MyPresentationCoach is a two-service web application. The browser-facing Next.js app handles auth, uploads, orchestration, and the visual AI analysis. A dedicated Python service handles audio extraction and vocal analysis. They communicate over HTTPS with a shared-secret token.

This split exists for one reason: audio analysis is genuinely better in Python (`librosa`, `ffmpeg`), and pushing it into Node would mean fighting the ecosystem. Everything else lives in Next.js because two deployments are already enough operational complexity for a 2-day MVP.

## Component map

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Next.js client (React Server + Client Components)       │   │
│  │  - Login (magic link form)                               │   │
│  │  - Upload page                                           │   │
│  │  - Recordings list                                       │   │
│  │  - Glass Box report                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────┬──────────────────┬──────────────────────────────┘
                │                  │
                │ direct upload    │ HTTPS
                │ (signed URL)     │
                ▼                  ▼
┌──────────────────────┐  ┌────────────────────────────────────┐
│   Supabase           │  │   Next.js server (Vercel)          │
│   ┌──────────────┐   │  │   - /api/analyze (orchestration)   │
│   │   Auth       │◄──┼──┤   - middleware (auth gate)         │
│   │   Postgres   │◄──┼──┤   - Gemini SDK calls               │
│   │   Storage    │◄──┘  │                                    │
│   └──────────────┘      └─────────┬──────────────────────────┘
└──────────────────────             │
                                    │ HTTPS + Bearer token
                                    │ (signed video URL in body)
                                    ▼
                       ┌────────────────────────────────────┐
                       │   Python service (Railway)         │
                       │   - FastAPI                        │
                       │   - /analyze-audio                 │
                       │   - /health                        │
                       │   - ffmpeg + librosa pipeline      │
                       └────────────────────────────────────┘

                       ┌────────────────────────────────────┐
                       │   Google Gemini 2.0 Flash API      │
                       │   (native video input)             │
                       └────────────────────────────────────┘
```

## Request flow — upload to report

```
1. User picks a video file in the browser
   └─> client-side validation (max 10s, max 25MB, mp4/webm/mov)

2. Browser uploads directly to Supabase Storage
   └─> using the user's auth session (RLS allows insert into own folder)
   └─> Next.js never touches the video bytes

3. Browser POSTs { storagePath } to /api/recordings
   └─> Next.js inserts row into `recordings` table with status='pending'
   └─> returns recordingId

4. Browser POSTs { recordingId } to /api/analyze
   └─> Next.js sets status='analyzing'
   └─> generates a 5-minute signed URL for the video
   └─> fires TWO requests in parallel via Promise.all:
        ├─> Gemini: analyzeVideoVisuals(signedUrl)
        │    └─> returns 5 visual dimensions (framing, lighting,
        │        background, eye contact, posture)
        └─> Python service: POST /analyze-audio { video_url }
             └─> returns 1 audio dimension (vocal_presence)

5. Next.js merges the 6 dimensions, validates with Zod
   └─> inserts row into `reports` table
   └─> updates recordings.status='ready'
   └─> returns the merged report to the browser

6. Browser navigates to /recordings/[id]
   └─> Glass Box UI renders the 6 cards
```

## Failure modes and handling

| Failure | Where | Handling |
|---|---|---|
| Video > 10s | Client | Reject before upload |
| Video > 25MB | Client + Python | Reject with clear message |
| Gemini rate limit | Next.js | Retry once with backoff, then fail with reason |
| Gemini schema mismatch | Next.js (Zod) | Retry once with stricter prompt, then fail |
| Python service cold start | Next.js | Timeout = 30s, allow first call to be slow |
| Python service down | Next.js | Mark report `partial`, render 5 dimensions only |
| Silent video | Python | Return valid response, score=1, observation="No audible voice" |
| Supabase Storage upload fails | Client | Show error, retry button |

If Gemini fails but Python succeeds (or vice versa), the report is marked `partial` and the working dimensions still render. The user sees what we have, not a blank screen. This matters for the demo — partial is better than zero.

## Data model

Two tables, both with RLS so users see only their own data.

```
recordings
  id              uuid (PK)
  user_id         uuid (FK -> auth.users)
  storage_path    text
  status          text  -- pending | analyzing | ready | failed | partial
  error_reason    text  -- nullable
  created_at      timestamptz

reports
  id              uuid (PK)
  recording_id    uuid (FK -> recordings, on delete cascade)
  payload         jsonb -- the full Glass Box report
  created_at      timestamptz
```

The `payload` is jsonb (not relational) on purpose — the report shape may evolve, and we don't query into it. Full schema lives in `docs/CONTRACTS.md`.

## Why this stack

- **Next.js 14 App Router** — server components keep auth and data-fetching on the server by default. Vercel deploy is one command. New tech for the developer = the brief's "unfamiliar stack" requirement.
- **Supabase** — Postgres + Auth + Storage in one product. Free tier covers the demo. RLS handles per-user isolation without writing auth middleware everywhere.
- **FastAPI + librosa** — Python is genuinely the right tool for audio. FastAPI is lightweight and ships in a single file. Railway gives us a Docker target without writing infrastructure.
- **Gemini 2.0 Flash** — only multimodal model with a free tier that handles video natively. No keyframe extraction needed, which simplifies a whole subsystem.
- **Vercel + Railway + Supabase** — three free tiers, three one-click deploys. Total infra cost: $0.

## What this architecture deliberately doesn't do

- **No job queue.** Analysis is synchronous, called from the browser, blocks until ready. For 10-second videos with ~15s analysis time this is fine. A queue would add Redis + worker + status polling — half a day of work for an MVP that doesn't need it.
- **No webhook from Python back to Next.js.** Next.js calls Python and waits. Simpler error handling, simpler retry, no race conditions.
- **No CDN for videos.** Supabase Storage serves them directly. Fine for a demo, would not scale to thousands of users.
- **No background jobs.** No cleanup, no retention policy, no scheduled tasks. Day 3 problems.
