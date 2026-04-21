import { useCallback, useEffect, useRef, useState } from 'react';
import { classifyPose, HandstandDebouncer } from '../components/HandstandDetector.js';

export const STATE = {
  IDLE: 'IDLE',         // no person / waiting for camera
  READY: 'READY',       // person detected, not yet inverted
  TRACKING: 'TRACKING', // handstand active, timer running
  COMPLETE: 'COMPLETE', // just dropped out of handstand
  SUBMITTED: 'SUBMITTED',
};

/**
 * Drives the tracking state machine off pose detection results.
 * Returns the current state, the latest detection, and transition handlers.
 *
 * The debouncer lives outside React state to avoid re-render churn at 30fps.
 */
export function useHandstand({ onEnterTracking, onExitTracking } = {}) {
  const [state, setState] = useState(STATE.IDLE);
  const [latest, setLatest] = useState({ landmarks: null, classification: null });
  // exitGraceMs is the most user-visible knob: too short, the timer dies on
  // brief tracking glitches mid-handstand; too long, ending an attempt feels
  // sluggish. 800ms tolerates a flicker without padding the score noticeably.
  const debouncer = useRef(new HandstandDebouncer({ enterFrames: 4, exitGraceMs: 800 }));
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const handleFrame = useCallback(({ landmarks, timestamp }) => {
    const classification = classifyPose(landmarks);
    const isHandstand = classification.isHandstand;
    const active = debouncer.current.update(isHandstand, timestamp);
    setLatest({ landmarks, classification });

    const cur = stateRef.current;

    // Check TRACKING exit first so it fires even if the person walks out of
    // frame entirely (landmarks become null → debouncer drops after grace).
    if (cur === STATE.TRACKING && !active) {
      setState(STATE.COMPLETE);
      onExitTracking?.();
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

    // READY → TRACKING (first attempt) or COMPLETE → TRACKING (next attempt
    // in a continuous session — debouncer flipped active again before user
    // hit "Try again", so we auto-restart the clock).
    if ((cur === STATE.READY || cur === STATE.COMPLETE) && active) {
      setState(STATE.TRACKING);
      onEnterTracking?.();
    }
  }, [onEnterTracking, onExitTracking]);

  const reset = useCallback(() => {
    debouncer.current.reset();
    setState(STATE.IDLE);
    setLatest({ landmarks: null, classification: null });
  }, []);

  // Manual TRACKING → COMPLETE transition. Used by the "End attempt" button
  // when the classifier fails to notice the drop (e.g. landmark flicker
  // keeps the debouncer alive past the user actually being on their feet).
  const forceComplete = useCallback(() => {
    if (stateRef.current !== STATE.TRACKING) return;
    debouncer.current.reset();
    setState(STATE.COMPLETE);
    onExitTracking?.();
  }, [onExitTracking]);

  const markSubmitted = useCallback(() => setState(STATE.SUBMITTED), []);

  return { state, latest, handleFrame, reset, forceComplete, markSubmitted };
}
