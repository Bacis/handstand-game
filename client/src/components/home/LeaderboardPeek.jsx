import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { formatTime } from '../../hooks/useTimer.js';

export default function LeaderboardPeek() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.leaderboard('all')
      .then((r) => { if (!cancelled) setRows((r.leaderboard || []).slice(0, 5)); })
      .catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-7">
      <div className="flex items-baseline justify-between mb-5 gap-4 flex-wrap">
        <h2 className="font-sans font-black tracking-tight text-3xl md:text-5xl leading-[0.95]">
          Top <em className="font-serif italic font-light text-brand-accent">five</em>
        </h2>
        <Link
          to="/leaderboard"
          className="font-mono uppercase tracking-[0.2em] text-[11px] text-brand-accent hover:underline"
        >
          See full board →
        </Link>
      </div>
      <div className="border border-brand-border rounded-md overflow-hidden bg-brand-paper">
        {rows === null && (
          <div className="px-4 py-8 text-center font-mono uppercase tracking-[0.18em] text-[10px] text-white/45">
            Loading…
          </div>
        )}
        {rows?.length === 0 && (
          <div className="px-4 py-8 text-center font-mono uppercase tracking-[0.18em] text-[10px] text-white/45">
            Nobody&apos;s submitted yet. Be first.
          </div>
        )}
        {rows?.map((row, i) => (
          <Link
            to={`/profile/${row.user_id}`}
            key={row.user_id}
            className={`flex items-center gap-4 px-4 md:px-6 py-4 border-b border-brand-border last:border-b-0 hover:bg-white/[0.03] transition ${
              i === 0 ? 'bg-brand-accent/[0.04]' : ''
            }`}
          >
            <div className="font-mono text-[11px] tracking-[0.2em] text-white/55 w-8 shrink-0">
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold truncate">{row.username}</div>
              <div className="font-mono uppercase tracking-[0.18em] text-[10px] text-white/45 mt-0.5">
                {row.total_attempts} attempts
              </div>
            </div>
            <div className={`text-2xl font-black tabular-nums shrink-0 w-24 text-right ${
              i === 0 ? 'text-brand-accent' : 'text-white'
            }`}>
              {formatTime(row.best_time_ms)}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
