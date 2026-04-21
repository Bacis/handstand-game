// Shared helpers for challenge pose classifiers. MediaPipe landmark indices
// and lightweight geometry — keep these pure so they stay trivially testable.

export const LANDMARK = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

export function avg(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function visAvg(...landmarks) {
  let total = 0;
  for (const l of landmarks) total += l?.visibility ?? 1;
  return total / landmarks.length;
}

// Interior angle at vertex `b` of the triangle a-b-c, in degrees. Used by
// push-ups (elbow angle) and squats (knee angle) to detect the bottom of each
// rep.
export function angleDeg(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 === 0 || m2 === 0) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export const MIN_VISIBILITY = 0.55;

export function hasAll(landmarks, indices) {
  if (!landmarks || landmarks.length < 33) return false;
  for (const i of indices) {
    const l = landmarks[i];
    if (!l) return false;
    if ((l.visibility ?? 1) < MIN_VISIBILITY) return false;
  }
  return true;
}
