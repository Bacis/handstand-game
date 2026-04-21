// Lightweight landmark timeline captured during a TRACKING session so the
// share-clip renderer can replay the pose skeleton on top of the recorded
// video. Samples are stored as `{ t: ms-since-start, lm: Landmark[] }` and
// looked up via binary search on export.

export function createPoseBuffer() {
  let startMs = 0;
  let samples = [];
  let started = false;

  return {
    start() {
      startMs = performance.now();
      samples = [];
      started = true;
    },
    stop() {
      started = false;
    },
    push(landmarks) {
      if (!started || !landmarks || landmarks.length === 0) return;
      // Strip to just x, y, visibility — drops z and any extra fields to keep
      // the timeline under ~200KB/min even on long holds.
      const lm = new Array(landmarks.length);
      for (let i = 0; i < landmarks.length; i++) {
        const p = landmarks[i];
        lm[i] = { x: p.x, y: p.y, visibility: p.visibility };
      }
      samples.push({ t: performance.now() - startMs, lm });
    },
    snapshot() {
      return { startMs, samples: samples.slice() };
    },
    clear() {
      startMs = 0;
      samples = [];
      started = false;
    },
  };
}

/**
 * Binary-search the nearest landmark sample to `tMs` within the snapshot.
 * Returns null if the snapshot has no samples.
 */
export function findNearest(snapshot, tMs) {
  if (!snapshot || !snapshot.samples || snapshot.samples.length === 0) return null;
  const arr = snapshot.samples;
  let lo = 0;
  let hi = arr.length - 1;
  if (tMs <= arr[lo].t) return arr[lo].lm;
  if (tMs >= arr[hi].t) return arr[hi].lm;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = arr[mid].t;
    if (v === tMs) return arr[mid].lm;
    if (v < tMs) lo = mid + 1;
    else hi = mid - 1;
  }
  // lo now points at the first element > tMs; pick whichever of arr[lo],
  // arr[lo-1] is closer in time.
  const after = arr[lo];
  const before = arr[lo - 1];
  if (!before) return after.lm;
  if (!after) return before.lm;
  return (tMs - before.t) <= (after.t - tMs) ? before.lm : after.lm;
}
