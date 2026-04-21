import { crossedTick } from './milestones.js';
import { masteryFor, MASTERIES } from './masteries.js';
import { drawPoseSkeletonCanvas } from './poseSkeleton.js';
import { findNearest } from './poseCaptureBuffer.js';
import { findAchievement } from './achievements.js';

// Full-HD vertical (matches TikTok/Reels/Shorts native resolution).
const W = 1080;
const H = 1920;
const FPS = 30;
const VIDEO_BITRATE = 10_000_000;

// Matches /play — phosphor-green HUD, heat escalation on the timer.
const GREEN = '#33ff66';
const WARM  = '#ffe08a';
const HOT   = '#f2a840';
const RED   = '#ff4d2e';

function heatColor(ms) {
  if (ms < 3000) return GREEN;
  if (ms < 15000) return WARM;
  if (ms < 30000) return HOT;
  return RED;
}

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

function rankFor(ms) {
  if (ms < MASTERIES[0].atSec * 1000) return null;
  let idx = 0;
  for (let i = 0; i < MASTERIES.length; i++) {
    if (ms >= MASTERIES[i].atSec * 1000) idx = i;
    else break;
  }
  return { index: idx + 1, name: MASTERIES[idx].name };
}

// Preload the exact fonts canvas will reach for. Skipping this leaves us with
// the default sans-serif on first paint (ugly). document.fonts.ready finishes
// fast once the page has had any chance to load its webfonts.
async function preloadFonts() {
  if (typeof document === 'undefined' || !document.fonts) return;
  const specs = [
    '700 240px "JetBrains Mono"',
    '700 40px "JetBrains Mono"',
    '700 30px "JetBrains Mono"',
    '700 24px "JetBrains Mono"',
    '900 140px Inter',
    '900 36px Inter',
  ];
  try {
    await Promise.all(specs.map((s) => document.fonts.load(s)));
    await document.fonts.ready;
  } catch {
    // not fatal
  }
}

// Unlock thresholds (ms) for duration-gated achievements — used to pop badges
// in during playback exactly when each one would've fired in /play. Kept in
// sync by hand with the `check` predicates in lib/achievements.js. Any key not
// in this map appears immediately (t=0).
const BADGE_UNLOCK_MS = {
  first_liftoff: 3_000,
  five_club:     5_000,
  fifteen_club:  15_000,
  half_minute:   30_000,
  minute_maker:  60_000,
  nice:          69_000,
  two_min_titan: 120_000,
};

const TIER_GRAD = {
  bronze: ['#cd7f32', '#5a2e0b'],
  silver: ['#22d3ee', '#0e7490'],
  gold:   ['#facc15', '#854d0e'],
  mythic: ['#cd7f32', '#facc15'],
};

/**
 * Render the recorded handstand clip onto a 9:16 canvas with the /play HUD —
 * corner brackets, green timer, rank pill, sky/floor lines, milestone wire-
 * banner, pose skeleton, achievement badges — then capture it as a video Blob.
 *
 * Returns { blob, mime, durationMs } once the source clip has played through.
 *
 * @param {object} opts
 * @param {Blob} opts.srcBlob
 * @param {number} opts.durationMs
 * @param {string} opts.handle
 * @param {boolean} opts.isPersonalBest
 * @param {object} [opts.landmarkTimeline]   snapshot from createPoseBuffer
 * @param {string[]} [opts.earnedKeys]       achievement keys to stack on the right
 * @param {boolean} [opts.mirror]            true for selfie webcam source
 * @param {(progress:number)=>void} [opts.onProgress]
 */
export async function generateShareClip({
  srcBlob,
  durationMs,
  handle = 'anon',
  isPersonalBest = false,
  landmarkTimeline = null,
  earnedKeys = [],
  mirror = false,
  onProgress,
}) {
  await preloadFonts();

  const srcUrl = URL.createObjectURL(srcBlob);
  const video = document.createElement('video');
  video.src = srcUrl;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = () => reject(new Error('share-clip: source video failed to load'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const stream = canvas.captureStream(FPS);
  const mime = pickMime();
  if (!mime) {
    URL.revokeObjectURL(srcUrl);
    throw new Error('share-clip: no supported MediaRecorder mime type');
  }
  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: VIDEO_BITRATE });
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

  // Cover-fit the source into 9:16.
  const srcAspect = video.videoWidth / video.videoHeight;
  const targetAspect = W / H;
  let sx, sy, sw, sh;
  if (srcAspect > targetAspect) {
    sh = video.videoHeight;
    sw = sh * targetAspect;
    sx = (video.videoWidth - sw) / 2;
    sy = 0;
  } else {
    sw = video.videoWidth;
    sh = sw / targetAspect;
    sx = 0;
    sy = (video.videoHeight - sh) / 2;
  }

  // State for the milestone wire-banner (outlined green text that punches in
  // on each crossed 3s tick, fades after ~2.4s — same timing as /play).
  let bannerText = '';
  let bannerStart = 0;
  let bannerLife = 2400;
  let flashUntil = 0;
  let lastElapsed = 0;

  const drawFrame = () => {
    const now = performance.now();
    const elapsedMs = Math.min(video.currentTime * 1000, durationMs);
    onProgress?.(Math.min(1, durationMs > 0 ? elapsedMs / durationMs : 0));

    const color = heatColor(elapsedMs);

    // -- 1. Background: scaled-and-cropped source video -------------------
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);

    // -- 2. Vignette ------------------------------------------------------
    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.7);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    // -- 2b. Pose skeleton (dashed green joints) -------------------------
    // Note: the recorded blob is the raw MediaStream — never mirrored — so the
    // skeleton matches the drawn frames regardless of the live view's selfie
    // flip. `mirror` is kept as an option for future (mirrored-export) use.
    if (landmarkTimeline) {
      const lm = findNearest(landmarkTimeline, elapsedMs);
      if (lm) {
        drawPoseSkeletonCanvas(ctx, lm, {
          W, H,
          srcW: video.videoWidth,
          srcH: video.videoHeight,
          sx, sy, sw, sh,
          mirror: false,
          color: GREEN,
        });
      }
    }

    // -- 3. Fire wire-banner on each crossed 3s tick ----------------------
    if (crossedTick(lastElapsed, elapsedMs)) {
      const m = masteryFor(elapsedMs);
      if (m) {
        bannerText = m.name.toUpperCase();
        bannerStart = now;
        flashUntil = now + 500;
      }
    }
    lastElapsed = elapsedMs;

    // -- 4. Green radial flash during milestone --------------------------
    const flashRemaining = Math.max(0, flashUntil - now);
    if (flashRemaining > 0) {
      const intensity = (flashRemaining / 500) ** 1.4;
      const grd = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.25, W / 2, H * 0.55, H * 0.7);
      grd.addColorStop(0, hexToRgba(GREEN, 0.22 * intensity));
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    }

    // -- 5. Corner brackets ---------------------------------------------
    drawCorners(ctx, GREEN, 0.85);

    // -- 6. REC · 30fps (top-left) + CAM · 1280×720 (top-right) ---------
    drawTopChrome(ctx, video);

    // -- 7. Sky / Floor reference lines ---------------------------------
    drawReferenceLines(ctx);

    // -- 8. Timer (centered top) ----------------------------------------
    drawTimer(ctx, elapsedMs, color);

    // -- 9. RANK pill ---------------------------------------------------
    drawRankPill(ctx, elapsedMs, color);

    // -- 10. Wire-banner on milestone -----------------------------------
    const bannerAge = now - bannerStart;
    if (bannerText && bannerAge < bannerLife) {
      drawWireBanner(ctx, bannerText, bannerAge / bannerLife);
    }

    // -- 11. PB ribbon at the very top ----------------------------------
    if (isPersonalBest) {
      ctx.save();
      ctx.font = '900 34px Inter, sans-serif';
      ctx.fillStyle = GREEN;
      ctx.textAlign = 'center';
      ctx.shadowColor = GREEN;
      ctx.shadowBlur = 22;
      ctx.fillText('★  NEW PERSONAL BEST  ★', W / 2, 170);
      ctx.restore();
    }

    // -- 11b. Achievement badges (right-edge stack, pop-in on unlock) ---
    drawBadgeStack(ctx, earnedKeys, elapsedMs);

    // -- 12. Handle + watermark (bottom) --------------------------------
    ctx.save();
    ctx.font = '700 38px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 14;
    ctx.fillText(`${handle} · playstando.com`, W / 2, H - 95);
    ctx.restore();
  };

  // Drive the renderer off the source's video frames so we capture every one.
  let stopRequested = false;
  const driver = (cb) => {
    if (typeof video.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(() => { if (!stopRequested) cb(); });
    } else {
      requestAnimationFrame(() => { if (!stopRequested) cb(); });
    }
  };

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mime });
      URL.revokeObjectURL(srcUrl);
      resolve({ blob, mime, durationMs });
    };
    recorder.onerror = (e) => {
      URL.revokeObjectURL(srcUrl);
      reject(e.error || new Error('share-clip: recorder error'));
    };
    video.onended = () => {
      stopRequested = true;
      try { drawFrame(); } catch {}
      setTimeout(() => { try { recorder.stop(); } catch {} }, 120);
    };

    recorder.start(250);
    video.play().then(() => {
      const tick = () => { drawFrame(); driver(tick); };
      driver(tick);
    }).catch((err) => {
      URL.revokeObjectURL(srcUrl);
      reject(err);
    });
  });
}

// ---------- drawing helpers ----------------------------------------------

function drawCorners(ctx, color, alpha) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 6;
  const s = 70;
  const m = 48;
  // TL
  ctx.beginPath();
  ctx.moveTo(m, m + s); ctx.lineTo(m, m); ctx.lineTo(m + s, m);
  ctx.stroke();
  // TR
  ctx.beginPath();
  ctx.moveTo(W - m - s, m); ctx.lineTo(W - m, m); ctx.lineTo(W - m, m + s);
  ctx.stroke();
  // BL
  ctx.beginPath();
  ctx.moveTo(m, H - m - s); ctx.lineTo(m, H - m); ctx.lineTo(m + s, H - m);
  ctx.stroke();
  // BR
  ctx.beginPath();
  ctx.moveTo(W - m - s, H - m); ctx.lineTo(W - m, H - m); ctx.lineTo(W - m, H - m - s);
  ctx.stroke();
  ctx.restore();
}

function drawTopChrome(ctx, video) {
  ctx.save();
  // REC dot + label
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(140, 130, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 28px "JetBrains Mono", ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('REC · 30FPS', 165, 130);

  // CAM label top-right
  ctx.globalAlpha = 0.75;
  ctx.textAlign = 'right';
  ctx.fillText(`CAM · ${video.videoWidth}×${video.videoHeight}`, W - 140, 130);
  ctx.restore();
}

function drawReferenceLines(ctx) {
  ctx.save();
  ctx.strokeStyle = hexToRgba(GREEN, 0.42);
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 12]);
  const skyY = Math.round(H * 0.22);
  const gndY = Math.round(H * 0.76);
  ctx.beginPath();
  ctx.moveTo(W * 0.08, skyY); ctx.lineTo(W * 0.92, skyY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W * 0.08, gndY); ctx.lineTo(W * 0.92, gndY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = hexToRgba(GREEN, 0.6);
  ctx.font = '500 22px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('SKY LINE · TOES MUST CROSS', W * 0.92, skyY - 10);
  ctx.fillText('FLOOR LINE · WRISTS MUST LOCK', W * 0.92, gndY - 10);
  ctx.restore();
}

function drawTimer(ctx, elapsedMs, color) {
  const p = fmtParts(elapsedMs);
  const mainFont = '700 240px "JetBrains Mono", ui-monospace, monospace';
  const msFont = '700 92px "JetBrains Mono", ui-monospace, monospace';
  const timerY = 280;

  ctx.save();
  ctx.font = mainFont;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.shadowColor = color;
  ctx.shadowBlur = 40;

  // Measure segments so we can render MM:SS in one chunk then .cc smaller.
  const mainText = `${p.mm}:${p.ss}`;
  const mainW = ctx.measureText(mainText).width;
  ctx.font = msFont;
  const msText = `.${p.cc}`;
  const msW = ctx.measureText(msText).width;
  const totalW = mainW + msW + 12;

  ctx.textAlign = 'left';
  const x0 = (W - totalW) / 2;
  ctx.font = mainFont;
  ctx.fillText(mainText, x0, timerY);

  ctx.font = msFont;
  ctx.globalAlpha = 0.65;
  ctx.fillText(msText, x0 + mainW + 12, timerY + 125);
  ctx.restore();
}

function drawRankPill(ctx, elapsedMs, color) {
  const r = rankFor(elapsedMs);
  const label = r
    ? `RANK ${String(r.index).padStart(2, '0')} · ${r.name.toUpperCase().replace(/!$/, '')}`
    : 'PRE-FLIGHT';

  ctx.save();
  ctx.font = '700 30px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const textW = ctx.measureText(label).width;
  const padX = 34;
  const pillW = textW + padX * 2;
  const pillH = 64;
  const pillX = (W - pillW) / 2;
  const pillY = 580;

  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  roundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0a0a0b';
  ctx.fillText(label, W / 2, pillY + pillH / 2 + 1);
  ctx.restore();
}

function drawWireBanner(ctx, text, age) {
  // age in 0..1 across bannerLife. Scale up then hold; slight fade at end.
  const scale = Math.min(1, age * 4) * (1 - Math.max(0, age - 0.85) * 3);
  const alpha = Math.max(0, Math.min(1, 1 - Math.max(0, age - 0.85) * 3));

  ctx.save();
  ctx.translate(W / 2, H * 0.5);
  ctx.scale(scale || 0.001, scale || 0.001);
  ctx.globalAlpha = alpha;
  ctx.font = '900 140px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Back echoes (6 layers offset up-left progressively, fading).
  for (let i = 6; i >= 1; i--) {
    ctx.save();
    ctx.translate(-i * 4, i * 4);
    ctx.lineWidth = 3;
    ctx.strokeStyle = hexToRgba(GREEN, Math.max(0.05, 0.5 - i * 0.06));
    ctx.strokeText(text, 0, 0);
    ctx.restore();
  }

  // Front outline with glow.
  ctx.lineWidth = 5;
  ctx.strokeStyle = GREEN;
  ctx.shadowColor = GREEN;
  ctx.shadowBlur = 28;
  ctx.strokeText(text, 0, 0);
  ctx.restore();
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Prefer MP4 so exports play natively on every device + social platform.
// Falls back to webm on browsers that don't yet support MediaRecorder MP4.
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=avc1',
  'video/mp4;codecs=h264',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

function drawBadgeStack(ctx, earnedKeys, elapsedMs) {
  if (!earnedKeys || earnedKeys.length === 0) return;
  // Cap to 4 visible — any more overflows the right-side gutter between the
  // rank pill and the bottom watermark.
  const keys = earnedKeys.slice(0, 4);
  const r = 72;                    // 144px diameter — big enough to read on mobile feeds
  const gap = 30;
  const cx = W - r - 48;           // right-aligned, 48px inset from the frame
  const topY = 780;                // clears the rank pill (bottom ~644) with breathing room
  // Render from bottom-up so newest-unlocked stacks at top.
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const a = findAchievement(key);
    if (!a) continue;
    const unlockAt = BADGE_UNLOCK_MS[key] ?? 0;
    if (elapsedMs < unlockAt) continue; // hidden until first unlocked
    const age = elapsedMs - unlockAt;
    // 600ms pop-in: scale 1.6 -> 1.0, angle wobble.
    const t = Math.min(1, age / 600);
    const ease = 1 - Math.pow(1 - t, 3);
    const scale = 1.6 - 0.6 * ease;
    const rot = (1 - ease) * 0.25;
    const cy = topY + i * (r * 2 + gap);
    drawBadge(ctx, {
      cx, cy, r,
      tier: a.tier || 'bronze',
      emoji: a.icon || '🏆',
      scale,
      rot,
    });
  }
}

function drawBadge(ctx, { cx, cy, r, tier, emoji, scale = 1, rot = 0 }) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(scale, scale);

  const [a, b] = TIER_GRAD[tier] || TIER_GRAD.bronze;

  // Outer tier-gradient ring with soft glow.
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.shadowColor = a;
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Inner dark disc.
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0a0a0b';
  ctx.beginPath();
  ctx.arc(0, 0, r - 6, 0, Math.PI * 2);
  ctx.fill();

  // Emoji glyph centered.
  ctx.font = `700 ${Math.round(r * 1.1)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(emoji, 0, r * 0.08);

  ctx.restore();
}

function hexToRgba(hex, alpha) {
  const v = hex.replace('#', '');
  const full = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
