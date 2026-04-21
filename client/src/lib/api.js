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

// Challenges are duration-based (handstand) or rep-based. Ordering columns
// follow from that — keep this map in sync with the challenge strategies.
const SCORE_COLUMN_BY_CHALLENGE = {
  handstand: 'best_time_ms',
  pullups: 'best_reps',
  pushups: 'best_reps',
  squats: 'best_reps',
};

function leaderboardSortColumn(challengeType) {
  return SCORE_COLUMN_BY_CHALLENGE[challengeType] ?? 'best_time_ms';
}

export const api = {
  submitAttempt: async ({ challengeType = 'handstand', durationMs, repCount, videoBlob, deviceInfo }) => {
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
        challenge_type: challengeType,
        duration_ms: durationMs != null ? Math.floor(durationMs) : null,
        rep_count: repCount != null ? Math.floor(repCount) : null,
        video_path: videoPath,
        device_info: deviceInfo ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { attempt: data };
  },

  myAttempts: async (challengeType) => {
    const user = await requireUser();
    let q = supabase
      .from('attempts')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false })
      .limit(100);
    if (challengeType) q = q.eq('challenge_type', challengeType);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { attempts: data };
  },

  leaderboardRows: async (period = 'all', challengeType = 'handstand') => {
    const since = sinceIso(period);
    const sortCol = leaderboardSortColumn(challengeType);
    let q = supabase
      .from('leaderboard_v2')
      .select('*')
      .eq('challenge_type', challengeType)
      .order(sortCol, { ascending: false, nullsFirst: false })
      .limit(50);
    if (since) q = q.gte('last_attempt_at', since);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  leaderboardStanding: async (userId, period = 'all', challengeType = 'handstand') => {
    if (!userId) return null;
    const since = sinceIso(period);
    const sortCol = leaderboardSortColumn(challengeType);
    let meQ = supabase
      .from('leaderboard_v2')
      .select(`${sortCol}, best_time_ms, best_reps`)
      .eq('user_id', userId)
      .eq('challenge_type', challengeType);
    if (since) meQ = meQ.gte('last_attempt_at', since);
    const { data: me } = await meQ.maybeSingle();
    if (me?.[sortCol] == null) return null;

    let totalQ = supabase
      .from('leaderboard_v2')
      .select('user_id', { count: 'exact', head: true })
      .eq('challenge_type', challengeType);
    if (since) totalQ = totalQ.gte('last_attempt_at', since);
    const { count: total } = await totalQ;

    let betterQ = supabase
      .from('leaderboard_v2')
      .select('user_id', { count: 'exact', head: true })
      .eq('challenge_type', challengeType)
      .gt(sortCol, me[sortCol]);
    if (since) betterQ = betterQ.gte('last_attempt_at', since);
    const { count: better } = await betterQ;

    return {
      rank: (better ?? 0) + 1,
      total_participants: total ?? 0,
      best_time_ms: me.best_time_ms ?? null,
      best_reps: me.best_reps ?? null,
      score_column: sortCol,
    };
  },

  leaderboard: async (period = 'all', challengeType = 'handstand') => {
    const leaderboard = await api.leaderboardRows(period, challengeType);
    let personal = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        personal = await api.leaderboardStanding(session.user.id, period, challengeType);
      }
    } catch {
      // swallow — standing is optional
    }
    return { period, challengeType, leaderboard, personal };
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
      .select('id, challenge_type, duration_ms, rep_count, video_path, recorded_at')
      .eq('user_id', id)
      .order('recorded_at', { ascending: false })
      .limit(100);
    if (aErr) throw new Error(aErr.message);

    // Per-challenge best score, pulled in one pass so the profile page can
    // render a per-challenge summary without firing a request per tab.
    const bestByChallenge = {};
    for (const a of attempts ?? []) {
      const score = a.rep_count ?? a.duration_ms ?? 0;
      const cur = bestByChallenge[a.challenge_type];
      if (!cur || score > cur) bestByChallenge[a.challenge_type] = score;
    }

    return {
      user: profile,
      attempts: attempts ?? [],
      bestByChallenge,
      best_time_ms: bestByChallenge.handstand ?? 0,
    };
  },

  stats: async (challengeType = 'handstand') => {
    const { count: totalAttempts } = await supabase
      .from('attempts')
      .select('id', { count: 'exact', head: true })
      .eq('challenge_type', challengeType);
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    const topCol = leaderboardSortColumn(challengeType);
    const topSelect = topCol === 'best_reps' ? 'rep_count' : 'duration_ms';
    const { data: top } = await supabase
      .from('attempts')
      .select(topSelect)
      .eq('challenge_type', challengeType)
      .order(topSelect, { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    return {
      total_attempts: totalAttempts ?? 0,
      total_users: totalUsers ?? 0,
      longest_hold_ms: challengeType === 'handstand' ? (top?.duration_ms ?? 0) : 0,
      top_score: top?.[topSelect] ?? 0,
      total_duration_ms: 0,
    };
  },

  videoUrl: (path) => {
    if (!path) return null;
    const { data } = supabase.storage.from('videos').getPublicUrl(path);
    return data?.publicUrl ?? null;
  },

  userAchievements: async () => ({ unlocked: [] }),
  achievements: async () => ({ achievements: [] }),
};
