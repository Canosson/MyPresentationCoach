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
