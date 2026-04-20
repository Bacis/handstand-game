import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatTime } from '../hooks/useTimer.js';
import { heatColor } from '../lib/milestones.js';
import { masteryFor } from '../lib/masteries.js';
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

  if (err) return <div className="max-w-3xl mx-auto px-4 py-8 text-red-400">{err}</div>;
  if (!data) return <div className="max-w-3xl mx-auto px-4 py-8 text-gray-500">Loading…</div>;

  const best = data.best_time_ms || 0;
  const ringColor = best > 0 ? heatColor(best) : 'rgba(255,255,255,0.15)';
  const mastery = masteryFor(best);
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
            <TierBadge durationMs={best} size="sm" />
            <span className="text-xs text-gray-500">
              Member since {data.user.created_at?.slice(0, 10)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <Stat
          label="Personal best"
          value={best > 0 ? formatTime(best) : '—'}
          valueStyle={best > 0 ? { color: heatColor(best) } : undefined}
        />
        <Stat
          label="Current rank"
          value={mastery ? mastery.name : 'Unranked'}
          sub={mastery ? `${Math.floor(best / 1000)}s` : ''}
        />
        <Stat
          label="Achievements"
          value={isOwn ? String(localUnlockedCount) : '—'}
          sub={isOwn ? `of ${ACHIEVEMENTS.length}` : 'private'}
        />
      </div>

      <h2 className="text-lg font-black uppercase tracking-wide mb-3">Top attempts</h2>
      <ul className="space-y-2 mb-8">
        {data.attempts.length === 0 && (
          <li className="text-gray-500">No attempts yet.</li>
        )}
        {data.attempts.map((a) => (
          <li key={a.id} className="flex items-center justify-between border border-white/5 rounded-md px-4 py-3 bg-ink-800/40">
            <div className="flex items-center gap-3 min-w-0">
              <div>
                <div className="font-black text-lg tabular-nums" style={{ color: heatColor(a.duration_ms) }}>
                  {formatTime(a.duration_ms)}
                </div>
                <div className="text-xs text-gray-500">{a.recorded_at?.replace('T', ' ').slice(0, 16)}</div>
              </div>
              <TierBadge durationMs={a.duration_ms} size="sm" />
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
        ))}
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
