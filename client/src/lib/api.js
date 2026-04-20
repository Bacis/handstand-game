import { supabase } from './supabase.js';

async function requireUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user;
}

function sinceIso(period) {
  if (period === 'week') return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (period === 'today') return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return null;
}

export const api = {
  submitAttempt: async ({ durationMs, videoBlob, deviceInfo }) => {
    const user = await requireUser();

    let videoPath = null;
    if (videoBlob) {
      const ext = videoBlob.type?.includes('mp4') ? 'mp4' : 'webm';
      videoPath = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('videos')
        .upload(videoPath, videoBlob, { contentType: videoBlob.type || `video/${ext}` });
      if (upErr) throw new Error(`upload failed: ${upErr.message}`);
    }

    const { data, error } = await supabase
      .from('attempts')
      .insert({
        user_id: user.id,
        duration_ms: Math.floor(durationMs),
        video_path: videoPath,
        device_info: deviceInfo ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { attempt: data };
  },

  myAttempts: async () => {
    const user = await requireUser();
    const { data, error } = await supabase
      .from('attempts')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { attempts: data };
  },

  // Public rows — no auth calls, so this can never hang on a flaky session.
  leaderboardRows: async (period = 'all') => {
    const since = sinceIso(period);
    let q = supabase
      .from('leaderboard')
      .select('*')
      .order('best_time_ms', { ascending: false })
      .limit(50);
    if (since) q = q.gte('last_attempt_at', since);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  // Personal standing — optional decoration. Called only when we already have
  // a user id from React state, so no auth round-trip is needed.
  leaderboardStanding: async (userId, period = 'all') => {
    if (!userId) return null;
    const since = sinceIso(period);
    let meQ = supabase.from('leaderboard').select('best_time_ms').eq('user_id', userId);
    if (since) meQ = meQ.gte('last_attempt_at', since);
    const { data: me } = await meQ.maybeSingle();
    if (me?.best_time_ms == null) return null;

    let totalQ = supabase.from('leaderboard').select('user_id', { count: 'exact', head: true });
    if (since) totalQ = totalQ.gte('last_attempt_at', since);
    const { count: total } = await totalQ;

    let betterQ = supabase
      .from('leaderboard')
      .select('user_id', { count: 'exact', head: true })
      .gt('best_time_ms', me.best_time_ms);
    if (since) betterQ = betterQ.gte('last_attempt_at', since);
    const { count: better } = await betterQ;

    return {
      rank: (better ?? 0) + 1,
      total_participants: total ?? 0,
      best_time_ms: me.best_time_ms,
    };
  },

  // Back-compat wrapper — some callers (e.g. LeaderboardPeek on home) still
  // use the combined shape. Rows first; standing is best-effort.
  leaderboard: async (period = 'all') => {
    const leaderboard = await api.leaderboardRows(period);
    let personal = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        personal = await api.leaderboardStanding(session.user.id, period);
      }
    } catch {
      // swallow — standing is optional
    }
    return { period, leaderboard, personal };
  },

  user: async (id) => {
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('id, username, created_at')
      .eq('id', id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile) throw new Error('User not found');

    const { data: attempts, error: aErr } = await supabase
      .from('attempts')
      .select('id, duration_ms, video_path, recorded_at')
      .eq('user_id', id)
      .order('duration_ms', { ascending: false })
      .limit(20);
    if (aErr) throw new Error(aErr.message);

    return {
      user: profile,
      attempts: attempts ?? [],
      best_time_ms: attempts?.[0]?.duration_ms ?? 0,
    };
  },

  stats: async () => {
    const { count: totalAttempts } = await supabase
      .from('attempts')
      .select('id', { count: 'exact', head: true });
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    const { data: longest } = await supabase
      .from('attempts')
      .select('duration_ms')
      .order('duration_ms', { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      total_attempts: totalAttempts ?? 0,
      total_users: totalUsers ?? 0,
      longest_hold_ms: longest?.duration_ms ?? 0,
      total_duration_ms: 0,
    };
  },

  videoUrl: (path) => {
    if (!path) return null;
    const { data } = supabase.storage.from('videos').getPublicUrl(path);
    return data?.publicUrl ?? null;
  },

  // Achievements live in client state for now; the Supabase-backed version is
  // out of scope for this pass. Callers see an empty unlock list for others.
  userAchievements: async () => ({ unlocked: [] }),
  achievements: async () => ({ achievements: [] }),
};
