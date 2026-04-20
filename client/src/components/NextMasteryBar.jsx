import { useMemo } from 'react';
import { MASTERIES, masteryFor } from '../lib/masteries.js';
import { heatColor } from '../lib/milestones.js';

// Displayed inside the video frame during TRACKING. Rate-gated to 10 Hz
// via a `bucket` memo so the overlay rAF loop doesn't pay for a React
// reconcile on every frame. Shows the current rank + progress toward the next.
export default function NextMasteryBar({ elapsedMs = 0 }) {
  const bucket = Math.floor(elapsedMs / 100);

  const data = useMemo(() => {
    const current = masteryFor(elapsedMs);
    const currentAtSec = current ? MASTERIES.find((m) => m.name === current.name)?.atSec : 0;
    // If current came from the named ladder, find the next by index; else compute
    // next as the next 3s boundary past elapsed.
    const idx = MASTERIES.findIndex((m) => m.atSec === currentAtSec);
    const nextAtSec = idx >= 0 && idx < MASTERIES.length - 1
      ? MASTERIES[idx + 1].atSec
      : Math.ceil((elapsedMs + 1) / 3000) * 3;
    const nextName =
      idx >= 0 && idx < MASTERIES.length - 1
        ? MASTERIES[idx + 1].name
        : (masteryFor(nextAtSec * 1000)?.name || '—');
    const baseMs = (currentAtSec || 0) * 1000;
    const spanMs = Math.max(1, nextAtSec * 1000 - baseMs);
    const pct = Math.max(0, Math.min(1, (elapsedMs - baseMs) / spanMs));
    const remaining = Math.max(0, nextAtSec * 1000 - elapsedMs);
    return {
      color: heatColor(elapsedMs),
      nextName,
      nextAtSec,
      pct,
      remainingSec: Math.ceil(remaining / 1000),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket]);

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[min(420px,80%)] pointer-events-none select-none">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-bold mb-1 text-gray-300">
        <span>Next: <span style={{ color: data.color }}>{data.nextName}</span></span>
        <span className="tabular-nums text-gray-400">{data.remainingSec}s</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full transition-[width] duration-100"
          style={{
            width: `${data.pct * 100}%`,
            background: data.color,
            boxShadow: `0 0 12px ${data.color}`,
          }}
        />
      </div>
    </div>
  );
}
