import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import PoseSkeleton from './PoseSkeleton.jsx';
import './TrackingView.css';

function fmtParts(ms) {
  const total = Math.max(0, ms | 0);
  const s = Math.floor(total / 1000);
  const m = Math.floor(s / 60);
  return {
    mm: String(m).padStart(2, '0'),
    ss: String(s % 60).padStart(2, '0'),
    cc: String(Math.floor((total % 1000) / 10)).padStart(2, '0'),
  };
}

// Progress through challenge tiers drives the timer's color ramp. The existing
// .warm/.hot/.red CSS classes were tuned for handstand seconds, so we map a
// 0→1 progress signal into those same buckets regardless of exercise.
function heatClassFromProgress(progress) {
  if (progress <= 0) return '';
  if (progress < 0.15) return '';
  if (progress < 0.35) return 'warm';
  if (progress < 0.6) return 'hot';
  return 'red';
}

function currentTierIndex(tiers, score) {
  let idx = -1;
  for (let i = 0; i < tiers.length; i++) {
    if (score >= tiers[i].at) idx = i;
    else break;
  }
  return idx;
}

function nextTier(tiers, score) {
  return tiers.find((t) => t.at > score) ?? null;
}

/**
 * Full-bleed webcam tracking surface. Accepts a challenge strategy so the HUD
 * swaps between the handstand timer (mm:ss with heat ramp) and the rep counter
 * used by pull-ups / push-ups / squats without any exercise-specific branches
 * leaking into parent pages.
 */
const TrackingView = forwardRef(function TrackingView(
  {
    challenge,
    score,
    reps,
    videoRef,
    landmarks,
    videoAspect = 16 / 9,
    videoSize,
    elapsedMs,
    active,
    ready,
    poseLoaded,
    errorMessage,
    source,
    onSwitchSource,
    onPickFile,
    onLoadSample,
    debug,
    onToggleDebug,
    loopFile,
    onToggleLoop,
    fileUrlIsBlob,
    fileUrlIsSample,
    showDevTools = false,
    recording,
    statusText,
    complete,
    actions,
    mirror = false,
    facingMode = 'environment',
    onFlipCamera = null,
    onEndAttempt = null,
  },
  ref,
) {
  const [bannerText, setBannerText] = useState('');
  const bannerTimer = useRef(0);
  const bannerEl = useRef(null);
  const flashEl = useRef(null);

  useImperativeHandle(ref, () => ({
    showCustomBanner(text) {
      setBannerText(text);
      if (bannerEl.current) {
        bannerEl.current.classList.remove('show');
        void bannerEl.current.offsetWidth;
        bannerEl.current.classList.add('show');
      }
      if (flashEl.current) {
        flashEl.current.classList.remove('on');
        void flashEl.current.offsetWidth;
        flashEl.current.classList.add('on');
      }
      clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => {
        bannerEl.current?.classList.remove('show');
      }, 2400);
    },
  }));

  useEffect(() => () => clearTimeout(bannerTimer.current), []);

  const tiers = challenge?.tiers ?? [];
  const scoreType = challenge?.scoreType ?? 'duration';
  const totalRanks = tiers.length || 40;
  const tierIdx = currentTierIndex(tiers, score || 0);
  const curTier = tierIdx >= 0 ? tiers[tierIdx] : null;
  const nxt = nextTier(tiers, score || 0);
  const topTierAt = tiers.length ? tiers[tiers.length - 1].at : 1;
  const progress = topTierAt > 0 ? Math.min(1, (score || 0) / topTierAt) : 0;
  const heat = heatClassFromProgress(progress);
  const curRank = tierIdx + 1;
  const tierLabel = curTier ? curTier.name.replace('!', '') : 'Pre-flight';

  // Progress bar fill between current and next tier.
  const prevAt = tierIdx >= 0 ? tiers[tierIdx].at : 0;
  const pct = nxt
    ? Math.min(100, Math.max(0, (((score || 0) - prevAt) / (nxt.at - prevAt)) * 100))
    : 100;

  // Primary HUD display + secondary "hold" telemetry row vary by score type.
  const parts = fmtParts(elapsedMs || 0);
  const primary = useMemo(() => {
    if (scoreType === 'reps') {
      return { top: String(reps ?? 0), sub: (challenge?.unitLabel || 'reps').toUpperCase() };
    }
    return { top: `${parts.mm}:${parts.ss}`, sub: `.${parts.cc}` };
  }, [scoreType, reps, parts.mm, parts.ss, parts.cc, challenge?.unitLabel]);

  const bannerLayers = useMemo(() => {
    const layers = [];
    for (let i = 6; i >= 1; i--) {
      const opacity = (0.5 - i * 0.06).toFixed(2);
      layers.push({ tx: -i * 2.5, ty: i * 2.5, opacity });
    }
    return layers;
  }, []);

  const remainingLabel = nxt
    ? scoreType === 'reps'
      ? `${Math.max(0, nxt.at - (score || 0))} reps`
      : `${Math.max(0, (nxt.at - (score || 0)) / 1000).toFixed(1)}s`
    : '';

  return (
    <div className="ts-root">
      <div className="ts-stage">
        <video
          ref={videoRef}
          className="ts-video"
          playsInline
          muted
          style={mirror ? { transform: 'scaleX(-1)' } : undefined}
        />
        <PoseSkeleton landmarks={landmarks} videoAspect={videoAspect} mirror={mirror} />
        <div className="ts-sky" />
        <div className="ts-gnd" />
      </div>

      <div className="ts-hud">
        <div className="ts-corner tl" />
        <div className="ts-corner tr" />
        <div className="ts-corner bl" />
        <div className="ts-corner br" />

        <div className="ts-rec">
          <span className="dot" />
          {recording ? 'REC · 30fps' : 'STANDBY'}
        </div>
        <div className="ts-cam">CAM · {videoSize || '—'}</div>

        {onFlipCamera && (
          <button
            type="button"
            className="ts-flip-cam"
            onClick={onFlipCamera}
            aria-label={facingMode === 'user' ? 'Switch to rear camera' : 'Switch to selfie camera'}
            title={facingMode === 'user' ? 'Switch to rear camera' : 'Switch to selfie camera'}
          >
            <span className="glyph" aria-hidden>⟲</span>
            <span className="lbl">{facingMode === 'user' ? 'Selfie' : 'Rear'}</span>
          </button>
        )}

        <div className={`ts-timer ${heat}`}>
          {primary.top}
          <span className="ms">{scoreType === 'reps' ? ` ${primary.sub}` : primary.sub}</span>
        </div>
        <div className="ts-rank">
          RANK {String(Math.max(curRank, 1)).padStart(2, '0')} · {tierLabel.toUpperCase()}
        </div>

        <div className="ts-ranks">
          {Array.from({ length: totalRanks }, (_, i) => {
            const cls = i < curRank - 1 ? 'on' : i === curRank - 1 ? 'cur' : '';
            return <div key={i} className={`pip ${cls}`} />;
          })}
        </div>

        <div className="ts-tel">
          <div className="row">
            <span className="k">pose</span>
            <span className="v">{poseLoaded ? '✓' : '…'}</span>
          </div>
          <div className="row">
            <span className="k">camera</span>
            <span className="v">{ready ? '✓' : '…'}</span>
          </div>
          <div className="row">
            <span className="k">recording</span>
            <span className="v">{recording ? '✓' : '—'}</span>
          </div>
          <div className="row">
            <span className="k">{scoreType === 'reps' ? 'reps' : 'hold'}</span>
            <span className="v">
              {scoreType === 'reps'
                ? String(reps ?? 0)
                : `${parts.mm}:${parts.ss}.${parts.cc}`}
            </span>
          </div>
        </div>

        {nxt && (
          <div className="ts-next">
            <div className="ts-next-lbl">
              <div className="l">
                Next · <b>{nxt.name.replace('!', '')}</b>
              </div>
              <div className="r">
                <span>{remainingLabel}</span> to go
              </div>
            </div>
            <div className="ts-next-track">
              <div className="ts-next-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <div className="ts-status">
          <span className="d" />
          {statusText}
          {nxt && active && (
            <span className="next">
              next: {nxt.name.replace('!', '').toLowerCase()} in {remainingLabel}
            </span>
          )}
        </div>
      </div>

      <div className="ts-flash" ref={flashEl} />
      <div className="ts-banner" ref={bannerEl}>
        <div className="ts-wire-title">
          {bannerLayers.map((l, i) => (
            <span
              key={i}
              className="back"
              style={{ transform: `translate(${l.tx}px, ${l.ty}px)`, opacity: l.opacity }}
            >
              {bannerText}
            </span>
          ))}
          <span className="front">{bannerText}</span>
        </div>
      </div>

      {showDevTools && (
        <div className="ts-toolbar">
          <button
            type="button"
            className={`chip ${source === 'webcam' ? 'on' : ''}`}
            onClick={() => onSwitchSource('webcam')}
          >
            Webcam
          </button>
          <label className={`chip ${source === 'file' && fileUrlIsBlob ? 'on' : ''}`}>
            Video file
            <input type="file" accept="video/*" className="hidden" style={{ display: 'none' }} onChange={onPickFile} />
          </label>
          <button
            type="button"
            className={`chip ${source === 'file' && fileUrlIsSample ? 'on' : ''}`}
            onClick={onLoadSample}
          >
            Sample clip
          </button>
          <span className="sep" />
          {source === 'file' && (
            <label className="toggle" title="Loop the sample clip">
              <input type="checkbox" checked={loopFile} onChange={(e) => onToggleLoop(e.target.checked)} /> Loop
            </label>
          )}
          <label className="toggle">
            <input type="checkbox" checked={debug} onChange={(e) => onToggleDebug(e.target.checked)} /> Debug
          </label>
        </div>
      )}

      {complete && actions && (
        <div className="ts-action-rail">
          {actions}
        </div>
      )}

      {onEndAttempt && (
        <div className="ts-end-rail">
          <button
            type="button"
            className="ts-btn end-attempt"
            onClick={onEndAttempt}
            title="Force end of attempt — use if the timer didn't stop after you dropped"
          >
            End attempt ✕
          </button>
        </div>
      )}

      {!ready && !errorMessage && (
        <div className="ts-loading">
          {source === 'webcam' ? 'Requesting camera…' : 'Loading video…'}
        </div>
      )}

      {errorMessage && (
        <div className="ts-error">
          <div>
            <div className="h">Unavailable</div>
            <div className="m">{errorMessage}</div>
          </div>
        </div>
      )}
    </div>
  );
});

export default TrackingView;
