// Back-compat shim — handstand tiers now live in challenges/handstand.js so
// they can share shape with pull-ups / push-ups / squats tiers. This module
// keeps the old `MASTERIES` (atSec form) and `masteryFor(ms)` exports working
// for MasteryLadder.jsx and TierBadge.jsx, which are handstand-scoped.

import { handstand } from './challenges/handstand.js';

export const TICK_SEC = 3;

export const MASTERIES = handstand.tiers.map((t) => ({
  atSec: Math.round(t.at / 1000),
  name: t.name,
  tagline: t.tagline,
  glyph: t.glyph,
  tier: t.tier,
}));

export function masteryFor(elapsedMs) {
  return handstand.masteryFor(elapsedMs);
}
