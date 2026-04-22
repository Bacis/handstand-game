import PoseSkeleton from '../track/PoseSkeleton.jsx';
import { formatTime } from '../../hooks/useTimer.js';

export default function DuelPaneLocal({
  challenge,
  videoRef,
  landmarks,
  videoAspect,
  score,
  mirror,
  label,
  ready,
  active,
}) {
  const display =
    challenge?.scoreType === 'reps'
      ? String(Math.floor(score ?? 0))
      : formatTime(score ?? 0);

  return (
    <div className="relative flex-1 min-h-0 bg-black overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
        style={mirror ? { transform: 'scaleX(-1)' } : undefined}
      />
      <PoseSkeleton landmarks={landmarks} videoAspect={videoAspect ?? 16 / 9} mirror={mirror} />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-3 left-3 font-mono uppercase tracking-[0.2em] text-[10px] text-white/80 bg-black/50 px-2 py-1 rounded-sm">
          {label}
        </div>
        <div
          className={`absolute bottom-4 right-4 font-sans font-black tabular-nums text-4xl md:text-6xl ${
            active ? 'text-brand-accent drop-shadow-[0_0_14px_#ff4d2e]' : 'text-white/85'
          }`}
        >
          {display}
        </div>
        {!ready && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 text-white/70 font-mono uppercase tracking-[0.18em] text-xs">
            Requesting camera…
          </div>
        )}
      </div>
    </div>
  );
}
