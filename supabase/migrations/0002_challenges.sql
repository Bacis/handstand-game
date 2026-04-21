-- Multi-challenge support: handstand (duration) + pull-ups / push-ups / squats (reps).
-- Backfill path: every pre-existing attempt is a handstand with duration_ms only,
-- so we give challenge_type a default of 'handstand' and let rep_count stay NULL.

alter table public.attempts
  add column challenge_type text not null default 'handstand'
    check (challenge_type in ('handstand', 'pullups', 'pushups', 'squats'));

alter table public.attempts
  add column rep_count integer
    check (rep_count is null or (rep_count > 0 and rep_count <= 10000));

-- Rep-based challenges don't record duration. Allow NULL and require at least
-- one score dimension to be present.
alter table public.attempts alter column duration_ms drop not null;

alter table public.attempts
  add constraint attempts_score_present
    check (duration_ms is not null or rep_count is not null);

create index if not exists attempts_challenge_recorded_idx
  on public.attempts (challenge_type, recorded_at desc);

-- Per-challenge aggregates. Callers filter by challenge_type and order by
-- whichever score column is primary for that challenge (best_time_ms for
-- handstand, best_reps for the rest).
drop view if exists public.leaderboard;

create view public.leaderboard_v2 as
  select
    p.id                    as user_id,
    p.username              as username,
    a.challenge_type        as challenge_type,
    max(a.duration_ms)      as best_time_ms,
    max(a.rep_count)        as best_reps,
    count(a.id)             as total_attempts,
    max(a.recorded_at)      as last_attempt_at
  from public.profiles p
  join public.attempts a on a.user_id = p.id
  group by p.id, p.username, a.challenge_type;

-- Keep a handstand-only compatibility view so older builds don't 404.
create view public.leaderboard as
  select user_id, username, best_time_ms, total_attempts, last_attempt_at
  from public.leaderboard_v2
  where challenge_type = 'handstand';
