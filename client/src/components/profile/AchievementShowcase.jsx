import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth.jsx';
import { ACHIEVEMENTS } from '../../lib/achievements.js';
import { getState } from '../../lib/achievementsStore.js';
import { api } from '../../lib/api.js';

export default function AchievementShowcase({ userId }) {
  const { user } = useAuth();
  const isOwn = user && String(user.id) === String(userId);
  const [unlocked, setUnlocked] = useState({}); // key -> unlocked_at iso

  useEffect(() => {
    if (isOwn) {
      const state = getState();
      setUnlocked(state.unlocked);
      return;
    }
    let cancelled = false;
    api.userAchievements(userId)
      .then((r) => {
        if (cancelled) return;
        const map = {};
        for (const row of r.unlocked || []) map[row.key] = row.unlocked_at;
        setUnlocked(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId, isOwn]);

  const count = Object.keys(unlocked).length;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg font-black uppercase tracking-wide">
          <span className="bg-aura-gradient bg-clip-text text-transparent">Achievements</span>
        </h2>
        <div className="text-xs text-gray-500 tabular-nums">{count}/{ACHIEVEMENTS.length}</div>
      </div>
      {count === 0 && !isOwn && (
        <div className="text-sm text-gray-500 border border-white/5 rounded-lg p-4">
          No achievements yet.
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {ACHIEVEMENTS.map((a) => {
          const got = Boolean(unlocked[a.key]);
          return (
            <div
              key={a.key}
              className={`rounded-lg border p-3 transition ${
                got
                  ? 'border-aura-gold/40 bg-aura-gold/5'
                  : 'border-white/5 bg-ink-800/40 opacity-60'
              }`}
              title={a.description}
            >
              <div className="flex items-center gap-2">
                <div className="text-xl shrink-0">{a.icon || '🏆'}</div>
                <div className="font-bold text-sm truncate">{a.name}</div>
              </div>
              <div className="mt-1 text-[10px] text-gray-500">
                {got ? `Unlocked ${String(unlocked[a.key]).slice(0, 10)}` : a.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
