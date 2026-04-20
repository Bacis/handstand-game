import { heatColor } from './milestones.js';
import { masteryFor } from './masteries.js';

// Tier bands — broad grouping for framing/glow. The gem color itself comes
// from heatColor(ms); this helper groups tiers into bronze/silver/gold/
// platinum/mythic bands so UI chrome (ring class, shadow class) can pick
// per-band styling without re-doing the heatColor math.
export function tierBand(durationMs) {
  const sec = Math.max(0, durationMs / 1000);
  if (sec < 3) return 'locked';
  if (sec < 15) return 'bronze';
  if (sec < 30) return 'silver';
  if (sec < 60) return 'gold';
  if (sec < 120) return 'platinum';
  return 'mythic';
}

const RING = {
  locked:    'ring-white/10',
  bronze:    'ring-orange-400/50',
  silver:    'ring-gray-300/50',
  gold:      'ring-yellow-400/60',
  platinum:  'ring-aura-cyan/60',
  mythic:    'ring-aura-purple/70',
};

const SHADOW = {
  locked:    '',
  bronze:    'shadow-[0_0_16px_rgba(251,146,60,0.35)]',
  silver:    'shadow-[0_0_18px_rgba(203,213,225,0.35)]',
  gold:      'shadow-glow-gold',
  platinum:  'shadow-glow-cyan',
  mythic:    'shadow-glow-lg',
};

export function tierRingClass(durationMs) {
  return RING[tierBand(durationMs)] || RING.locked;
}

export function tierShadowClass(durationMs) {
  return SHADOW[tierBand(durationMs)] || '';
}

export function tierColor(durationMs) {
  return heatColor(Math.max(0, durationMs || 0));
}

export function tierName(durationMs) {
  return masteryFor(durationMs)?.name || 'Unranked';
}
