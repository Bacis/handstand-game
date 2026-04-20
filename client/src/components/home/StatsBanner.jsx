import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import StatCounter from '../StatCounter.jsx';

const fmtDuration = (ms) => {
  const totalSec = Math.floor((ms || 0) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  const s = totalSec % 60;
  return `${m}m ${s}s`;
};

const fmtClock = (ms) => {
  const totalSec = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const valueBaseClass =
  'text-3xl md:text-5xl font-black tabular-nums tracking-tight';
const labelClass =
  'font-mono uppercase tracking-[0.2em] text-[10px] text-white/55 mt-2';

export default function StatsBanner() {
  const [stats, setStats] = useState({
    total_attempts: 0,
    total_duration_ms: 0,
    total_users: 0,
    longest_hold_ms: 0,
  });

  useEffect(() => {
    let cancelled = false;
    api.stats()
      .then((r) => { if (!cancelled) setStats(r); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-7">
      <div className="grid grid-cols-2 md:grid-cols-4 border border-brand-border rounded-md overflow-hidden bg-brand-paper">
        <StatCell
          value={stats.total_attempts}
          label="Holds logged"
        />
        <StatCell
          value={stats.total_duration_ms}
          label="Time inverted"
          format={fmtDuration}
        />
        <StatCell
          value={stats.total_users}
          label="Handstanders"
        />
        <StatCell
          value={stats.longest_hold_ms}
          label="Longest hold"
          format={fmtClock}
          accent
        />
      </div>
    </section>
  );
}

function StatCell({ value, label, format, accent = false }) {
  return (
    <div className="p-5 md:p-6 border-r border-brand-border last:border-r-0 [&:nth-child(2n)]:border-r-0 md:[&:nth-child(2n)]:border-r md:[&:nth-child(4n)]:border-r-0">
      <StatCounter
        value={value}
        label={label}
        format={format}
        valueClassName={`${valueBaseClass} ${accent ? 'text-brand-accent' : 'text-white'}`}
        labelClassName={labelClass}
      />
    </div>
  );
}
