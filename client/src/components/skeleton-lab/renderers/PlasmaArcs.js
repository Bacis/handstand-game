import { Application, Graphics, Container, BlurFilter } from 'pixi.js';
import { SKELETON_EDGES, JOINTS } from '../handstandKeyframes.js';
import { poseToScreen, hslHex } from './util.js';

// Bones replaced by jagged midpoint-displaced polylines regenerated every frame.
// Two layers: thick violet outer glow (blurred) + bright white core. Flickers,
// with an occasional extra arc jumping between non-connected joints.
export default class PlasmaArcs {
  constructor() {
    this.app = null;
    this.t = 0;
    this._nextJump = 0.8;
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

    this.outer = new Graphics();
    this.inner = new Graphics();
    this.joints = new Graphics();

    const outerLayer = new Container();
    outerLayer.addChild(this.outer);
    outerLayer.filters = [new BlurFilter({ strength: 10, quality: 2 })];
    outerLayer.blendMode = 'add';

    const innerLayer = new Container();
    innerLayer.addChild(this.inner, this.joints);
    innerLayer.blendMode = 'add';

    this.app.stage.addChild(outerLayer, innerLayer);
  }

  resize(width, height) {
    if (this.app) this.app.renderer.resize(width, height);
  }

  _jaggedLine(g, x1, y1, x2, y2, opts) {
    const { segments = 10, jitter = 0.06, width, color, alpha } = opts;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / (len || 1), ny = dx / (len || 1);
    g.moveTo(x1, y1);
    for (let i = 1; i < segments; i++) {
      const u = i / segments;
      // tri-shaped falloff so endpoints don't jitter away from the anchor joints
      const falloff = 4 * u * (1 - u);
      const offset = (Math.random() - 0.5) * 2 * jitter * len * falloff;
      const px = x1 + dx * u + nx * offset;
      const py = y1 + dy * u + ny * offset;
      g.lineTo(px, py);
    }
    g.lineTo(x2, y2);
    g.stroke({ width, color, alpha, cap: 'round', join: 'round' });
  }

  update(pose, dt) {
    if (!this.app) return;
    this.t += dt;
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    const pts = poseToScreen(pose, w, h);

    this.outer.clear();
    this.inner.clear();
    this.joints.clear();

    // Flicker the whole thing slightly — adds life without losing the body silhouette.
    const flicker = 0.75 + 0.25 * Math.random();

    for (const [a, b] of SKELETON_EDGES) {
      const pa = pts[a], pb = pts[b];
      if (!pa || !pb) continue;
      this._jaggedLine(this.outer, pa.x, pa.y, pb.x, pb.y, {
        segments: 12, jitter: 0.05,
        width: 10, color: hslHex(280, 1.0, 0.55), alpha: 0.9 * flicker,
      });
      this._jaggedLine(this.inner, pa.x, pa.y, pb.x, pb.y, {
        segments: 12, jitter: 0.05,
        width: 2.5, color: 0xffffff, alpha: flicker,
      });
    }

    // Occasional cross-body "jump arc" to sell the electric feel.
    this._nextJump -= dt;
    if (this._nextJump <= 0) {
      const a = pts[15], b = pts[28]; // wrist -> opposite ankle
      if (a && b) {
        this._jaggedLine(this.outer, a.x, a.y, b.x, b.y, {
          segments: 22, jitter: 0.12,
          width: 8, color: hslHex(200, 1, 0.6), alpha: 0.75,
        });
        this._jaggedLine(this.inner, a.x, a.y, b.x, b.y, {
          segments: 22, jitter: 0.12,
          width: 1.8, color: 0xffffff, alpha: 0.95,
        });
      }
      this._nextJump = 0.6 + Math.random() * 1.4;
    }

    for (const idx of JOINTS) {
      const p = pts[idx];
      if (!p) continue;
      const r = idx === 0 ? 12 : 5;
      this.joints.circle(p.x, p.y, r).fill({ color: hslHex(200, 1, 0.7), alpha: 1 });
      this.joints.circle(p.x, p.y, r * 0.4).fill({ color: 0xffffff, alpha: 1 });
    }
  }

  destroy() {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true, textureSource: true });
      this.app = null;
    }
  }
}
