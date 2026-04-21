import { useEffect, useMemo, useRef, useState } from 'react';
import { generateShareClip } from '../lib/shareClip.js';

const SHARE_URL = 'https://playstando.com';

/**
 * Share flow with a two-stage preview:
 *   1. Raw recording plays IMMEDIATELY when the modal opens (no waiting).
 *   2. For the handstand challenge, a branded 9:16 clip renders in the
 *      background and the preview swaps to it when ready. Other challenges
 *      use the raw recording only (the branded canvas pipeline is tuned for
 *      time-based handstand HUDs; repurposing it per exercise is out of
 *      scope for this pass).
 */
export default function ShareModal({
  open,
  onClose,
  challenge,
  score,
  sourceBlob,
  durationMs,
  handle,
  isPersonalBest,
  landmarkTimeline = null,
  earnedKeys = [],
  mirror = false,
  onShared,
}) {
  const [progress, setProgress] = useState(0);
  const [branded, setBranded] = useState(null); // { blob, url, mime }
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('raw'); // 'raw' | 'branded'
  const [toast, setToast] = useState(null);
  const lastInputRef = useRef(null);
  const sharedFiredRef = useRef(false);
  const rawUrlRef = useRef(null);

  const supportsBranded = challenge?.scoreType === 'duration';

  const rawUrl = useMemo(() => {
    if (!open || !sourceBlob) return null;
    if (rawUrlRef.current) URL.revokeObjectURL(rawUrlRef.current);
    const u = URL.createObjectURL(sourceBlob);
    rawUrlRef.current = u;
    return u;
  }, [open, sourceBlob]);

  useEffect(() => {
    return () => {
      if (rawUrlRef.current) {
        URL.revokeObjectURL(rawUrlRef.current);
        rawUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!open) { sharedFiredRef.current = false; return; }
    if (sharedFiredRef.current) return;
    sharedFiredRef.current = true;
    try { onShared?.('shared'); } catch {}
  }, [open, onShared]);

  // Branded render — handstand only. Rep-based challenges stay on the raw
  // preview, which is why we guard the entire effect below on supportsBranded.
  useEffect(() => {
    if (!supportsBranded) return;
    if (!open || !sourceBlob || !(durationMs > 0)) return;
    const earnedKey = earnedKeys.join(',');
    const timelineLen = landmarkTimeline?.samples?.length || 0;
    const key = `${sourceBlob.size}_${durationMs}_${handle}_${isPersonalBest}_${earnedKey}_${timelineLen}_${mirror}`;
    if (lastInputRef.current === key && branded) return;
    lastInputRef.current = key;

    setProgress(0);
    setBranded(null);
    setError(null);
    setViewMode('raw');
    let cancelled = false;

    generateShareClip({
      srcBlob: sourceBlob,
      durationMs,
      handle: handle ? `@${handle}` : 'anon',
      isPersonalBest: !!isPersonalBest,
      landmarkTimeline,
      earnedKeys,
      mirror,
      onProgress: (p) => { if (!cancelled) setProgress(p); },
    })
      .then((res) => {
        if (cancelled) return;
        const url = URL.createObjectURL(res.blob);
        setBranded({ blob: res.blob, url, mime: res.mime });
        setViewMode('branded');
      })
      .catch((e) => { if (!cancelled) setError(e.message || String(e)); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sourceBlob, durationMs, handle, isPersonalBest, earnedKeys, landmarkTimeline, mirror, supportsBranded]);

  useEffect(() => {
    return () => { if (branded?.url) URL.revokeObjectURL(branded.url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branded?.url]);

  if (!open || !challenge) return null;

  const mastery = challenge.masteryFor(score ?? 0);
  const rankLabel = mastery ? mastery.name : challenge.label;
  const scoreText = challenge.formatScore(score ?? 0);
  const text = challenge.copy.shareTemplate(score ?? 0, mastery?.name);
  const canWebShare = typeof navigator !== 'undefined' && !!navigator.share;

  const currentClip = viewMode === 'branded' && branded ? branded : null;
  const previewUrl = currentClip?.url ?? rawUrl;

  const filenameFor = (tag, mime) => {
    const ext = mime?.includes('mp4') ? 'mp4' : 'webm';
    const metric = challenge.scoreType === 'reps' ? `${score}reps` : `${Math.floor(score ?? 0)}ms`;
    return `${challenge.copy.filenameTag}-${tag}-${metric}.${ext}`;
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const onDownload = (which) => {
    if (which === 'raw' || !branded) {
      downloadBlob(sourceBlob, filenameFor('raw', sourceBlob.type));
    } else {
      downloadBlob(branded.blob, filenameFor('branded', branded.mime));
    }
  };

  const onWebShare = async () => {
    const blob = branded?.blob ?? sourceBlob;
    const mime = branded?.mime ?? sourceBlob.type ?? 'video/webm';
    const filename = filenameFor(branded ? 'branded' : 'raw', mime);
    const file = new File([blob], filename, { type: mime });
    const shareData = {
      title: `${challenge.label} · ${scoreText} · ${rankLabel}`,
      text,
      files: [file],
    };
    try {
      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        onDownload(branded ? 'branded' : 'raw');
      }
    } catch { /* user dismissed */ }
  };

  const openIntent = (url, platform) => {
    downloadBlob(branded?.blob ?? sourceBlob, filenameFor(branded ? 'branded' : 'raw', branded?.mime ?? sourceBlob.type));
    window.open(url, '_blank', 'noopener,noreferrer,width=680,height=760');
    showToast(`Clip saved · paste it into ${platform}`);
  };

  const onShareTwitter = () =>
    openIntent(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SHARE_URL)}`,
      'X',
    );
  const onShareWhatsApp = () =>
    openIntent(
      `https://wa.me/?text=${encodeURIComponent(`${text} ${SHARE_URL}`)}`,
      'WhatsApp',
    );
  const onShareReddit = () =>
    openIntent(
      `https://www.reddit.com/submit?title=${encodeURIComponent(text)}&url=${encodeURIComponent(SHARE_URL)}`,
      'Reddit',
    );
  const onShareTelegram = () =>
    openIntent(
      `https://t.me/share/url?url=${encodeURIComponent(SHARE_URL)}&text=${encodeURIComponent(text)}`,
      'Telegram',
    );

  const onCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      showToast('Link copied');
    } catch {
      showToast('Copy failed');
    }
  };

  const progressPct = Math.round(progress * 100);
  const brandedReady = !!branded;
  // For rep-based challenges the branded pipeline never runs, so share is
  // ready as soon as the raw preview is.
  const shareReady = supportsBranded ? brandedReady : !!rawUrl;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-brand-paper rounded-md border border-brand-border w-full max-w-md max-h-[95vh] flex flex-col overflow-hidden relative shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2 right-2 z-20 w-8 h-8 flex items-center justify-center rounded-sm bg-black/55 hover:bg-black/80 text-white/70 hover:text-white text-lg"
        >
          ×
        </button>

        <div className="px-5 pt-5 pb-4 border-b border-brand-border shrink-0">
          <div className="font-mono uppercase tracking-[0.22em] text-[10px] text-brand-accent">
            · Your share clip
          </div>
          <div className="font-sans font-black tracking-tight text-2xl mt-1.5 leading-none">
            {scoreText}{' '}
            <em className="font-serif italic font-light text-brand-accent">· {rankLabel}</em>
          </div>
          {isPersonalBest && (
            <div className="inline-block mt-2 px-2 py-1 rounded-sm font-mono uppercase tracking-[0.22em] text-[10px] font-bold bg-brand-accent text-black">
              ★ NEW PERSONAL BEST
            </div>
          )}
        </div>

        <div className="bg-black flex-1 min-h-0 relative">
          {previewUrl ? (
            <video
              key={previewUrl}
              src={previewUrl}
              className="absolute inset-0 w-full h-full object-contain"
              controls
              autoPlay
              loop
              muted
              playsInline
            />
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center text-center px-6">
              <div>
                <div className="font-mono uppercase tracking-[0.18em] text-[11px] text-[#ff6d5c] font-bold mb-2">
                  Couldn&apos;t generate clip
                </div>
                <div className="text-sm text-white/55">{error}</div>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 grid place-items-center font-mono uppercase tracking-[0.2em] text-[10px] text-white/55">
              Loading clip…
            </div>
          )}

          {supportsBranded && !error && (
            <div className="absolute top-3 left-3 right-3 flex items-center gap-2 pointer-events-auto">
              <div className="flex-1 bg-black/65 backdrop-blur-sm border border-brand-border rounded-sm px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-white/80 flex items-center gap-2 min-w-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        brandedReady ? 'bg-brand-accent' : 'bg-brand-accent animate-[pulseOp_1.2s_ease-in-out_infinite]'
                      }`}
                    />
                    <span className="truncate">
                      {brandedReady
                        ? 'Branded clip · ready'
                        : `Rendering branded clip · ${progressPct}%`}
                    </span>
                  </div>
                  {brandedReady && (
                    <div className="flex items-center gap-1 shrink-0">
                      <ViewToggle
                        active={viewMode === 'raw'}
                        onClick={() => setViewMode('raw')}
                        label="Raw"
                      />
                      <ViewToggle
                        active={viewMode === 'branded'}
                        onClick={() => setViewMode('branded')}
                        label="Branded"
                      />
                    </div>
                  )}
                </div>
                {!brandedReady && (
                  <div className="h-[2px] mt-2 bg-white/10 overflow-hidden rounded-full">
                    <div
                      className="h-full bg-brand-accent"
                      style={{ width: `${progressPct}%`, boxShadow: '0 0 8px #ff4d2e' }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {toast && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/80 border border-brand-border rounded-sm px-4 py-2 font-mono uppercase tracking-[0.18em] text-[10px] text-white">
              {toast}
            </div>
          )}
        </div>

        <div className="p-3 shrink-0 border-t border-brand-border space-y-2">
          <div className={`grid ${canWebShare ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
            <ActionBtn
              primary
              onClick={() => onDownload(supportsBranded ? 'branded' : 'raw')}
              disabled={!shareReady}
              title={shareReady ? 'Save clip to disk' : 'Rendering'}
            >
              {supportsBranded
                ? (brandedReady ? 'Download MP4 ⤓' : `Rendering · ${progressPct}%`)
                : 'Download clip ⤓'}
            </ActionBtn>
            {canWebShare && (
              <ActionBtn onClick={onWebShare} disabled={!shareReady}>
                {shareReady ? 'Share…' : 'Rendering…'}
              </ActionBtn>
            )}
          </div>

          <div className="grid grid-cols-5 gap-2">
            <SocialBtn onClick={onShareTwitter} label="X" disabled={!shareReady}>
              <span className="font-black">𝕏</span>
            </SocialBtn>
            <SocialBtn onClick={onShareWhatsApp} label="WhatsApp" disabled={!shareReady}>
              <span>💬</span>
            </SocialBtn>
            <SocialBtn onClick={onShareReddit} label="Reddit" disabled={!shareReady}>
              <span className="font-black">R</span>
            </SocialBtn>
            <SocialBtn onClick={onShareTelegram} label="Telegram" disabled={!shareReady}>
              <span>✈</span>
            </SocialBtn>
            <SocialBtn onClick={onCopyLink} label="Copy link">
              <span>⎘</span>
            </SocialBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ children, primary = false, ...rest }) {
  const base =
    'py-3 rounded-sm font-mono font-bold uppercase tracking-[0.16em] text-[11px] transition disabled:opacity-40';
  const skin = primary
    ? 'bg-brand-accent text-black hover:-translate-y-px'
    : 'border border-white/20 hover:border-white/40 text-white';
  return (
    <button type="button" {...rest} className={`${base} ${skin}`}>
      {children}
    </button>
  );
}

function SocialBtn({ children, label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`Share on ${label}`}
      className="flex flex-col items-center gap-1 py-2.5 rounded-sm border border-white/20 hover:border-white/45 text-white/85 hover:text-white transition disabled:opacity-40 disabled:hover:border-white/20"
    >
      <span className="text-base leading-none">{children}</span>
      <span className="font-mono uppercase tracking-[0.18em] text-[9px]">{label}</span>
    </button>
  );
}

function ViewToggle({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-mono uppercase tracking-[0.18em] text-[9px] px-2 py-1 rounded-sm transition ${
        active
          ? 'bg-white text-ink-900'
          : 'text-white/60 hover:text-white border border-white/15'
      }`}
    >
      {label}
    </button>
  );
}
