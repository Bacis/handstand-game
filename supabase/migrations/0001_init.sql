-- Handstand Counter — initial Supabase schema.
-- profiles: public-facing username keyed off auth.users
-- attempts: one row per completed handstand
-- leaderboard: view aggregating best time per user
-- All tables have RLS enabled. Reads are public (so the leaderboard works
-- while logged out). Writes are restricted to the authenticated owner.

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique not null
    check (username ~ '^[a-zA-Z0-9_-]{3,24}$'),
  created_at timestamptz not null default now()
);

create table public.attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  duration_ms  integer not null
    check (duration_ms > 0 and duration_ms <= 600000),
  video_path   text,
  device_info  jsonb,
  recorded_at  timestamptz not null default now()
);

create index attempts_user_recorded_idx on public.attempts (user_id, recorded_at desc);
create index attempts_duration_idx      on public.attempts (duration_ms desc);

create view public.leaderboard as
  select
    p.id                as user_id,
    p.username          as username,
    max(a.duration_ms)  as best_time_ms,
    count(a.id)         as total_attempts,
    max(a.recorded_at)  as last_attempt_at
  from public.profiles p
  join public.attempts a on a.user_id = p.id
  group by p.id, p.username;

alter table public.profiles enable row level security;
alter table public.attempts enable row level security;

create policy profiles_read        on public.profiles for select using (true);
create policy profiles_insert_self on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update_self on public.profiles for update using      (auth.uid() = id);

create policy attempts_read        on public.attempts for select using (true);
create policy attempts_insert_self on public.attempts for insert with check (auth.uid() = user_id);

-- Storage bucket + policy for attempt videos.
-- Videos are uploaded under "${auth.uid()}/<uuid>.mp4"; the foldername()
-- helper extracts the first path segment so users can only write their own
-- prefix. Bucket is public-read so attempts show up on anyone's profile.
insert into storage.buckets (id, name, public) values ('videos', 'videos', true)
  on conflict (id) do nothing;

create policy videos_read_all
  on storage.objects for select
  using (bucket_id = 'videos');

create policy videos_insert_self
  on storage.objects for insert
  with check (
    bucket_id = 'videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
