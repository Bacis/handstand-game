// Shared challenge utilities — mastery lookup, score → progress mapping,
// formatting helpers used across handstand + rep-based challenges.

import { formatTime } from '../../hooks/useTimer.js';

const ROMAN = ['', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
function roman(n) { return ROMAN[Math.min(n, ROMAN.length - 1)]; }

/**
 * Generic mastery lookup. `tiers` is an ordered list, each tier unlocks at
 * `at` (in the challenge's native score unit — ms for handstand, reps for
 * others). Beyond the last tier, the final name repeats with Roman suffixes.
 */
export function pickMastery(score, tiers) {
  if (!tiers?.length || score <= 0) return null;
  let idx = -1;
  for (let i = 0; i < tiers.length; i++) {
    if (score >= tiers[i].at) idx = i;
    else break;
  }
  if (idx < 0) return null;
  // Compute how many "laps" past the last tier we've done, using the spacing
  // of the final interval as the tick size. E.g. tiers ending at 120s with a
  // 3s spacing → 123s gives overflow II, 126s gives III, etc.
  const last = tiers[tiers.length - 1];
  if (idx < tiers.length - 1) return tiers[idx];
  const prev = tiers[tiers.length - 2] ?? { at: 0 };
  const step = Math.max(1, last.at - prev.at);
  const overflow = 1 + Math.floor((score - last.at) / step);
  if (overflow <= 1) return last;
  return { ...last, name: `${last.name} ${roman(overflow)}` };
}

/**
 * Fires once per new mastery tier. Returns true when `next` crossed into a
 * new tier relative to `prev`.
 */
export function crossedMasteryTier(prev, next, tiers) {
  const a = pickMastery(prev, tiers);
  const b = pickMastery(next, tiers);
  if (!b) return false;
  if (!a) return true;
  return a.name !== b.name;
}

/** 0→1 progress toward the next unreached tier. Used for heat/color ramps. */
export function masteryProgress(score, tiers) {
  if (!tiers?.length) return 0;
  const top = tiers[tiers.length - 1].at;
  if (top <= 0) return 0;
  return Math.max(0, Math.min(1, score / top));
}

export { formatTime };
