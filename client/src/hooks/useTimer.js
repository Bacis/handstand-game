import { useEffect, useRef, useState } from 'react';

/**
 * High-precision elapsed timer driven by performance.now() and rAF.
 * `running` toggles whether the clock advances; pausing preserves elapsed.
 */
export function useTimer(running) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef(0);
  const accumRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (running) {
      startRef.current = performance.now();
      const tick = () => {
        const now = performance.now();
        setElapsedMs(accumRef.current + (now - startRef.current));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    } else {
      // Pause: bank the time we accrued during the last run.
      if (startRef.current) {
        accumRef.current += performance.now() - startRef.current;
        startRef.current = 0;
      }
    }
  }, [running]);

  const reset = () => {
    cancelAnimationFrame(rafRef.current);
    accumRef.current = 0;
    startRef.current = 0;
    setElapsedMs(0);
  };

  return { elapsedMs, reset };
}

export function formatTime(ms) {
  const totalMs = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const tenths = Math.floor((totalMs % 1000) / 100);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}
