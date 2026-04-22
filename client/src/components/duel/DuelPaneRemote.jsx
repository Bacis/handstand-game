import { useEffect, useRef } from 'react';
import { formatTime } from '../../hooks/useTimer.js';

export default function DuelPaneRemote({
  challenge,
  remoteStream,
  score,
  label,
  connectionState,
  fallback,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !remoteStream) return;
    v.srcObject = remoteStream;
    v.play().catch(() => {});
    return () => {
      try { v.srcObject = null; } catch {}
    };
  }, [remoteStream]);

  const display =
    challenge?.scoreType === 'reps'
      ? String(Math.floor(score ?? 0))
      : formatTime(score ?? 0);

  const showWaiting = !fallback && connectionState !== 'connected' && connectionState !== 'completed';

  return (
    <div className="relative flex-1 min-h-0 bg-black overflow-hidden border-l border-white/10">
      {!fallback && <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay />}

      {fallback && (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-ink-900 to-black text-center p-6">
          <div>
            <div className="font-mono uppercase tracking-[0.2em] text-[11px] text-brand-accent mb-3">
              · Score-only mode
            </div>
            <div className="font-sans font-black tabular-nums text-6xl md:text-7xl text-white/90 drop-shadow-[0_0_16px_#ff4d2e]">
              {display}
            </div>
            <p className="text-white/55 text-xs mt-3 max-w-xs font-sans">
              Opponent video unavailable — their score is still syncing live.
            </p>
          </div>
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-3 left-3 font-mono uppercase tracking-[0.2em] text-[10px] text-white/80 bg-black/50 px-2 py-1 rounded-sm">
          {label}
        </div>
        {!fallback && (
          <div className="absolute bottom-4 left-4 font-sans font-black tabular-nums text-4xl md:text-6xl text-white/85">
            {display}
          </div>
        )}
        {showWaiting && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 text-white/70 font-mono uppercase tracking-[0.18em] text-xs">
            Connecting video…
          </div>
        )}
      </div>
    </div>
  );
}
