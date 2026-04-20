// Pre-baked handstand cycle. Normalized coords in [-1, 1], y-down (screen convention).
// Landmark indices follow MediaPipe Pose. Only joints drawn by SKELETON_EDGES are authored.

export const SKELETON_EDGES = [
  [11, 13], [13, 15],                        // left arm
  [12, 14], [14, 16],                        // right arm
  [11, 12], [11, 23], [12, 24], [23, 24],    // shoulders + torso
  [23, 25], [25, 27],                        // left leg
  [24, 26], [26, 28],                        // right leg
];

// Joints we care about — matches edges above, plus nose for head.
export const JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

const STAND = {
  0:  { x:  0.00, y: -0.85 },
  11: { x: -0.15, y: -0.55 }, 12: { x:  0.15, y: -0.55 },
  13: { x: -0.18, y: -0.30 }, 14: { x:  0.18, y: -0.30 },
  15: { x: -0.20, y: -0.05 }, 16: { x:  0.20, y: -0.05 },
  23: { x: -0.10, y:  0.00 }, 24: { x:  0.10, y:  0.00 },
  25: { x: -0.10, y:  0.35 }, 26: { x:  0.10, y:  0.35 },
  27: { x: -0.10, y:  0.75 }, 28: { x:  0.10, y:  0.75 },
};

const PIKE = {
  0:  { x:  0.00, y:  0.18 },
  11: { x: -0.12, y:  0.08 }, 12: { x:  0.12, y:  0.08 },
  13: { x: -0.14, y:  0.38 }, 14: { x:  0.14, y:  0.38 },
  15: { x: -0.16, y:  0.68 }, 16: { x:  0.16, y:  0.68 },
  23: { x: -0.10, y: -0.22 }, 24: { x:  0.10, y: -0.22 },
  25: { x: -0.10, y:  0.05 }, 26: { x:  0.10, y:  0.05 },
  27: { x: -0.10, y:  0.32 }, 28: { x:  0.10, y:  0.32 },
};

const KICK = {
  0:  { x:  0.00, y:  0.52 },
  11: { x: -0.15, y:  0.40 }, 12: { x:  0.15, y:  0.40 },
  13: { x: -0.17, y:  0.60 }, 14: { x:  0.17, y:  0.60 },
  15: { x: -0.18, y:  0.82 }, 16: { x:  0.18, y:  0.82 },
  23: { x: -0.10, y:  0.08 }, 24: { x:  0.10, y:  0.08 },
  25: { x: -0.18, y: -0.20 }, 26: { x:  0.02, y: -0.22 },
  27: { x: -0.25, y: -0.48 }, 28: { x:  0.12, y: -0.42 },
};

const HANDSTAND = {
  0:  { x:  0.00, y:  0.55 },
  11: { x: -0.15, y:  0.40 }, 12: { x:  0.15, y:  0.40 },
  13: { x: -0.17, y:  0.62 }, 14: { x:  0.17, y:  0.62 },
  15: { x: -0.18, y:  0.85 }, 16: { x:  0.18, y:  0.85 },
  23: { x: -0.10, y:  0.05 }, 24: { x:  0.10, y:  0.05 },
  25: { x: -0.10, y: -0.35 }, 26: { x:  0.10, y: -0.35 },
  27: { x: -0.10, y: -0.80 }, 28: { x:  0.10, y: -0.80 },
};

const HOLLOW = {
  0:  { x: -0.02, y:  0.55 },
  11: { x: -0.15, y:  0.40 }, 12: { x:  0.15, y:  0.40 },
  13: { x: -0.17, y:  0.62 }, 14: { x:  0.17, y:  0.62 },
  15: { x: -0.18, y:  0.85 }, 16: { x:  0.18, y:  0.85 },
  23: { x: -0.05, y:  0.08 }, 24: { x:  0.15, y:  0.08 },
  25: { x: -0.02, y: -0.30 }, 26: { x:  0.18, y: -0.30 },
  27: { x:  0.02, y: -0.72 }, 28: { x:  0.22, y: -0.72 },
};

// Full timeline. Emphasizes the handstand hold — most of the loop is inverted.
const TIMELINE = [
  { t: 0.0,  pose: STAND },
  { t: 1.2,  pose: PIKE },
  { t: 2.0,  pose: KICK },
  { t: 2.7,  pose: HANDSTAND },
  { t: 3.2,  pose: HOLLOW },
  { t: 3.7,  pose: HANDSTAND },
  { t: 4.2,  pose: HOLLOW },
  { t: 4.7,  pose: HANDSTAND },
  { t: 5.4,  pose: KICK },
  { t: 6.1,  pose: PIKE },
  { t: 7.0,  pose: STAND },
];

export const LOOP_DURATION = TIMELINE[TIMELINE.length - 1].t;

function lerp(a, b, u) { return a + (b - a) * u; }
// cosine ease so keyframe transitions feel like motion, not linear tweens
function ease(u) { return 0.5 - 0.5 * Math.cos(Math.PI * u); }

// During the handstand hold, legs gently fan apart — mimics the natural tendency
// to straddle for balance. Peaks mid-handstand, zero outside the inverted window,
// so lead-in/out motion (kick-up, descent) is unaffected.
const SPLIT_START = 2.6;
const SPLIT_END   = 5.0;
const SPLIT_PEAK  = 3.8;

export function applySplitOverlay(pose, tSeconds) {
  const phase = ((tSeconds % LOOP_DURATION) + LOOP_DURATION) % LOOP_DURATION;
  if (phase < SPLIT_START || phase > SPLIT_END) return pose;
  const linear = phase < SPLIT_PEAK
    ? (phase - SPLIT_START) / (SPLIT_PEAK - SPLIT_START)
    : (SPLIT_END - phase) / (SPLIT_END - SPLIT_PEAK);
  const amount = ease(Math.min(1, Math.max(0, linear)));
  const out = { ...pose };
  // side: -1 for left-of-body joints, +1 for right. dx pushes outward in screen x;
  // dy pulls legs up toward the hips (y-down, inverted body => dy positive raises feet).
  const warp = (idx, side, dx, dy) => {
    const p = pose[idx];
    if (!p) return;
    out[idx] = { x: p.x + side * dx * amount, y: p.y + dy * amount };
  };
  warp(25, -1, 0.20, 0.15); // left knee
  warp(27, -1, 0.55, 0.40); // left ankle
  warp(26, +1, 0.20, 0.15); // right knee
  warp(28, +1, 0.55, 0.40); // right ankle
  return out;
}

export function samplePose(tSeconds) {
  const phase = ((tSeconds % LOOP_DURATION) + LOOP_DURATION) % LOOP_DURATION;
  let i = 0;
  while (i < TIMELINE.length - 1 && TIMELINE[i + 1].t <= phase) i++;
  const a = TIMELINE[i];
  const b = TIMELINE[i + 1] || TIMELINE[i];
  const span = b.t - a.t || 1;
  const u = ease((phase - a.t) / span);
  const out = {};
  for (const idx of JOINTS) {
    const pa = a.pose[idx];
    const pb = b.pose[idx];
    out[idx] = { x: lerp(pa.x, pb.x, u), y: lerp(pa.y, pb.y, u) };
  }
  return out;
}
