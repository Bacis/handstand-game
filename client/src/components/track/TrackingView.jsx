import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import PoseSkeleton from './PoseSkeleton.jsx';
import { MASTERIES, TICK_SEC } from '../../lib/masteries.js';
import './TrackingView.css';

const FANFARE_MASTERIES = [
  { atMs: 3000,   name: 'TOES UP!',    short: 'Toes Up' },
  { atMs: 15000,  name: 'PLANK TIME!', short: 'Plank Time' },
  { atMs: 30000,  name: 'STILL LIFE!', short: 'Still Life' },
  { atMs: 60000,  name: 'PLUMB LINE!', short: 'Plumb Line' },
  { atMs: 120000, name: 'MONK MODE!',  short: 'Vertical Monk' },
];
const TOTAL_RANKS = 40;

function heatClass(ms) {
  if (ms < 3000) return '';
  if (ms < 15000) return 'warm';
  if (ms < 30000) return 'hot';
  return 'red';
}

// Minute:second.centisecond formatter. Centis as <span class="ms"> so the design's
// smaller/dimmed millisecond styling applies.
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

function currentTier(ms) {
  if (ms < MASTERIES[0].atSec * 1000) return { rank: 0, short: 'Pre-flight' };
  let hit = MASTERIES[0];
  for (const m of MASTERIES) {
    if (ms >= m.atSec * 1000) hit = m;
    else break;
  }
  const rank = MASTERIES.findIndex((m) => m === hit) + 1;
  return { rank, short: hit.name.replace('!', '') };
}

function nextMastery(ms) {
  const idx = MASTERIES.findIndex((m) => m.atSec * 1000 > ms);
  if (idx === -1) return null;
  return { ...MASTERIES[idx], atMs: MASTERIES[idx].atSec * 1000 };
}

/**
 * Full-bleed webcam tracking surface.
 *  - <video> (passed in via videoRef from the parent) fills the stage (cover)
 *  - PoseSkeleton SVG overlays at video-cover crop for landmark alignment
 *  - Reference lines (sky / floor), corner brackets, REC / CAM badges
 *  - Center timer with heat-stage colors (green → warm → hot → red)
 *  - RANK pill, 40 rank pips, telemetry, next-goal bar, status pill
 *  - fireBanner(idx) flashes the outlined "TOES UP!"-style fanfare
 */
const TrackingView = forwardRef(function TrackingView(
  {
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
    completeLabel,
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
    fireBanner(idx) {
      const m = FANFARE_MASTERIES[idx];
      if (!m) return;
      setBannerText(m.name);
      // Force re-trigger animation by toggling .show off/on.
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
    showCustomBanner(text) {
      setBannerText(text);
      if (bannerEl.current) {
        bannerEl.current.classList.remove('show');
        void bannerEl.current.offsetWidth;
        bannerEl.current.classList.add('show');
      }
      clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => {
        bannerEl.current?.classList.remove('show');
      }, 2400);
    },
  }));

  useEffect(() => () => clearTimeout(bannerTimer.current), []);

  const parts = fmtParts(elapsedMs);
  const heat = heatClass(elapsedMs);
  const tier = currentTier(elapsedMs);
  const nxt = nextMastery(elapsedMs);
  const prev = tier.rank > 0 ? MASTERIES[tier.rank - 1].atSec * 1000 : 0;
  const pct = nxt ? Math.min(100, Math.max(0, ((elapsedMs - prev) / (nxt.atMs - prev)) * 100)) : 100;
  const curRank = tier.rank;

  // Build layered outline text (wire-banner back/front) once per change.
  const bannerLayers = useMemo(() => {
    const layers = [];
    for (let i = 6; i >= 1; i--) {
      const opacity = (0.5 - i * 0.06).toFixed(2);
      layers.push({
        tx: -i * 2.5,
        ty: i * 2.5,
        opacity,
      });
    }
    return layers;
  }, []);

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
          {parts.mm}:<span>{parts.ss}</span>
          <span className="ms">.{parts.cc}</span>
        </div>
        <div className="ts-rank">
          RANK {String(Math.max(curRank, 1)).padStart(2, '0')} · {(tier.short || 'PRE-FLIGHT').toUpperCase()}
        </div>

        <div className="ts-ranks">
          {Array.from({ length: TOTAL_RANKS }, (_, i) => {
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
            <span className="k">hold</span>
            <span className="v">
              {parts.mm}:{parts.ss}.{parts.cc}
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
                <span>{Math.max(0, (nxt.atMs - elapsedMs) / 1000).toFixed(1)}s</span> to go
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
              next: {nxt.name.replace('!', '').toLowerCase()} in{' '}
              {Math.max(0, (nxt.atMs - elapsedMs) / 1000).toFixed(1)}s
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

      {/* Dev-only top toolbar — source picker (file/sample) + debug toggles.
          Hidden in production so players only ever see the webcam flow. */}
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
export { FANFARE_MASTERIES, TICK_SEC };
