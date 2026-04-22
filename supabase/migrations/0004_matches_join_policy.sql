-- 0003's matches_update_participants policy blocked would-be guests from
-- attaching to a match. Its USING clause required the caller to already be
-- host_id or guest_id, but at join time the caller is neither (guest_id is
-- null), so the UPDATE was silently rejected — hosts never saw anyone join.
--
-- Replacement: also allow the update when guest_id is null and the caller
-- isn't the host (claiming the open slot). WITH CHECK stays strict so the
-- row *after* the update must include the caller as a participant — no
-- tampering with matches you don't belong to.

drop policy if exists matches_update_participants on public.matches;

create policy matches_update_participants on public.matches
  for update
  using (
    auth.uid() in (host_id, guest_id)
    or (guest_id is null and auth.uid() is not null and auth.uid() <> host_id)
  )
  with check (auth.uid() in (host_id, guest_id));
