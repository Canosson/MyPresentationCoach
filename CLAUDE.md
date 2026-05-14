# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Approach
- Read existing files before writing. Don't re-read unless changed.
- Thorough in reasoning, concise in output.
- Skip files over 100KB unless required.
- No sycophantic openers or closing fluff.
- No emojis or em-dashes.
- Do not guess APIs, versions, flags, commit SHAs, or package names. Verify by reading code or docs before asserting.

## Commands

### Web service (Next.js, in `/web`)
```bash
cd web
pnpm install         # install deps
pnpm dev             # dev server at http://localhost:3000
pnpm build           # production build
pnpm lint            # eslint
```

### Python audio service (FastAPI, in `/python-service`)
```bash
# Uses its own venv (separate from the root .venv)
cd python-service
source venv/bin/activate
pip install -r requirements.txt

# Run dev server
uvicorn python_service.main:app --reload --port 8000

# Run the manual audio pipeline test
python scripts/test_audio_pipeline.py

# Verify Gemini connectivity (from root)
node scripts/verify_gemini.mjs
```

No automated test suite exists yet. `scripts/test_audio_pipeline.py` and `scripts/verify_gemini.mjs` are the smoke-test entry points.

## Architecture

Two services deployed independently:

- **Next.js app** (Vercel) -- auth, upload orchestration, Gemini visual analysis, report storage
- **Python FastAPI service** (Railway) -- audio extraction via ffmpeg + librosa, vocal presence scoring

The browser uploads video **directly to Supabase Storage** using the user's auth session (RLS enforces per-user isolation). Next.js never handles video bytes. After upload, the browser calls `/api/analyze`, which fires Gemini and the Python service **in parallel** via `Promise.all`, merges the 6 dimension results, writes to the `reports` table, and returns the Glass Box report.

If one analyzer fails, the report is stored and returned as `partial: true` with the surviving dimensions. Both analyzers failing returns HTTP 502.

## Key files

| File | Role |
|---|---|
| `web/app/api/recordings/route.ts` | `POST /api/recordings` (create row) and `GET /api/recordings` (list) |
| `web/app/upload/page.tsx` | Upload page -- client-side validation, direct Supabase Storage upload, then calls `/api/recordings` and `/api/analyze` |
| `web/proxy.ts` | Auth middleware -- gates all routes except `/login` and `/auth/callback` |
| `web/lib/supabase/client.ts` | Browser Supabase client |
| `web/lib/supabase/server.ts` | Server-side Supabase client (uses service role key) |
| `web/lib/supabase/middleware.ts` | Session refresh helper used by `proxy.ts` |
| `web/lib/schemas/report.ts` | Zod schemas: `DimensionSchema`, `ReportSchema` -- source of truth for the report shape |
| `web/lib/upload.ts` | Client-side upload helpers |
| `python-service/python_service/main.py` | FastAPI app -- `POST /analyze-audio`, `GET /health`, auth via shared secret |
| `python-service/python_service/audio.py` | `extract_audio` (ffmpeg), `compute_metrics` (librosa), `score_vocal_presence` |

## Data model

Two Postgres tables in Supabase (both with RLS):

```
recordings   id, user_id, storage_path, status (pending|analyzing|ready|failed|partial), error_reason, created_at
reports      id, recording_id, payload (jsonb -- full Glass Box report), created_at
```

Storage path convention: `recordings/{user_id}/{recording_id}.{ext}`. RLS policies match on the first path segment via `storage.foldername`.

Full SQL in `docs/migrations/001_initial_schema.sql` and `docs/CONTRACTS.md`.

## Service communication

Next.js calls the Python service with a shared secret:
```
Authorization: Bearer {PYTHON_SERVICE_SECRET}
```
or `X-Service-Secret: {PYTHON_SERVICE_SECRET}`. Both services must share the same secret value.

The Python service now accepts `storage_path` (e.g. `recordings/user_id/file.mp4`) rather than a pre-signed URL, and downloads the file directly from Supabase Storage using the service-role key.

## Environment variables

See `docs/ENV.md` for the full reference. Summary:

**`/web/.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only
GEMINI_API_KEY=                 # server-only
PYTHON_SERVICE_URL=http://localhost:8000
PYTHON_SERVICE_SECRET=          # server-only; generate with: openssl rand -hex 32
```

**`/python-service/.env`**
```
PYTHON_SERVICE_SECRET=          # must match web value
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ALLOWED_ORIGINS=http://localhost:3000
PORT=8000
```

## Subagent system

Specialist Claude Code subagents live in `.claude/agents/`. The PM agent orchestrates; specialists write code. When delegating, use the correct subagent type: `frontend`, `next-backend`, `python-service`, `ai-integration`, or `deploy`.

## Next.js version note

This project runs Next.js 15 (versioned as `16.x`). Page props `params` and `searchParams` are `Promise`s -- always `await` them before use. The old `{ params: { id: string } }` pattern is a silent type error here.

## Important docs

- `docs/ARCHITECTURE.md` -- full system design and failure modes
- `docs/CONTRACTS.md` -- DB schema, API shapes, Zod schemas, vocal presence scoring rubric
- `docs/PROMPTS.md` -- Gemini prompt specification
- `docs/PLAN.md` -- build plan the PM agent works from
- `docs/DEPLOYMENT.md` -- step-by-step Vercel + Railway + Supabase deployment
- `docs/ENV.md` -- environment variable reference
