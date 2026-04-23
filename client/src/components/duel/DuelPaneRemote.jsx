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
    // Autoplay requires the element to be muted when there's any chance of
    // audio — even though our stream is video-only, being explicit keeps
    // Safari and stricter Chromium builds happy.
    v.muted = true;
    const tryPlay = () => {
      v.play().catch((err) => {
        console.warn('[duel] remote video play() rejected:', err?.message || err);
      });
    };
    tryPlay();
    // A late-arriving track (e.g. the video track lands a moment after the
    // audio track, or after a renegotiation) won't re-trigger this effect
    // because remoteStream's reference didn't change — listen explicitly.
    const onAddTrack = () => tryPlay();
    remoteStream.addEventListener('addtrack', onAddTrack);
    return () => {
      remoteStream.removeEventListener('addtrack', onAddTrack);
      try { v.srcObject = null; } catch {}
    };
  }, [remoteStream]);

  const display =
    challenge?.scoreType === 'reps'
      ? String(Math.floor(score ?? 0))
      : formatTime(score ?? 0);

  const hasStream = Boolean(remoteStream);
  // Show the score-only card only if we've given up on video AND nothing
  // has arrived yet. A late-arriving stream lights the <video> up and the
  // card melts away.
  const scoreOnly = fallback && !hasStream;
  // "Connecting…" while we're still waiting on ICE but haven't timed out.
  const showWaiting = !scoreOnly && !hasStream && connectionState !== 'connected' && connectionState !== 'completed';

  return (
    <div className="relative flex-1 min-h-0 bg-black overflow-hidden border-l border-white/10">
      {/* Video element is always mounted — if a stream shows up late (slow
          ICE, brief network blip), the useEffect above attaches it and it
          just starts playing. */}
      <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay muted />

      {scoreOnly && (
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
        {!scoreOnly && (
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
