import { useCallback, useEffect, useRef, useState } from 'react';

export const STATE = {
  IDLE: 'IDLE',         // no person / waiting for camera
  READY: 'READY',       // person detected, not yet in challenge pose
  TRACKING: 'TRACKING', // challenge active — timer runs, reps accumulate
  COMPLETE: 'COMPLETE', // just dropped out of challenge pose
  SUBMITTED: 'SUBMITTED',
};

/**
 * Stateful debouncer: requires N consecutive true frames to enter "active",
 * and tolerates a grace period of false frames before dropping back out.
 * Keeps the attempt boundary stable against MediaPipe jitter.
 */
class Debouncer {
  constructor({ enterFrames = 4, exitGraceMs = 800 } = {}) {
    this.enterFrames = enterFrames;
    this.exitGraceMs = exitGraceMs;
    this.consecutiveTrue = 0;
    this.active = false;
    this.lastTrueAt = 0;
  }
  update(raw, nowMs) {
    if (raw) {
      this.consecutiveTrue += 1;
      this.lastTrueAt = nowMs;
      if (!this.active && this.consecutiveTrue >= this.enterFrames) this.active = true;
    } else {
      this.consecutiveTrue = 0;
      if (this.active && nowMs - this.lastTrueAt > this.exitGraceMs) this.active = false;
    }
    return this.active;
  }
  reset() { this.consecutiveTrue = 0; this.active = false; this.lastTrueAt = 0; }
}

/**
 * Drives the shared IDLE → READY → TRACKING → COMPLETE state machine off a
 * challenge-specific pose detector. The detector reports `{ active, repIncrement }`
 * each frame — "active" flows through the debouncer to decide TRACKING entry
 * and exit, and repIncrement feeds the reps counter for rep-based challenges.
 *
 * For handstand, repIncrement is always 0 and the score is the companion
 * timer's elapsedMs. For pull-ups / push-ups / squats, elapsedMs is ignored
 * and `reps` is the score.
 */
export function useChallenge(challenge, { onEnterTracking, onExitTracking } = {}) {
  const [state, setState] = useState(STATE.IDLE);
  const [latest, setLatest] = useState({ landmarks: null, debug: null, active: false });
  const [reps, setReps] = useState(0);

  const detectorRef = useRef(null);
  const debouncer = useRef(new Debouncer({ enterFrames: 4, exitGraceMs: 800 }));
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Fresh detector per challenge — switching exercises mid-session should not
  // carry rep-phase state across.
  useEffect(() => {
    if (!challenge) return;
    detectorRef.current = challenge.createDetector();
    debouncer.current.reset();
    setState(STATE.IDLE);
    setLatest({ landmarks: null, debug: null, active: false });
    setReps(0);
  }, [challenge]);

  const handleFrame = useCallback(({ landmarks, timestamp }) => {
    const detector = detectorRef.current;
    if (!detector) return;
    const result = detector.update(landmarks);
    const active = debouncer.current.update(result.active, timestamp);
    setLatest({ landmarks, debug: result.debug, active: result.active });

    const cur = stateRef.current;

    // TRACKING exit takes priority: it must fire even when landmarks are null
    // (user walked out of frame → debouncer drops after grace).
    if (cur === STATE.TRACKING) {
      if (result.repIncrement > 0) {
        setReps((r) => r + result.repIncrement);
      }
      if (!active) {
        setState(STATE.COMPLETE);
        onExitTracking?.();
        return;
      }
      return;
    }

    if (!landmarks) {
      if (cur === STATE.READY) setState(STATE.IDLE);
      return;
    }

    if (cur === STATE.IDLE) {
      setState(STATE.READY);
      return;
    }

    // READY → TRACKING (first attempt) or COMPLETE → TRACKING (back-to-back
    // attempts in a continuous session).
    if ((cur === STATE.READY || cur === STATE.COMPLETE) && active) {
      setState(STATE.TRACKING);
      setReps(0);
      onEnterTracking?.();
    }
  }, [onEnterTracking, onExitTracking]);

  const reset = useCallback(() => {
    debouncer.current.reset();
    detectorRef.current?.reset();
    setState(STATE.IDLE);
    setLatest({ landmarks: null, debug: null, active: false });
    setReps(0);
  }, []);

  // Manual TRACKING → COMPLETE (the "End attempt" button covers detector
  // flicker that keeps the debouncer alive past the user actually stopping).
  const forceComplete = useCallback(() => {
    if (stateRef.current !== STATE.TRACKING) return;
    debouncer.current.reset();
    setState(STATE.COMPLETE);
    onExitTracking?.();
  }, [onExitTracking]);

  const markSubmitted = useCallback(() => setState(STATE.SUBMITTED), []);

  return { state, latest, reps, handleFrame, reset, forceComplete, markSubmitted };
}
