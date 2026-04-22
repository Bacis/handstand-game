-- Duels: head-to-head matches (invite-link or random lobby) and the waiting
-- queue that pairs anonymous/registered players into one.

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  challenge_type text not null check (challenge_type in ('handstand','pullups','pushups','squats')),
  duration_s integer not null default 60 check (duration_s between 15 and 300),
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid references auth.users(id) on delete cascade,
  state text not null default 'pending'
    check (state in ('pending','ready','live','done','cancelled')),
  source text not null default 'invite' check (source in ('invite','lobby')),
  started_at timestamptz,
  ended_at timestamptz,
  host_score numeric,
  guest_score numeric,
  winner_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index matches_state_idx on public.matches (state, created_at desc);
create index matches_host_idx on public.matches (host_id, created_at desc);
create index matches_guest_idx on public.matches (guest_id, created_at desc);

-- Primary key on user_id ensures a player can only be in one queue row at a
-- time. Pairing is race-safe via `delete ... returning` on both rows — see
-- client/src/lib/duelsApi.js::tryClaimOpponent.
create table public.match_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  challenge_type text not null check (challenge_type in ('handstand','pullups','pushups','squats')),
  duration_s integer not null check (duration_s between 15 and 300),
  created_at timestamptz not null default now()
);

create index match_queue_waiting_idx on public.match_queue (challenge_type, duration_s, created_at);

alter table public.matches enable row level security;
alter table public.match_queue enable row level security;

-- Public read on matches: a would-be guest needs to resolve an invite link
-- before they are attached as guest_id. Read is safe — matches are not
-- sensitive.
create policy matches_read on public.matches for select using (true);
create policy matches_insert_host on public.matches
  for insert with check (auth.uid() = host_id);
create policy matches_update_participants on public.matches
  for update using (auth.uid() in (host_id, guest_id))
  with check (auth.uid() in (host_id, guest_id));

create policy match_queue_read on public.match_queue for select using (true);
create policy match_queue_insert_self on public.match_queue
  for insert with check (auth.uid() = user_id);
create policy match_queue_delete_self on public.match_queue
  for delete using (auth.uid() = user_id);

-- W/L aggregates. Built off matches alone (no auth.users dep) so anonymous
-- players with no profile row still show up in results.
create view public.duel_stats as
select
  user_id,
  count(*) filter (where state = 'done') as total,
  count(*) filter (where winner_id = user_id) as wins,
  count(*) filter (where state = 'done' and winner_id is not null and winner_id <> user_id) as losses
from (
  select host_id as user_id, state, winner_id from public.matches where host_id is not null
  union all
  select guest_id as user_id, state, winner_id from public.matches where guest_id is not null
) m
group by user_id;

grant select on public.duel_stats to anon, authenticated;

-- Realtime stream on matches: clients subscribe to their match row to react
-- to guest-join, live transitions, and final-score writes.
alter publication supabase_realtime add table public.matches;
