import { masteryFor } from '../lib/masteries.js';
import { heatColor } from '../lib/milestones.js';
import { tierBand } from '../lib/tierColor.js';

// Size preset definitions. Keys: container padding + gap + text, gem diameter.
const SIZES = {
  sm: {
    wrap: 'px-2 py-0.5 gap-1.5 text-[10px]',
    gem: 'w-2 h-2',
    label: 'font-bold uppercase tracking-widest',
  },
  md: {
    wrap: 'px-3 py-1.5 gap-2 text-xs',
    gem: 'w-2.5 h-2.5',
    label: 'font-bold uppercase tracking-widest',
  },
  lg: {
    wrap: 'px-4 py-2 gap-3 text-sm',
    gem: 'w-3.5 h-3.5',
    label: 'font-black uppercase tracking-widest',
  },
};

/**
 * Pill showing the mastery tier for a given duration. Gem color derived from
 * heatColor; when there's no mastery yet (< 3s), renders an "Unranked" chip.
 */
export default function TierBadge({ durationMs = 0, size = 'md', showLabel = true, className = '' }) {
  const preset = SIZES[size] || SIZES.md;
  const mastery = masteryFor(durationMs);
  const color = heatColor(durationMs);
  const band = tierBand(durationMs);

  const locked = band === 'locked' || !mastery;

  return (
    <span
      className={`inline-flex items-center rounded-full border ${preset.wrap} ${className} ${
        locked
          ? 'border-white/10 bg-white/5 text-gray-400'
          : 'border-white/15 bg-white/5 text-white'
      }`}
      style={locked ? undefined : { boxShadow: `0 0 12px ${color}40` }}
      title={mastery ? `${mastery.name} — ${mastery.tagline}` : 'Unranked'}
    >
      <span
        className={`${preset.gem} rounded-full shrink-0`}
        style={{
          background: locked ? 'rgba(255,255,255,0.2)' : color,
          boxShadow: locked ? 'none' : `0 0 8px ${color}`,
        }}
      />
      {showLabel && (
        <span className={preset.label}>
          {locked ? 'Unranked' : mastery.name}
        </span>
      )}
    </span>
  );
}
