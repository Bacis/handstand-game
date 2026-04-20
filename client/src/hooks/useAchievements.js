import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getState,
  recordAttempt as storeRecordAttempt,
  recordEvent as storeRecordEvent,
} from '../lib/achievementsStore.js';
import { findAchievement } from '../lib/achievements.js';

// Hook surface for Track.jsx and anywhere else that needs to fire/show
// achievement unlocks. Holds a toast queue + per-session unlocked list.
export function useAchievements() {
  const [state, setState] = useState(() => getState());
  const [sessionKeys, setSessionKeys] = useState([]); // array of keys, in unlock order
  const [toasts, setToasts] = useState([]); // { id, key, deferMs }
  const toastIdRef = useRef(0);

  const syncState = useCallback(() => setState(getState()), []);

  const queueToasts = useCallback((keys, { deferMs = 0 } = {}) => {
    if (!keys.length) return;
    setToasts((prev) => [
      ...prev,
      ...keys.map((key) => ({ id: ++toastIdRef.current, key, deferMs })),
    ]);
    setSessionKeys((prev) => {
      const seen = new Set(prev);
      const next = [...prev];
      for (const k of keys) if (!seen.has(k)) { next.push(k); seen.add(k); }
      return next;
    });
  }, []);

  const checkOnAttemptComplete = useCallback((durationMs, { isNewPb = false, prevPb = 0 } = {}) => {
    const newly = storeRecordAttempt({ durationMs, prevPb, isNewPb });
    // PB banner fires first — defer toasts so they don't collide.
    queueToasts(newly, { deferMs: isNewPb ? 1500 : 0 });
    syncState();
    return newly;
  }, [queueToasts, syncState]);

  const recordEvent = useCallback((name) => {
    const newly = storeRecordEvent(name);
    queueToasts(newly);
    syncState();
    return newly;
  }, [queueToasts, syncState]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Auto-dismiss toasts after they've been visible for ~4s (plus their defer).
  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((t) =>
      setTimeout(() => dismissToast(t.id), (t.deferMs || 0) + 4000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismissToast]);

  return {
    state,                          // raw store state for counters + unlocked map
    sessionKeys,                    // keys unlocked during this session, in order
    toasts,                         // [{ id, key, deferMs }]
    dismissToast,
    checkOnAttemptComplete,
    recordEvent,
    findAchievement,                // convenience re-export
  };
}
