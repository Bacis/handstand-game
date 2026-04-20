// Pure logic: take a MediaPipe pose result and decide whether the person is
// in a handstand. No React, no DOM — easy to unit test.
//
// MediaPipe normalized image coordinates: x,y in [0,1], with y=0 at the top
// of the frame and y=1 at the bottom. So a person upside down has wrists
// near y=1 (bottom) and ankles near y=0 (top).

export const LANDMARK = {
  NOSE: 0,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

export const THRESHOLDS = {
  WRISTS_BELOW: 0.55,        // wrists must be below this y (lower half of frame)
  ANKLES_ABOVE: 0.45,        // ankles must be above this y (upper half of frame)
  WRIST_SPREAD_MAX: 0.40,    // |left.x - right.x| max
  MIN_VISIBILITY: 0.6,       // landmark visibility/presence min
};

function avg(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function visAvg(...landmarks) {
  let total = 0;
  for (const l of landmarks) total += l?.visibility ?? 1;
  return total / landmarks.length;
}

/**
 * @param {Array<{x:number,y:number,z?:number,visibility?:number}>} landmarks
 * @returns {{
 *   isHandstand: boolean,
 *   reason?: string,
 *   midpoint?: {x:number,y:number},
 *   checks?: Record<string,{pass:boolean,value:number,threshold:number,op:string}>
 * }}
 */
export function classifyPose(landmarks) {
  if (!landmarks || landmarks.length < 33) {
    return { isHandstand: false, reason: 'no-pose' };
  }

  const lw = landmarks[LANDMARK.LEFT_WRIST];
  const rw = landmarks[LANDMARK.RIGHT_WRIST];
  const lh = landmarks[LANDMARK.LEFT_HIP];
  const rh = landmarks[LANDMARK.RIGHT_HIP];
  const la = landmarks[LANDMARK.LEFT_ANKLE];
  const ra = landmarks[LANDMARK.RIGHT_ANKLE];
  const nose = landmarks[LANDMARK.NOSE];

  const wrists = avg(lw, rw);
  const hips = avg(lh, rh);
  const ankles = avg(la, ra);
  const visibility = visAvg(lw, rw, lh, rh, la, ra, nose);
  const wristSpread = Math.abs(lw.x - rw.x);

  const checks = {
    visibility: {
      pass: visibility >= THRESHOLDS.MIN_VISIBILITY,
      value: visibility, threshold: THRESHOLDS.MIN_VISIBILITY, op: '>=',
    },
    wristsDown: {
      pass: wrists.y > THRESHOLDS.WRISTS_BELOW,
      value: wrists.y, threshold: THRESHOLDS.WRISTS_BELOW, op: '>',
    },
    anklesUp: {
      pass: ankles.y < THRESHOLDS.ANKLES_ABOVE,
      value: ankles.y, threshold: THRESHOLDS.ANKLES_ABOVE, op: '<',
    },
    hipsAboveWrists: {
      pass: hips.y < wrists.y,
      value: hips.y, threshold: wrists.y, op: '<',
    },
    headBelowHips: {
      pass: nose.y > hips.y,
      value: nose.y, threshold: hips.y, op: '>',
    },
    handsClose: {
      pass: wristSpread <= THRESHOLDS.WRIST_SPREAD_MAX,
      value: wristSpread, threshold: THRESHOLDS.WRIST_SPREAD_MAX, op: '<=',
    },
  };

  const failed = Object.entries(checks).find(([, c]) => !c.pass);
  if (failed) {
    return { isHandstand: false, reason: failed[0], midpoint: hips, checks };
  }
  return { isHandstand: true, midpoint: hips, checks };
}

/**
 * Stateful debouncer: requires N consecutive true frames to enter "active",
 * and tolerates a grace period of false frames before dropping back out.
 * Insulates the timer from MediaPipe jitter at handstand entry/exit.
 */
export class HandstandDebouncer {
  constructor({ enterFrames = 5, exitGraceMs = 300 } = {}) {
    this.enterFrames = enterFrames;
    this.exitGraceMs = exitGraceMs;
    this.consecutiveTrue = 0;
    this.active = false;
    this.lastTrueAt = 0;
  }

  /**
   * @param {boolean} raw  current frame's classification
   * @param {number} nowMs performance.now()
   * @returns {boolean} debounced active state
   */
  update(raw, nowMs) {
    if (raw) {
      this.consecutiveTrue += 1;
      this.lastTrueAt = nowMs;
      if (!this.active && this.consecutiveTrue >= this.enterFrames) {
        this.active = true;
      }
    } else {
      this.consecutiveTrue = 0;
      if (this.active && nowMs - this.lastTrueAt > this.exitGraceMs) {
        this.active = false;
      }
    }
    return this.active;
  }

  reset() {
    this.consecutiveTrue = 0;
    this.active = false;
    this.lastTrueAt = 0;
  }
}
