import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { CHALLENGES, challengeOrDefault } from '../lib/challenges/index.js';
import { heatColor } from '../lib/milestones.js';
import TierBadge from '../components/TierBadge.jsx';
import AchievementShowcase from '../components/profile/AchievementShowcase.jsx';
import { useAuth } from '../lib/auth.jsx';
import { ACHIEVEMENTS } from '../lib/achievements.js';
import { getState } from '../lib/achievementsStore.js';

export default function Profile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [activeChallengeId, setActiveChallengeId] = useState('handstand');
  const [localUnlockedCount, setLocalUnlockedCount] = useState(0);

  useEffect(() => {
    setData(null);
    setErr(null);
    api.user(id).then(setData).catch((e) => setErr(e.message));
  }, [id]);

  useEffect(() => {
    if (user && String(user.id) === String(id)) {
      setLocalUnlockedCount(Object.keys(getState().unlocked).length);
    }
  }, [user, id]);

  const challenge = challengeOrDefault(activeChallengeId);

  const attemptsForChallenge = useMemo(() => {
    if (!data) return [];
    return data.attempts
      .filter((a) => a.challenge_type === challenge.id)
      .sort((a, b) => {
        const sa = a.rep_count ?? a.duration_ms ?? 0;
        const sb = b.rep_count ?? b.duration_ms ?? 0;
        return sb - sa;
      })
      .slice(0, 20);
  }, [data, challenge.id]);

  if (err) return <div className="max-w-3xl mx-auto px-4 py-8 text-red-400">{err}</div>;
  if (!data) return <div className="max-w-3xl mx-auto px-4 py-8 text-gray-500">Loading…</div>;

  const best = data.bestByChallenge?.[challenge.id] ?? 0;
  const handstandBest = data.bestByChallenge?.handstand ?? 0;
  const ringColor = handstandBest > 0 ? heatColor(handstandBest) : 'rgba(255,255,255,0.15)';
  const mastery = challenge.masteryFor(best);
  const isOwn = user && String(user.id) === String(id);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-20 h-20 rounded-full bg-aura-purple/20 flex items-center justify-center text-3xl font-black shrink-0"
          style={{
            boxShadow: `0 0 0 3px ${ringColor}, 0 0 24px ${ringColor}66`,
          }}
        >
          {data.user.username.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="text-3xl font-black truncate">{data.user.username}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <TierBadge durationMs={handstandBest} size="sm" />
            <span className="text-xs text-gray-500">
              Member since {data.user.created_at?.slice(0, 10)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {CHALLENGES.map((c) => {
          const active = c.id === challenge.id;
          const cBest = data.bestByChallenge?.[c.id] ?? 0;
          return (
            <button
              key={c.id}
              onClick={() => setActiveChallengeId(c.id)}
              className={`font-mono uppercase tracking-[0.16em] text-[10px] font-bold px-3 py-2 rounded-sm transition border flex items-center gap-2 ${
                active
                  ? 'bg-white text-ink-900 border-white'
                  : 'text-white/70 hover:text-white border-brand-border hover:border-white/30'
              }`}
            >
              <span aria-hidden style={{ color: active ? '#000' : c.accent }}>{c.icon}</span>
              {c.label}
              {cBest > 0 && (
                <span className="font-sans font-black ml-1 tabular-nums text-[10px]">
                  {c.formatScoreShort(cBest)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <Stat
          label={`${challenge.label} PB`}
          value={best > 0 ? challenge.formatScore(best) : '—'}
          valueStyle={best > 0 && challenge.id === 'handstand' ? { color: heatColor(best) } : undefined}
        />
        <Stat
          label="Current rank"
          value={mastery ? mastery.name : 'Unranked'}
          sub={mastery ? `${challenge.formatScore(best)}` : ''}
        />
        <Stat
          label="Achievements"
          value={isOwn ? String(localUnlockedCount) : '—'}
          sub={isOwn ? `of ${ACHIEVEMENTS.length}` : 'private'}
        />
      </div>

      <h2 className="text-lg font-black uppercase tracking-wide mb-3">Top {challenge.label.toLowerCase()} attempts</h2>
      <ul className="space-y-2 mb-8">
        {attemptsForChallenge.length === 0 && (
          <li className="text-gray-500">No {challenge.label.toLowerCase()} attempts yet.</li>
        )}
        {attemptsForChallenge.map((a) => {
          const score = a.rep_count ?? a.duration_ms ?? 0;
          const color = challenge.id === 'handstand' ? heatColor(a.duration_ms ?? 0) : challenge.accent;
          return (
            <li key={a.id} className="flex items-center justify-between border border-white/5 rounded-md px-4 py-3 bg-ink-800/40">
              <div className="flex items-center gap-3 min-w-0">
                <div>
                  <div className="font-black text-lg tabular-nums" style={{ color }}>
                    {challenge.formatScore(score)}
                  </div>
                  <div className="text-xs text-gray-500">{a.recorded_at?.replace('T', ' ').slice(0, 16)}</div>
                </div>
                {challenge.id === 'handstand' && <TierBadge durationMs={a.duration_ms ?? 0} size="sm" />}
              </div>
              {a.video_path && (
                <a
                  href={api.videoUrl(a.video_path)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-aura-cyan text-sm hover:underline shrink-0 ml-3"
                >
                  Watch clip
                </a>
              )}
            </li>
          );
        })}
      </ul>

      <AchievementShowcase userId={id} />
    </div>
  );
}

function Stat({ label, value, sub, valueStyle }) {
  return (
    <div className="border border-white/5 rounded-lg p-3 md:p-4 bg-ink-800/50">
      <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{label}</div>
      <div className="text-xl md:text-2xl font-black tabular-nums mt-1 truncate" style={valueStyle}>{value}</div>
      {sub && <div className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">{sub}</div>}
    </div>
  );
}
