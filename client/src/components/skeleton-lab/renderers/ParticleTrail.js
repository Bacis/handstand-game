import { Application, Graphics, Container, BlurFilter } from 'pixi.js';
import { SKELETON_EDGES, JOINTS } from '../handstandKeyframes.js';
import { poseToScreen, hslHex } from './util.js';

const LIFETIME = 1.0; // seconds
const EMIT_INTERVAL = 0.035; // seconds
const MAX_PARTICLES = 700;

// Each joint continuously emits a hue-keyed particle. Particles drift slowly
// away from where the joint was, fading over ~1.2s. Bones remain faintly visible
// so the body silhouette reads even behind the trails.
export default class ParticleTrail {
  constructor() {
    this.app = null;
    this.t = 0;
    this._sinceEmit = 0;
    this.particles = [];
    this._prevPts = null;
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

    this.bones = new Graphics();
    this.dots = new Graphics();

    const boneLayer = new Container();
    boneLayer.addChild(this.bones);
    boneLayer.alpha = 0.35;
    boneLayer.blendMode = 'add';

    const dotLayer = new Container();
    dotLayer.addChild(this.dots);
    dotLayer.blendMode = 'add';

    this.app.stage.addChild(boneLayer, dotLayer);
  }

  resize(width, height) {
    if (this.app) this.app.renderer.resize(width, height);
  }

  _hueFor(idx) {
    // spread across the hue wheel per joint so trails visually separate
    return (idx * 27) % 360;
  }

  update(pose, dt) {
    if (!this.app) return;
    this.t += dt;
    this._sinceEmit += dt;
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    const pts = poseToScreen(pose, w, h);

    // Emit on an interval (not per frame) so particle density is frame-rate independent.
    while (this._sinceEmit >= EMIT_INTERVAL && this.particles.length < MAX_PARTICLES) {
      this._sinceEmit -= EMIT_INTERVAL;
      for (const idx of JOINTS) {
        const p = pts[idx];
        if (!p) continue;
        // inherit a fraction of joint velocity so trails elongate along motion
        const prev = this._prevPts?.[idx];
        const vx = prev ? (p.x - prev.x) * 0.25 : 0;
        const vy = prev ? (p.y - prev.y) * 0.25 : 0;
        this.particles.push({
          x: p.x + (Math.random() - 0.5) * 4,
          y: p.y + (Math.random() - 0.5) * 4,
          vx: vx + (Math.random() - 0.5) * 12,
          vy: vy + (Math.random() - 0.5) * 12,
          age: 0,
          hue: this._hueFor(idx),
          r: 2 + Math.random() * 3,
        });
      }
    }
    this._prevPts = pts;

    // Advance particles; compact in place to avoid allocations.
    let write = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= LIFETIME) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      this.particles[write++] = p;
    }
    this.particles.length = write;

    this.bones.clear();
    this.dots.clear();

    for (const [a, b] of SKELETON_EDGES) {
      const pa = pts[a], pb = pts[b];
      if (!pa || !pb) continue;
      this.bones.moveTo(pa.x, pa.y).lineTo(pb.x, pb.y)
        .stroke({ width: 2, color: 0xffffff, alpha: 0.9, cap: 'round' });
    }

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const u = p.age / LIFETIME;
      const alpha = (1 - u) * (1 - u);
      const color = hslHex(p.hue, 1, 0.55 + 0.25 * (1 - u));
      this.dots.circle(p.x, p.y, p.r * (1 - 0.3 * u)).fill({ color, alpha });
    }
  }

  destroy() {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true, textureSource: true });
      this.app = null;
    }
    this.particles.length = 0;
  }
}
