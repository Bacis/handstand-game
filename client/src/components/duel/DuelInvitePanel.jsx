import { useMemo, useState } from 'react';

// Shown in the right pane while the host is waiting for a guest to arrive.
// Mirrors DuelPaneRemote's dimensions so the split-view frame doesn't shift
// when the guest connects and this gets swapped out for the remote video.
export default function DuelInvitePanel({ match, challenge }) {
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
      // clipboard unavailable — the URL is still visible to long-press
    }
  };

  const share = async () => {
    if (!navigator.share) return copy();
    try {
      await navigator.share({
        title: 'Playstando duel',
        text: `Can you beat me at ${challenge?.label?.toLowerCase?.() ?? 'this'}?`,
        url,
      });
    } catch {
      // user dismissed — nothing to do
    }
  };

  return (
    <div className="relative flex-1 min-h-0 bg-gradient-to-br from-ink-900 to-black overflow-hidden border-l border-white/10">
      <div className="absolute inset-0 grid place-items-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="font-mono uppercase tracking-[0.2em] text-[11px] text-brand-accent flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent motion-safe:animate-[pulseOp_1.2s_ease-in-out_infinite]" />
            Waiting for opponent
          </div>
          <h2 className="text-2xl md:text-3xl font-black mt-3">
            {challenge?.label} · {match.duration_s}s
          </h2>
          <p className="text-white/60 text-sm mt-2">
            Send this link. The duel starts the moment they open it.
          </p>

          <div className="mt-5 flex items-center gap-2 bg-black/60 border border-white/10 rounded-sm px-3 py-2.5">
            <code className="font-mono text-xs text-white/85 truncate flex-1 text-left">
              {url}
            </code>
            <button
              type="button"
              onClick={copy}
              className="font-mono uppercase tracking-[0.14em] text-[10px] px-3 py-1.5 rounded-sm bg-white text-ink-900 font-bold shrink-0"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <button
            type="button"
            onClick={share}
            className="w-full mt-3 py-3 bg-brand-accent text-black font-mono uppercase tracking-[0.14em] text-[11px] font-bold rounded-sm hover:-translate-y-px transition"
          >
            Invite a friend
          </button>
        </div>
      </div>
    </div>
  );
}
