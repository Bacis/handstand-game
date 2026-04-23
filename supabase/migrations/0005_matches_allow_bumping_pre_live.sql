-- 0004 let a non-host claim an empty guest slot. In practice we also see
-- "ghost" guests: link-preview bots, in-app browser sessions, private-mode
-- pre-fetches — any of those can grab the guest slot before the real
-- friend's browser even opens the link, and then that friend sees
-- "This duel is in progress" on their first try.
--
-- Since a pre-live match (state = pending or ready) isn't actually running
-- yet, it's safe to let a new non-host claimant replace whoever is
-- currently in the guest slot. The moment state flips to 'live' the slot
-- becomes immutable, so this can't disrupt an in-progress duel.

drop policy if exists matches_update_participants on public.matches;

create policy matches_update_participants on public.matches
  for update using (
    -- Existing participants can always update (host writing final scores,
    -- guest updating their own presence, etc).
    auth.uid() in (host_id, guest_id)
    -- Or a non-host can claim / bump the guest slot while the match is
    -- still in a pre-live state.
    or (auth.uid() is not null
        and auth.uid() <> host_id
        and state in ('pending', 'ready'))
  )
  with check (auth.uid() in (host_id, guest_id));
