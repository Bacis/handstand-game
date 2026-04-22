import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth.jsx';
import { getPersonalBest } from '../../lib/personalBest.js';
import { getState } from '../../lib/achievementsStore.js';
import { MASTERIES, masteryFor } from '../../lib/masteries.js';
import { formatTime } from '../../hooks/useTimer.js';

export default function MyProgressStrip() {
  const { user } = useAuth();
  const [pb, setPb] = useState(0);
  const [unlockedCount, setUnlockedCount] = useState(0);

  useEffect(() => {
    setPb(getPersonalBest());
    setUnlockedCount(Object.keys(getState().unlocked).length);
  }, []);

  if (!user || user.isAnonymous) return null;

  const current = masteryFor(pb);
  const currentIdx = current ? MASTERIES.findIndex((m) => m.name === current.name) : -1;
  const next = currentIdx >= 0 && currentIdx < MASTERIES.length - 1 ? MASTERIES[currentIdx + 1] : null;
  const baseMs = current ? MASTERIES[currentIdx].atSec * 1000 : 0;
  const nextMs = next ? next.atSec * 1000 : baseMs + 3000;
  const pct = pb > 0 ? Math.max(0, Math.min(1, (pb - baseMs) / Math.max(1, nextMs - baseMs))) : 0;

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-7">
      <div className="border border-brand-border rounded-md bg-brand-paper p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-5">
        <div className="min-w-0 flex-1">
          <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-brand-accent flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent motion-safe:animate-[pulseOp_1.2s_ease-in-out_infinite]" />
            Welcome back, {user.username}
          </div>
          <div className="flex items-baseline gap-4 mt-2 flex-wrap">
            <div className="text-4xl md:text-5xl font-black tabular-nums tracking-tight">
              {pb > 0 ? formatTime(pb) : '—'}
            </div>
            {current && (
              <div className="font-mono uppercase tracking-[0.2em] text-[11px] text-white/70">
                {current.name}
              </div>
            )}
            <span className="font-mono uppercase tracking-[0.18em] text-[10px] text-white/45">
              · {unlockedCount} achievements
            </span>
          </div>
          {next && (
            <div className="mt-4">
              <div className="flex justify-between font-mono uppercase tracking-[0.2em] text-[10px] text-white/55 mb-1.5">
                <span>Next: <span className="text-white">{next.name}</span></span>
                <span className="tabular-nums">{Math.max(0, Math.ceil((nextMs - pb) / 1000))}s to go</span>
              </div>
              <div className="h-[3px] bg-white/10 overflow-hidden rounded-sm">
                <div
                  className="h-full bg-brand-accent"
                  style={{ width: `${pct * 100}%`, boxShadow: '0 0 10px #ff4d2e' }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <Link
            to="/play"
            className="inline-flex items-center gap-3 bg-brand-accent text-black font-mono font-bold uppercase tracking-[0.14em] text-[12px] px-5 py-3 rounded-sm hover:-translate-y-px transition"
          >
            <span className="w-4 h-4 grid place-items-center bg-black text-brand-accent rounded-full text-[9px]">▶</span>
            Continue
          </Link>
          <Link
            to={`/profile/${user.id}`}
            className="inline-flex items-center gap-3 border border-white/25 text-white font-mono font-bold uppercase tracking-[0.14em] text-[12px] px-5 py-3 rounded-sm hover:border-white/50 transition"
          >
            My profile
          </Link>
        </div>
      </div>
    </section>
  );
}
