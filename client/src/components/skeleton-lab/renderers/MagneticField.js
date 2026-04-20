import { Application, Graphics, Container, BlurFilter } from 'pixi.js';
import { SKELETON_EDGES, JOINTS } from '../handstandKeyframes.js';
import { poseToScreen, hslHex, distSq } from './util.js';

const FIELD_COUNT = 90;
const POLARITY_FLIP_SEC = 4.0;

// Background iron-filing field: short segments whose angle aligns with the vector
// from the segment center to the nearest point on any bone. Adds a polarity flip
// every few seconds that rotates all segments 180° over a brief transition.
export default class MagneticField {
  constructor() {
    this.app = null;
    this.t = 0;
    this.field = [];
  }

  async init(host, width, height) {
    this.app = new Application();
    await this.app.init({
      width, height,
      backgroundAlpha: 0, antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 1.5),
      autoDensity: true,
    });
    this.app.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
    host.appendChild(this.app.canvas);

    this.fieldG = new Graphics();
    this.glow = new Graphics();
    this.core = new Graphics();
    this.joints = new Graphics();

    const fieldLayer = new Container();
    fieldLayer.addChild(this.fieldG);
    fieldLayer.blendMode = 'add';
    fieldLayer.alpha = 0.75;

    const glowLayer = new Container();
    glowLayer.addChild(this.glow);
    glowLayer.filters = [new BlurFilter({ strength: 8, quality: 2 })];
    glowLayer.blendMode = 'add';

    const coreLayer = new Container();
    coreLayer.addChild(this.core, this.joints);
    coreLayer.blendMode = 'add';

    this.app.stage.addChild(fieldLayer, glowLayer, coreLayer);
    this._seedField(width, height);
  }

  _seedField(w, h) {
    this.field.length = 0;
    for (let i = 0; i < FIELD_COUNT; i++) {
      this.field.push({
        x: Math.random() * w,
        y: Math.random() * h,
        len: 8 + Math.random() * 10,
      });
    }
  }

  resize(width, height) {
    if (!this.app) return;
    this.app.renderer.resize(width, height);
    this._seedField(width, height);
  }

  update(pose, dt) {
    if (!this.app) return;
    this.t += dt;
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    const pts = poseToScreen(pose, w, h);

    this.fieldG.clear();
    this.glow.clear();
    this.core.clear();
    this.joints.clear();

    // Polarity: smooth sign that flips every POLARITY_FLIP_SEC.
    const phase = (this.t % (POLARITY_FLIP_SEC * 2)) / (POLARITY_FLIP_SEC * 2);
    const polarity = Math.sin(phase * Math.PI * 2); // -1..1

    // Precompute bone endpoints once per frame.
    const bones = [];
    for (const [a, b] of SKELETON_EDGES) {
      const pa = pts[a], pb = pts[b];
      if (pa && pb) bones.push([pa.x, pa.y, pb.x, pb.y]);
    }

    for (const f of this.field) {
      // Find nearest point on any bone (approx: sample endpoints + midpoint).
      let bestDsq = Infinity;
      let dirX = 1, dirY = 0;
      for (const [ax, ay, bx, by] of bones) {
        const mx = (ax + bx) * 0.5, my = (ay + by) * 0.5;
        const samples = [[ax, ay], [mx, my], [bx, by]];
        for (const [sx, sy] of samples) {
          const d2 = distSq(f.x, f.y, sx, sy);
          if (d2 < bestDsq) {
            bestDsq = d2;
            dirX = sx - f.x;
            dirY = sy - f.y;
          }
        }
      }
      const mag = Math.sqrt(bestDsq) || 1;
      // inverse-square-ish falloff for brightness
      const intensity = Math.min(1, 20000 / (bestDsq + 800));
      const nx = (dirX / mag) * polarity;
      const ny = (dirY / mag) * polarity;
      const half = f.len * 0.5;
      const x1 = f.x - nx * half, y1 = f.y - ny * half;
      const x2 = f.x + nx * half, y2 = f.y + ny * half;
      const hue = 190 + 40 * Math.sin(this.t + f.x * 0.01);
      const color = hslHex(hue, 1, 0.5);
      this.fieldG.moveTo(x1, y1).lineTo(x2, y2)
        .stroke({ width: 1.4, color, alpha: 0.25 + 0.75 * intensity, cap: 'round' });
    }

    for (const [ax, ay, bx, by] of bones) {
      const color = hslHex(210 + 30 * polarity, 1.0, 0.65);
      this.glow.moveTo(ax, ay).lineTo(bx, by)
        .stroke({ width: 10, color, alpha: 0.9, cap: 'round' });
      this.core.moveTo(ax, ay).lineTo(bx, by)
        .stroke({ width: 2.2, color: 0xffffff, alpha: 1, cap: 'round' });
    }

    for (const idx of JOINTS) {
      const p = pts[idx];
      if (!p) continue;
      const r = idx === 0 ? 12 : 5;
      const c = hslHex(210 + 30 * polarity, 1.0, 0.7);
      this.joints.circle(p.x, p.y, r).fill({ color: c, alpha: 0.95 });
      this.joints.circle(p.x, p.y, r * 0.4).fill({ color: 0xffffff, alpha: 1 });
    }
  }

  destroy() {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true, textureSource: true });
      this.app = null;
    }
    this.field.length = 0;
  }
}
