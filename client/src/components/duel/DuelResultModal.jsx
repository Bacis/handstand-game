import { Link } from 'react-router-dom';
import { formatTime } from '../../hooks/useTimer.js';

export default function DuelResultModal({
  open,
  outcome,
  challenge,
  myScore,
  opponentScore,
  record,
  onRematch,
}) {
  if (!open) return null;

  const fmt = (s) =>
    challenge?.scoreType === 'reps'
      ? String(Math.floor(s ?? 0))
      : formatTime(s ?? 0);

  const headline =
    outcome === 'win' ? 'You win' : outcome === 'loss' ? 'You lose' : 'Tie';

  const tone =
    outcome === 'win' ? 'text-brand-accent' : outcome === 'loss' ? 'text-white/70' : 'text-white';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 grid place-items-center p-4">
      <div className="bg-brand-paper border border-brand-border rounded-md max-w-sm w-full p-6">
        <div className="text-center">
          <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-white/55">
            · {challenge?.label} · {outcome === 'tie' ? 'Tie' : 'Result'}
          </div>
          <h2 className={`text-4xl font-black mt-2 ${tone}`}>{headline}</h2>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-6">
          <div className="border border-white/10 rounded-sm p-4 text-center">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/55">You</div>
            <div className="text-2xl font-black tabular-nums mt-1">{fmt(myScore)}</div>
          </div>
          <div className="border border-white/10 rounded-sm p-4 text-center">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/55">Opponent</div>
            <div className="text-2xl font-black tabular-nums mt-1">{fmt(opponentScore)}</div>
          </div>
        </div>

        {record && (
          <div className="mt-5 text-center font-mono uppercase tracking-[0.18em] text-[11px] text-white/70">
            Duels record · <span className="text-white">{record.wins}W</span> ·{' '}
            <span className="text-white">{record.losses}L</span>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <Link
            to="/duel/new"
            className="flex-1 py-3 border border-white/25 hover:border-white/50 rounded-sm font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-white text-center transition"
          >
            New duel
          </Link>
          {onRematch && (
            <button
              type="button"
              onClick={onRematch}
              className="flex-1 py-3 bg-brand-accent text-black rounded-sm font-mono uppercase tracking-[0.14em] text-[11px] font-bold hover:-translate-y-px transition"
            >
              Rematch
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
