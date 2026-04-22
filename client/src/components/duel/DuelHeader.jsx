import { formatTime } from '../../hooks/useTimer.js';

export default function DuelHeader({
  challenge,
  matchState,
  remainingMs,
  countdownSeconds,
  hostName,
  guestName,
  hostScore,
  guestScore,
  meIsHost,
}) {
  const fmt = (score) =>
    challenge?.scoreType === 'reps' ? String(Math.floor(score ?? 0)) : formatTime(score ?? 0);

  return (
    <header className="bg-ink-900/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-4">
      <div className="hidden sm:flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-accent" />
        <span className="font-mono uppercase tracking-[0.18em] text-[10px] text-white/60">
          {challenge?.label} duel
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center gap-4 font-mono tabular-nums">
        <div className={`text-right ${meIsHost ? 'text-white' : 'text-white/70'}`}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/50">
            {hostName || 'Host'}{meIsHost ? ' (you)' : ''}
          </div>
          <div className="text-lg font-bold">{fmt(hostScore)}</div>
        </div>

        <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-sm text-center min-w-[110px]">
          {countdownSeconds != null && countdownSeconds > 0 ? (
            <>
              <div className="text-[9px] uppercase tracking-[0.2em] text-brand-accent">Starting</div>
              <div className="text-lg font-black">{countdownSeconds}</div>
            </>
          ) : matchState === 'live' ? (
            <>
              <div className="text-[9px] uppercase tracking-[0.2em] text-brand-accent">Live</div>
              <div className="text-lg font-black">{formatTime(remainingMs ?? 0)}</div>
            </>
          ) : matchState === 'ready' ? (
            <>
              <div className="text-[9px] uppercase tracking-[0.2em] text-white/60">Ready</div>
              <div className="text-lg font-black">—</div>
            </>
          ) : matchState === 'done' ? (
            <>
              <div className="text-[9px] uppercase tracking-[0.2em] text-white/60">Done</div>
              <div className="text-lg font-black">—</div>
            </>
          ) : (
            <>
              <div className="text-[9px] uppercase tracking-[0.2em] text-white/60">Waiting</div>
              <div className="text-lg font-black">—</div>
            </>
          )}
        </div>

        <div className={`text-left ${!meIsHost ? 'text-white' : 'text-white/70'}`}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/50">
            {guestName || 'Guest'}{!meIsHost ? ' (you)' : ''}
          </div>
          <div className="text-lg font-bold">{fmt(guestScore)}</div>
        </div>
      </div>
    </header>
  );
}
