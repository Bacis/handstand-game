import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Counts up to `value` over `duration` ms using rAF + easeOutCubic. When
 * value changes after mount, animates from prior displayed value. Respects
 * prefers-reduced-motion (jumps straight to final).
 */
export default function StatCounter({
  value,
  label,
  format = (n) => String(Math.floor(n)),
  duration = 1200,
  className = '',
  valueClassName = 'text-3xl md:text-4xl font-black tabular-nums',
  labelClassName = 'text-[10px] uppercase tracking-widest text-gray-500 mt-1',
}) {
  const [displayed, setDisplayed] = useState(prefersReducedMotion() ? value : 0);
  const fromRef = useRef(displayed);
  const rafRef = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplayed(value);
      fromRef.current = value;
      return;
    }
    const start = performance.now();
    const from = fromRef.current;
    const delta = value - from;
    if (delta === 0) return;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const v = from + delta * easeOutCubic(t);
      setDisplayed(v);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return (
    <div className={className}>
      <div className={valueClassName}>{format(displayed)}</div>
      {label && <div className={labelClassName}>{label}</div>}
    </div>
  );
}
