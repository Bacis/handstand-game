// MediaPipe pose topology — single source of truth shared by the live SVG
// overlay (components/track/PoseSkeleton.jsx) and the canvas-based share
// clip renderer (lib/shareClip.js).

export const CONNECTIONS = [
  [11, 13], [13, 15],                          // left arm
  [12, 14], [14, 16],                          // right arm
  [11, 12], [11, 23], [12, 24], [23, 24],      // torso
  [23, 25], [25, 27], [24, 26], [26, 28],      // legs
  [27, 29], [29, 31], [27, 31],                // left foot
  [28, 30], [30, 32], [28, 32],                // right foot
];

export const HEAD_JOINT = 0;

export const JOINTS_TO_DOT = [
  0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
];

/**
 * Draw the pose skeleton onto a 2D canvas context, cover-cropped to match the
 * same (sx, sy, sw, sh) → (0, 0, W, H) transform the source video uses. Keep
 * visual parity with PoseSkeleton.jsx: dashed green joints, filled circles,
 * soft glow, selfie-mirror flip when mirror=true.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x:number,y:number,visibility?:number}>} landmarks
 * @param {object} opts
 * @param {number} opts.W   target canvas width
 * @param {number} opts.H   target canvas height
 * @param {number} opts.srcW   source video width
 * @param {number} opts.srcH   source video height
 * @param {number} opts.sx  source crop x
 * @param {number} opts.sy  source crop y
 * @param {number} opts.sw  source crop width
 * @param {number} opts.sh  source crop height
 * @param {boolean} [opts.mirror]
 * @param {string}  [opts.color]
 */
export function drawPoseSkeletonCanvas(
  ctx,
  landmarks,
  { W, H, srcW, srcH, sx, sy, sw, sh, mirror = false, color = '#33ff66' },
) {
  if (!landmarks || landmarks.length === 0) return;

  const scaleX = W / sw;
  const scaleY = H / sh;

  const pt = (i) => {
    const lm = landmarks[i];
    if (!lm) return null;
    if ((lm.visibility ?? 1) < 0.3) return null;
    let px = lm.x * srcW;
    const py = lm.y * srcH;
    // Cover-crop into target: shift by crop origin then scale.
    let x = (px - sx) * scaleX;
    const y = (py - sy) * scaleY;
    if (mirror) x = W - x;
    return { x, y };
  };

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.setLineDash([4, 7]);

  for (const [a, b] of CONNECTIONS) {
    const pa = pt(a);
    const pb = pt(b);
    if (!pa || !pb) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.fillStyle = color;
  for (const idx of JOINTS_TO_DOT) {
    const p = pt(idx);
    if (!p) continue;
    const r = idx === HEAD_JOINT ? 10 : 5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
