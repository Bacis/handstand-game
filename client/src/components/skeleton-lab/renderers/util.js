// Map normalized pose coords ([-1,1], y-down) to canvas pixel space,
// preserving aspect with a centered square fit.
export function poseToScreen(pose, w, h) {
  const s = Math.min(w, h) * 0.42;
  const cx = w / 2;
  const cy = h / 2;
  const out = {};
  for (const k in pose) {
    out[k] = { x: cx + pose[k].x * s, y: cy + pose[k].y * s };
  }
  return out;
}

// hsl(0..360, 0..1, 0..1) -> 0xRRGGBB
export function hslHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  const to = (v) => Math.round((v + m) * 255);
  return (to(r) << 16) | (to(g) << 8) | to(b);
}

export function distSq(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}
