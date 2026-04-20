// Milestone tiers — drive both the floating counter and the aura color/intensity.
// Each tier kicks in at `enterAt` (ms held).

export const MILESTONES = [
  {
    id: 'starter',
    enterAt: 0,
    label: null,
    counterColor: '#FFFFFF',
    fontSize: 64,
    glowRadius: 0,
    auraColor: '#3B82F6',
    auraIntensity: 0.3,
    floatBob: 0,
  },
  {
    id: 'five',
    enterAt: 5_000,
    label: '5s!',
    counterColor: '#22D3EE',
    fontSize: 72,
    glowRadius: 12,
    auraColor: '#22C55E',
    auraIntensity: 0.5,
    floatBob: 0,
  },
  {
    id: 'fifteen',
    enterAt: 15_000,
    label: '15s!',
    counterColor: '#A855F7',
    fontSize: 80,
    glowRadius: 22,
    auraColor: '#A855F7',
    auraIntensity: 0.7,
    floatBob: 0.04,
  },
  {
    id: 'thirty',
    enterAt: 30_000,
    label: '30s!',
    counterColor: '#EAB308',
    fontSize: 88,
    glowRadius: 30,
    auraColor: '#EAB308',
    auraIntensity: 0.9,
    floatBob: 0.06,
  },
  {
    id: 'minute',
    enterAt: 60_000,
    label: '1 MIN!',
    counterColor: 'rainbow',
    fontSize: 96,
    glowRadius: 40,
    auraColor: '#FFFFFF',
    auraIntensity: 1.0,
    floatBob: 0.08,
  },
];

export function milestoneFor(elapsedMs) {
  let current = MILESTONES[0];
  for (const m of MILESTONES) {
    if (elapsedMs >= m.enterAt) current = m;
  }
  return current;
}

/** Returns the just-crossed milestone if elapsed transitioned past one this tick. */
export function crossedMilestone(prevMs, nextMs) {
  for (const m of MILESTONES) {
    if (m.enterAt > 0 && prevMs < m.enterAt && nextMs >= m.enterAt) return m;
  }
  return null;
}

export function rainbowColor(elapsedMs) {
  const hue = (elapsedMs / 20) % 360;
  return `hsl(${hue}, 90%, 60%)`;
}

// ---------------------------------------------------------------------------
// Heat color: shifts the timer + skeleton + banner color as the hold grows
// longer, like an ember catching fire. Cool/white at 0s → pale yellow → bright
// orange → deep red around 60s+. Returned as #RRGGBB so existing `${color}cc`
// alpha-suffix patterns keep working.
// ---------------------------------------------------------------------------
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const v = l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return Math.round(255 * v).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function heatColor(elapsedMs) {
  const seconds = Math.max(0, elapsedMs / 1000);
  // Stage 1 (0–10s): bright green — encouragement zone. Hue drifts gently
  // from pure green (120°) toward yellow-green (~90°) over the 10s.
  // Stage 2 (10s+): rapid burn through yellow → orange → red, hitting full
  // red around 17s, then plateau at deep red.
  let hue;
  if (seconds <= 10) {
    hue = 120 - 30 * (seconds / 10);            // 120° → 90°
  } else {
    const t = Math.min(1, (seconds - 10) / 7);  // 10s → 17s — very fast burn
    hue = 90 - 90 * t;                          // 90° → 0°
  }
  const burnT = Math.min(1, Math.max(0, seconds - 10) / 7);
  const sat = 70 + 30 * burnT;                  // 70% → 100%
  const light = 60 - 10 * burnT;                // 60% → 50%
  return hslToHex(hue, sat, light);
}

/** Glow radius — small green halo at the start, max-out around the burn point. */
export function heatGlowRadius(elapsedMs) {
  const seconds = Math.max(0, elapsedMs / 1000);
  if (seconds <= 10) return 6 + seconds * 0.4;          // 6 → 10 over 10s
  return Math.min(40, 10 + (seconds - 10) * 4.3);       // 10 → 40 by ~17s
}

/**
 * Granular every-N-seconds tick achievements — separate from the big tier
 * milestones. Each tick gets a small ding + tiny particle burst, but no
 * fanfare, no color change, no label. Pure dopamine on a 3s cadence.
 */
export const TICK_MS = 3_000;

/** Returns true if `next` crossed at least one tick boundary past `prev`. */
export function crossedTick(prevMs, nextMs, intervalMs = TICK_MS) {
  if (prevMs <= 0 && nextMs > 0) prevMs = 0;
  return Math.floor(prevMs / intervalMs) < Math.floor(nextMs / intervalMs);
}
