import { heatColor, heatGlowRadius } from '../lib/milestones.js';
import { formatTime } from '../hooks/useTimer.js';
import TierBadge from './TierBadge.jsx';

/**
 * Top-center, fixed-position handstand timer overlay. Lives inside the video
 * frame so it's part of the visual canvas (and gets included in any screen
 * capture). Doesn't move — predictable, always readable.
 *
 * The color heats up with elapsed time: white → yellow → orange → red around
 * the one-minute mark, like an ember catching fire.
 */
export default function HudTimer({ elapsedMs, active }) {
  const color = heatColor(elapsedMs);
  const glow = heatGlowRadius(elapsedMs);
  const display = formatTime(elapsedMs);

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none select-none text-center">
      <div
        className="text-[14vmin] sm:text-[12vmin] md:text-[10vmin] font-black tabular-nums leading-none tracking-tight transition-colors"
        style={{
          color,
          textShadow: `0 2px ${glow * 0.6}px ${color}cc, 0 0 ${glow * 1.6}px ${color}66`,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {display}
      </div>
      {active && elapsedMs >= 3000 && (
        <div className="mt-1.5 flex justify-center">
          <TierBadge durationMs={elapsedMs} size="sm" />
        </div>
      )}
    </div>
  );
}
