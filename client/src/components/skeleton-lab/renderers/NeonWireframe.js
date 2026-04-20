import { Application, Graphics, Container, BlurFilter } from 'pixi.js';
import { SKELETON_EDGES, JOINTS } from '../handstandKeyframes.js';
import { poseToScreen, hslHex } from './util.js';

// Two stacked passes: a wide soft-glow layer with heavy blur + a crisp core on top.
// Hue cycles magenta -> cyan -> back, giving a "magnetic aurora" feel.
export default class NeonWireframe {
  constructor() {
    this.app = null;
    this.t = 0;
  }

  async init(host, width, height) {
    this.app = new Application();
    await this.app.init({
      width,
      height,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 1.5),
      autoDensity: true,
    });
    this.app.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
    host.appendChild(this.app.canvas);

    this.glow = new Graphics();
    this.core = new Graphics();
    this.joints = new Graphics();

    // Heavy blur on the glow layer creates the halo; additive blend compounds it.
    const glowLayer = new Container();
    glowLayer.addChild(this.glow);
    glowLayer.filters = [new BlurFilter({ strength: 12, quality: 2 })];
    glowLayer.blendMode = 'add';

    const coreLayer = new Container();
    coreLayer.addChild(this.core, this.joints);
    coreLayer.blendMode = 'add';

    this.app.stage.addChild(glowLayer, coreLayer);
  }

  resize(width, height) {
    if (this.app) this.app.renderer.resize(width, height);
  }

  update(pose, dt) {
    if (!this.app) return;
    this.t += dt;
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    const pts = poseToScreen(pose, w, h);

    this.glow.clear();
    this.core.clear();
    this.joints.clear();

    for (let i = 0; i < SKELETON_EDGES.length; i++) {
      const [a, b] = SKELETON_EDGES[i];
      const pa = pts[a], pb = pts[b];
      if (!pa || !pb) continue;
      // Hue phase walks along the body and drifts over time — gradient feel without per-pixel work.
      const hue = (i * 22 + this.t * 60) % 360;
      const color = hslHex(260 + 60 * Math.sin((hue * Math.PI) / 180), 1.0, 0.6);
      this.glow.moveTo(pa.x, pa.y).lineTo(pb.x, pb.y)
        .stroke({ width: 16, color, alpha: 0.85, cap: 'round' });
      this.core.moveTo(pa.x, pa.y).lineTo(pb.x, pb.y)
        .stroke({ width: 3, color: 0xffffff, alpha: 1, cap: 'round' });
    }

    for (const idx of JOINTS) {
      const p = pts[idx];
      if (!p) continue;
      const r = idx === 0 ? 14 : 6;
      const hue = (idx * 12 + this.t * 90) % 360;
      const c = hslHex(260 + 60 * Math.sin((hue * Math.PI) / 180), 1.0, 0.65);
      this.joints.circle(p.x, p.y, r).fill({ color: c, alpha: 1 });
      this.joints.circle(p.x, p.y, r * 0.45).fill({ color: 0xffffff, alpha: 1 });
    }
  }

  destroy() {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true, textureSource: true });
      this.app = null;
    }
  }
}
