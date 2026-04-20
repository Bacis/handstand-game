import { MASTERIES } from '../lib/masteries.js';

// 40-tier mastery showcase, rethemed to the brand palette.
// Mobile: horizontal scroll-snap rail. md+: responsive grid.
// `unlockedMs` — personal best in ms. Tiers with atSec*1000 <= unlockedMs unlock.
export default function MasteryLadder({ unlockedMs = 0, id }) {
  const unlockedCount = MASTERIES.filter((m) => m.atSec * 1000 <= unlockedMs).length;
  return (
    <div id={id} className="w-full scroll-mt-24">
      <div className="flex items-baseline justify-between mb-5 gap-4 flex-wrap">
        <h2 className="font-sans font-black tracking-tight text-3xl md:text-5xl leading-[0.95]">
          Forty <em className="font-serif italic font-light text-brand-accent">ranks.</em>
        </h2>
        <div className="font-mono uppercase tracking-[0.2em] text-[11px] text-white/55">
          {unlockedMs > 0 ? (
            <>Unlocked <span className="text-white">{unlockedCount}</span>/40</>
          ) : (
            <>From Toes Up (3s) to Vertical Monk (2m+)</>
          )}
        </div>
      </div>

      {/* Mobile rail */}
      <div className="md:hidden -mx-4 px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3">
        {MASTERIES.map((m, i) => (
          <TierCell key={m.atSec} mastery={m} idx={i} unlockedMs={unlockedMs} className="snap-center shrink-0 w-[68vw] max-w-[260px]" />
        ))}
      </div>

      {/* Grid */}
      <div className="hidden md:grid grid-cols-3 lg:grid-cols-5 gap-0 border border-brand-border rounded-md overflow-hidden bg-brand-paper">
        {MASTERIES.map((m, i) => (
          <TierCell key={m.atSec} mastery={m} idx={i} unlockedMs={unlockedMs} inGrid />
        ))}
      </div>
    </div>
  );
}

function TierCell({ mastery, idx, unlockedMs, className = '', inGrid = false }) {
  const atMs = mastery.atSec * 1000;
  const unlocked = unlockedMs >= atMs;
  const current =
    unlocked &&
    (idx === MASTERIES.length - 1 || MASTERIES[idx + 1].atSec * 1000 > unlockedMs);

  const baseBorder = inGrid
    ? 'border-r border-b border-brand-border'
    : 'border border-brand-border rounded-md';

  return (
    <div
      className={`relative p-4 md:p-5 transition ${baseBorder} ${
        unlocked ? '' : 'opacity-55'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-white/50">
          {String(idx + 1).padStart(2, '0')} · {mastery.atSec}s
        </div>
        <span
          className={`w-2 h-2 shrink-0 rounded-full ${
            current
              ? 'bg-brand-accent'
              : unlocked
              ? 'bg-white'
              : 'bg-white/15'
          }`}
          style={current ? { boxShadow: '0 0 10px #ff4d2e' } : undefined}
        />
      </div>
      <div
        className={`mt-2 font-black text-lg md:text-xl leading-tight tracking-tight ${
          current ? 'text-brand-accent' : unlocked ? 'text-white' : 'text-white/70'
        }`}
      >
        {mastery.name}
      </div>
      <div className="text-xs text-white/55 mt-1 leading-snug">{mastery.tagline}</div>
      {current && (
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-brand-accent" style={{ boxShadow: '0 0 10px #ff4d2e' }} />
      )}
    </div>
  );
}
