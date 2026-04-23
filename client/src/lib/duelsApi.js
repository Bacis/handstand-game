import { supabase } from './supabase.js';

async function requireUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user;
}

// Shape of a match row as returned by our queries. Keep in sync with the
// 0003_duels.sql schema.
const MATCH_COLS =
  'id,challenge_type,duration_s,host_id,guest_id,state,source,started_at,ended_at,host_score,guest_score,winner_id,created_at';

export const duelsApi = {
  // Host creates an invite; returns the fresh match row so the caller can
  // render a shareable link `${origin}/duel/${match.id}`.
  createInvite: async ({ challengeType = 'handstand', durationS = 60 }) => {
    const user = await requireUser();
    const { data, error } = await supabase
      .from('matches')
      .insert({
        challenge_type: challengeType,
        duration_s: durationS,
        host_id: user.id,
        source: 'invite',
      })
      .select(MATCH_COLS)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  fetchMatch: async (id) => {
    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_COLS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  // Guest attaches themselves to an invite. Allowed whenever the match is
  // still pre-live (state in pending/ready) — we intentionally *don't*
  // require guest_id to be null, so a friend whose browser-preview or
  // in-app-browser "pre-joined" the link can still claim the slot when
  // they open it properly. Once state flips to 'live' the RLS policy
  // locks the slot and this update is rejected.
  join: async (matchId) => {
    const user = await requireUser();
    const { data, error } = await supabase
      .from('matches')
      .update({ guest_id: user.id, state: 'ready' })
      .eq('id', matchId)
      .neq('host_id', user.id)
      .in('state', ['pending', 'ready'])
      .select(MATCH_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('This duel has already started or is no longer accepting players.');
    return data;
  },

  // Host-only: flip pending/ready → live with an explicit start timestamp.
  // Using a server-rounded `started_at` means both clients share a single
  // clock origin for the match countdown.
  startLive: async (matchId, startedAt) => {
    const user = await requireUser();
    const { data, error } = await supabase
      .from('matches')
      .update({ state: 'live', started_at: startedAt })
      .eq('id', matchId)
      .eq('host_id', user.id)
      .in('state', ['pending', 'ready'])
      .select(MATCH_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  // Host-only: write final scores + winner. Compares numerically (ms or reps
  // — both are scalar). Ties leave winner_id null.
  finish: async (matchId, { hostScore, guestScore }) => {
    const user = await requireUser();
    const h = Number(hostScore ?? 0);
    const g = Number(guestScore ?? 0);
    const winner_id =
      h === g
        ? null
        : h > g
        ? (await duelsApi.fetchMatch(matchId))?.host_id
        : (await duelsApi.fetchMatch(matchId))?.guest_id;
    const { data, error } = await supabase
      .from('matches')
      .update({
        state: 'done',
        ended_at: new Date().toISOString(),
        host_score: h,
        guest_score: g,
        winner_id,
      })
      .eq('id', matchId)
      .eq('host_id', user.id)
      .in('state', ['live', 'ready'])
      .select(MATCH_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  cancel: async (matchId) => {
    const user = await requireUser();
    const { data, error } = await supabase
      .from('matches')
      .update({ state: 'cancelled', ended_at: new Date().toISOString() })
      .eq('id', matchId)
      .eq('host_id', user.id)
      .in('state', ['pending', 'ready'])
      .select(MATCH_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  // Lobby queue. User calls enterLobby → subscribes to a presence channel →
  // a client-side pairing loop (see Lobby.jsx) atomically claims two queued
  // players via claimOpponent.
  enterLobby: async ({ challengeType = 'handstand', durationS = 60 }) => {
    const user = await requireUser();
    // upsert so re-entering with different settings replaces the old row.
    const { error } = await supabase
      .from('match_queue')
      .upsert(
        { user_id: user.id, challenge_type: challengeType, duration_s: durationS },
        { onConflict: 'user_id' },
      );
    if (error) throw new Error(error.message);
    return { user_id: user.id, challenge_type: challengeType, duration_s: durationS };
  },

  leaveLobby: async () => {
    const user = await requireUser();
    await supabase.from('match_queue').delete().eq('user_id', user.id);
  },

  listLobby: async ({ challengeType = 'handstand', durationS = 60 }) => {
    const { data, error } = await supabase
      .from('match_queue')
      .select('user_id,challenge_type,duration_s,created_at')
      .eq('challenge_type', challengeType)
      .eq('duration_s', durationS)
      .order('created_at', { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  // Atomic pairing: only the caller with the lexicographically smaller
  // user_id runs this. Deletes both rows in one shot and checks we got 2
  // rows back — if not, someone else claimed one of them first and we
  // abort. On success, creates the match row (source='lobby') and returns
  // it so the caller can broadcast the new matchId on the lobby channel.
  claimOpponent: async ({ opponentId, challengeType, durationS }) => {
    const user = await requireUser();
    if (user.id >= opponentId) {
      throw new Error('Only the lower user_id should call claimOpponent');
    }
    const { data: deleted, error: delErr } = await supabase
      .from('match_queue')
      .delete()
      .in('user_id', [user.id, opponentId])
      .select('user_id');
    if (delErr) throw new Error(delErr.message);
    if (!deleted || deleted.length < 2) {
      // Race lost: put ourselves back if we were deleted but opponent wasn't.
      if ((deleted ?? []).some((r) => r.user_id === user.id)) {
        await supabase
          .from('match_queue')
          .upsert(
            { user_id: user.id, challenge_type: challengeType, duration_s: durationS },
            { onConflict: 'user_id' },
          )
          .then(() => {}, () => {});
      }
      return null;
    }
    const { data: match, error: mErr } = await supabase
      .from('matches')
      .insert({
        challenge_type: challengeType,
        duration_s: durationS,
        host_id: user.id,
        guest_id: opponentId,
        source: 'lobby',
        state: 'ready',
      })
      .select(MATCH_COLS)
      .single();
    if (mErr) throw new Error(mErr.message);
    return match;
  },

  myRecord: async (userId) => {
    const { data, error } = await supabase
      .from('duel_stats')
      .select('user_id,total,wins,losses')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { user_id: userId, total: 0, wins: 0, losses: 0 };
  },

  // Human-friendly display name for a user_id — falls back to guest-<6> for
  // anonymous players who have no profile row.
  displayName: async (userId) => {
    if (!userId) return null;
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle();
    if (data?.username) return data.username;
    return `guest-${String(userId).slice(0, 6)}`;
  },
};
