# API Contracts and Database Schema

This is the source of truth for shapes that cross service boundaries. Backend agents reference this; frontend agent uses the same Zod schemas for type safety end-to-end.

## Database schema (Supabase / Postgres)

Run this in the Supabase SQL editor after creating the project. It creates the tables, enables RLS, and adds the storage bucket policies.

```sql
-- ============================================================
-- Tables
-- ============================================================

create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  status text not null default 'pending'
    check (status in ('pending', 'analyzing', 'ready', 'failed', 'partial')),
  error_reason text,
  created_at timestamptz not null default now()
);

create index recordings_user_id_created_at_idx
  on public.recordings (user_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create unique index reports_recording_id_idx on public.reports (recording_id);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.recordings enable row level security;
alter table public.reports enable row level security;

create policy "Users see their own recordings"
  on public.recordings for select
  using (auth.uid() = user_id);

create policy "Users insert their own recordings"
  on public.recordings for insert
  with check (auth.uid() = user_id);

create policy "Users update their own recordings"
  on public.recordings for update
  using (auth.uid() = user_id);

create policy "Users see reports for their recordings"
  on public.reports for select
  using (
    exists (
      select 1 from public.recordings r
      where r.id = reports.recording_id
        and r.user_id = auth.uid()
    )
  );

-- Reports are only inserted by the server (service-role key bypasses RLS),
-- so no insert policy needed for clients.

-- ============================================================
-- Storage bucket
-- ============================================================

insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false);

create policy "Users upload to their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users read their own files"
  on storage.objects for select
  using (
    bucket_id = 'recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users delete their own files"
  on storage.objects for delete
  using (
    bucket_id = 'recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
```

Storage path convention: `recordings/{user_id}/{recording_id}.{ext}`. Putting the user_id in the path lets the RLS policy match it via `storage.foldername`.

## Shared report schema

Both backends produce items conforming to this schema. The Glass Box UI renders an array of exactly 6 of these.

```typescript
// web/lib/schemas/report.ts

import { z } from 'zod';

export const DimensionSchema = z.object({
  dimension: z.enum([
    'framing',
    'lighting',
    'background',
    'eye_contact',
    'posture',
    'vocal_presence',
  ]),
  score: z.number().int().min(1).max(5),
  observation: z.string().min(10).max(280),
  fix: z.string().min(10).max(280),
});

export const ReportSchema = z.object({
  dimensions: z.array(DimensionSchema).length(6),
  generated_at: z.string().datetime(),
  partial: z.boolean(), // true if one of the two analyzers failed
});

export type Dimension = z.infer<typeof DimensionSchema>;
export type Report = z.infer<typeof ReportSchema>;
```

The vocal_presence dimension may additionally carry a `metrics` object in the jsonb payload, but the frontend doesn't render it — it's for debugging.

## Next.js API routes

All routes require an authenticated session unless noted. Auth is enforced in `middleware.ts` plus a per-route session check.

### `POST /api/recordings`

Create a recording row after the client has uploaded to Storage.

```typescript
// Request
{
  "storage_path": "recordings/{user_id}/{filename}"
}

// Response 200
{
  "recording_id": "uuid"
}

// Response 400 — path doesn't start with the user's own folder
{ "error": "Invalid storage path" }
```

### `POST /api/analyze`

Run both analyses in parallel, store the merged report, return it.

```typescript
// Request
{
  "recording_id": "uuid"
}

// Response 200
{
  "report": Report,
  "recording_id": "uuid"
}

// Response 404 — recording not found or not owned by user
{ "error": "Recording not found" }

// Response 502 — both analyses failed
{ "error": "Analysis failed", "reason": "..." }

// Response 200 with partial=true — one analysis succeeded
{
  "report": { ...with 5 or fewer dimensions and partial: true },
  "recording_id": "uuid"
}
```

The route is idempotent on `recording_id` — if a report already exists, return it without re-running analysis.

### `GET /api/recordings`

List the current user's recordings (newest first).

```typescript
// Response 200
{
  "recordings": [
    {
      "id": "uuid",
      "status": "ready",
      "created_at": "2026-05-13T11:00:00Z",
      "has_report": true
    }
  ]
}
```

### `GET /api/recordings/[id]`

Get one recording with its report if ready.

```typescript
// Response 200
{
  "recording": {
    "id": "uuid",
    "status": "ready",
    "created_at": "...",
    "error_reason": null
  },
  "report": Report | null
}
```

## Python service contract

One endpoint, plus a healthcheck. Auth via shared secret.

### `POST /analyze-audio`

```http
POST /analyze-audio
Authorization: Bearer {PYTHON_SERVICE_SECRET}
Content-Type: application/json

{
  "video_url": "https://...supabase.../signed-url"
}
```

```json
// Response 200
{
  "dimension": "vocal_presence",
  "score": 3,
  "observation": "Your voice trails off in the second half of the clip.",
  "fix": "Practice projecting consistent volume through to the end of each sentence.",
  "metrics": {
    "mean_db": -22.4,
    "std_db": 4.1,
    "silence_ratio": 0.18,
    "dynamic_range_db": 12.3,
    "duration_seconds": 9.8
  }
}

// Response 401 — bad or missing bearer token
{ "detail": "Unauthorized" }

// Response 400 — video too large or unreadable
{ "detail": "Video exceeds 25MB limit" }

// Response 422 — URL not fetchable
{ "detail": "Could not retrieve video from URL" }
```

### `GET /health`

No auth. Returns `200 OK` with `{ "status": "ok" }`. Railway uses this for healthchecks.

## Vocal Presence scoring rubric

Documented here because the Python agent will implement it, and we want it consistent.

```
Inputs:
  mean_db        - mean RMS loudness in dB (typically -40 to -10)
  std_db         - standard deviation of loudness across the clip
  silence_ratio  - fraction of clip below -45 dB (essentially silence)
  dynamic_range  - max_db - min_db

Score 5 — Excellent
  mean_db > -22 AND silence_ratio < 0.15 AND std_db between 3-7

Score 4 — Good
  mean_db > -26 AND silence_ratio < 0.20

Score 3 — Acceptable
  mean_db > -32 AND silence_ratio < 0.30

Score 2 — Weak
  mean_db > -38 OR silence_ratio < 0.45

Score 1 — Inaudible / silent
  mean_db <= -38 OR silence_ratio >= 0.45 OR duration_audible < 2s

Observation selection (pick the dominant weakness):
  - If silence_ratio > 0.30: "Long silent gaps detected"
  - If mean_db < -30: "Voice is quieter than recruiters expect"
  - If std_db < 2: "Delivery sounds monotone"
  - If std_db > 9: "Volume varies sharply"
  - Else: "Strong, consistent vocal presence"

Fix selection — one concrete action matched to the observation.
```

This rubric is intentionally simple. Tuning it is a Day 3 problem.
