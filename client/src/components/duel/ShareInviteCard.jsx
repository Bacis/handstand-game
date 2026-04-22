import { useMemo, useState } from 'react';

export default function ShareInviteCard({ match, challenge, onCancel }) {
  const url = useMemo(
    () => `${window.location.origin}/duel/${match.id}`,
    [match.id],
  );
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable (e.g. insecure context) — user can long-press
    }
  };

  const share = async () => {
    if (!navigator.share) return copy();
    try {
      await navigator.share({
        title: 'Playstando duel',
        text: `Can you beat me at ${challenge?.label.toLowerCase()}?`,
        url,
      });
    } catch {
      // user dismissed — nothing to do
    }
  };

  return (
    <div className="space-y-5">
      <div className="border border-brand-border rounded-md bg-brand-paper p-6">
        <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-brand-accent mb-2">
          · Invite ready
        </div>
        <div className="text-lg font-black">
          {challenge?.label} · {match.duration_s}s
        </div>
        <p className="text-white/60 text-sm mt-2">
          Send this link to your opponent. The duel starts automatically when they open it.
        </p>

        <div className="mt-5 flex items-center gap-2 bg-ink-900 border border-white/10 rounded-sm px-3 py-3">
          <code className="font-mono text-xs text-white/80 truncate flex-1">{url}</code>
          <button
            type="button"
            onClick={copy}
            className="font-mono uppercase tracking-[0.14em] text-[10px] px-3 py-1.5 rounded-sm bg-white text-ink-900 font-bold shrink-0"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={share}
            className="py-3 border border-white/25 hover:border-white/50 rounded-sm font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-white transition"
          >
            Share…
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="py-3 border border-white/15 hover:border-white/30 rounded-sm font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-white/60 transition"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="border border-white/10 rounded-md p-5 flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-brand-accent motion-safe:animate-[pulseOp_1.2s_ease-in-out_infinite]" />
        <span className="font-mono uppercase tracking-[0.18em] text-[11px] text-white/75">
          Waiting for opponent…
        </span>
      </div>
    </div>
  );
}
