import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { heatColor } from '../lib/milestones.js';

// Body edges used to draw the skeleton.
const SKELETON_EDGES = [
  [11, 13], [13, 15],            // left arm
  [12, 14], [14, 16],            // right arm
  [11, 12], [11, 23], [12, 24], [23, 24],  // shoulders + torso
  [23, 25], [25, 27],            // left leg
  [24, 26], [26, 28],            // right leg
];
const SMOOTH_ALPHA = 0.5;
const SMOOTH_VIS_ALPHA = 0.25;
const MIN_VIS = 0.4;

// ---------------------------------------------------------------------------
// Three.js effect layer rendered atop the camera feed. Owns:
//   - aspect-aware orthographic camera (so things don't get clipped by edge)
//   - particle pool with chromatic spread (electromagnetic feel on bursts)
//   - full-screen edge-flash quad (vignette pulse on milestone)
//   - line-rendered TextGeometry banner with animated per-vertex colors,
//     positioned in the largest empty rectangle around the body
//
// Skeleton + locked HUD timer live in the parent as DOM/SVG overlays —
// Three.js is reserved for the celebratory animations.
// ---------------------------------------------------------------------------

let _font = null;
let _fontLoading = null;
function loadFont() {
  if (_font) return Promise.resolve(_font);
  if (_fontLoading) return _fontLoading;
  _fontLoading = new Promise((resolve, reject) => {
    new FontLoader().load(
      '/fonts/helvetiker_bold.typeface.json',
      (f) => { _font = f; resolve(f); },
      undefined,
      reject
    );
  });
  return _fontLoading;
}

const AuraOverlay = forwardRef(function AuraOverlay({ active }, ref) {
  const containerRef = useRef(null);
  const stateRef = useRef({
    renderer: null,
    scene: null,
    camera: null,
    aspect: 1,
    particles: null,
    particleData: null,
    edgeMesh: null,
    banner: null,
    raf: 0,
    landmarks: null,
    elapsedMs: 0,
    prevElapsedMs: 0,
    active: false,
    flash: { until: 0, color: new THREE.Color('#ffffff') },
  });

  useImperativeHandle(ref, () => ({
    pushFrame({ landmarks, elapsedMs }) {
      const s = stateRef.current;
      s.landmarks = landmarks;
      s.prevElapsedMs = s.elapsedMs;
      s.elapsedMs = elapsedMs;
    },
    triggerTick(_hexColor) {
      // Particle bursts disabled for now — banner + sound carries the moment.
    },
    showBanner(text, subtitle, hexColor) {
      const s = stateRef.current;
      if (!s.banner) return;
      const placement = pickBannerPlacement(s.landmarks, s.aspect);
      s.banner.show(text, subtitle, hexColor || '#FFFFFF', placement);
    },
    setActive(active) { stateRef.current.active = active; },
  }));

  useEffect(() => { stateRef.current.active = active; }, [active]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    // Aspect-aware orthographic camera: y stays in [-1, 1], x scales with
    // viewport so wide / tall containers don't squash content.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.set(0, 0, 5);

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      const aspect = w / h;
      camera.left = -aspect;
      camera.right = aspect;
      camera.updateProjectionMatrix();
      stateRef.current.aspect = aspect;
      stateRef.current.banner?.fitToViewport(aspect);
      // LineMaterial needs the resolution in pixels for correct line widths.
      stateRef.current.skeletonMat?.resolution.set(w, h);
    };
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.pointerEvents = 'none';
    container.appendChild(renderer.domElement);
    resize();
    // Container can resize independently of the window (e.g. when the video
    // metadata loads and the parent's aspect-ratio recalculates). Watch it.
    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);

    // Edge-flash quad — uses NDC directly so it always fills viewport.
    const edgeGeom = new THREE.PlaneGeometry(2, 2);
    const edgeMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color('#ffffff') },
        uIntensity: { value: 0.0 },
        uTime: { value: 0.0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec2 d = min(vUv, 1.0 - vUv);
          float edge = min(d.x, d.y);
          // Sharper falloff plus a thin "scan" ring traveling outward
          float a = pow(1.0 - smoothstep(0.0, 0.30, edge), 2.0);
          // Subtle time-varying chromatic ripple
          float ripple = 0.85 + 0.15 * sin(uTime * 3.0 + edge * 40.0);
          gl_FragColor = vec4(uColor * ripple, a * uIntensity);
        }
      `,
    });
    const edgeMesh = new THREE.Mesh(edgeGeom, edgeMat);
    edgeMesh.frustumCulled = false;
    scene.add(edgeMesh);

    // Particle pool — bigger and chromatic. Each particle is a Point sprite
    // with its own color (multi-hue spread inside one burst).
    const POOL = 240;
    const positions = new Float32Array(POOL * 3);
    const colors = new Float32Array(POOL * 3);
    const sizes = new Float32Array(POOL);
    const partGeom = new THREE.BufferGeometry();
    partGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    partGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    partGeom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    const partMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uPixelRatio * (300.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          // Soft circular sprite
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c);
          float a = smoothstep(0.5, 0.0, r);
          gl_FragColor = vec4(vColor, a);
        }
      `,
    });
    const particles = new THREE.Points(partGeom, partMat);
    scene.add(particles);
    const particleData = Array.from({ length: POOL }, () => ({
      alive: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1000,
      color: new THREE.Color(), size: 8,
    }));

    // Line-rendered text banner (loads font asynchronously; until then,
    // showBanner is a no-op).
    const banner = new LineTextBanner(scene);
    loadFont().then(() => banner.setFont(_font, stateRef.current.aspect)).catch(() => {});

    // Chromatic skeleton — LineSegments2 + LineMaterial so we can actually
    // set a pixel-width (native WebGL lines are capped at 1px). Per-vertex
    // colors drive the magnetic chromatic shimmer, computed on CPU each frame.
    const skeletonGeom = new LineSegmentsGeometry();
    // Pre-allocate typed arrays for positions + colors to avoid churn.
    const SEG_COUNT = SKELETON_EDGES.length;
    const skeletonPos = new Float32Array(SEG_COUNT * 2 * 3);  // 2 pts/seg * xyz
    const skeletonCol = new Float32Array(SEG_COUNT * 2 * 3);  // 2 pts/seg * rgb
    skeletonGeom.setPositions(skeletonPos);
    skeletonGeom.setColors(skeletonCol);
    const skeletonMat = new LineMaterial({
      linewidth: 6,           // pixels
      vertexColors: true,
      transparent: true,
      worldUnits: false,
      alphaToCoverage: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      opacity: 0.9,
    });
    skeletonMat.resolution.set(container.clientWidth || 1, container.clientHeight || 1);
    const skeleton = new LineSegments2(skeletonGeom, skeletonMat);
    skeleton.computeLineDistances();
    skeleton.frustumCulled = false;
    skeleton.visible = false;
    scene.add(skeleton);

    Object.assign(stateRef.current, {
      renderer, scene, camera, particles, particleData, edgeMesh, banner,
      skeleton, skeletonMat, skeletonGeom, skeletonPos, skeletonCol,
      smoothedLandmarks: null,
    });

    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      step(stateRef.current, now, dt);
      renderer.render(scene, camera);
      stateRef.current.raf = requestAnimationFrame(loop);
    };
    stateRef.current.raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(stateRef.current.raf);
      window.removeEventListener('resize', onResize);
      resizeObserver.disconnect();
      edgeGeom.dispose();
      edgeMat.dispose();
      partGeom.dispose();
      partMat.dispose();
      skeletonGeom.dispose();
      skeletonMat.dispose();
      banner.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 pointer-events-none" />;
});

export default AuraOverlay;

// ---------- helpers ----------

// (Tier-based milestone triggers removed — every-3s mastery ticks are the
// only achievement system now.)

// Chromatic spread: each particle's color is a hue-rotated variant of the
// base, giving the burst an electromagnetic / prism feel.
function spawnBurst(s, baseColor, count = 40) {
  const data = s.particleData;
  const baseHsl = { h: 0, s: 0, l: 0 };
  baseColor.getHSL(baseHsl);
  let spawned = 0;
  for (let i = 0; i < data.length && spawned < count; i++) {
    const p = data[i];
    if (p.alive) continue;
    p.alive = true;
    p.x = (Math.random() - 0.5) * 0.4;
    p.y = (Math.random() - 0.5) * 0.4;
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.7 + Math.random() * 0.9;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.age = 0;
    p.life = 900 + Math.random() * 500;
    p.size = 6 + Math.random() * 14;
    // Hue-shift around the base for chromatic spread.
    const h = (baseHsl.h + (Math.random() - 0.5) * 0.25 + 1) % 1;
    p.color.setHSL(h, Math.min(1, baseHsl.s + 0.2), 0.55 + Math.random() * 0.25);
    spawned++;
  }
}

function step(s, now, dt) {
  const { edgeMesh, particles, particleData, banner } = s;
  if (!edgeMesh) return;

  particles.material.uniforms.uTime.value = now * 0.001;

  // Edge-flash quad fully disabled: the additive vignette was reading as a
  // dim rectangle in the middle of the frame. Mesh is left in place but not
  // updated, so it renders fully transparent (uIntensity stays at 0).
  edgeMesh.visible = false;

  // Skeleton: smooth landmarks, push to BufferGeometry, drive shader uniforms.
  if (s.skeleton) updateSkeleton(s, now);

  if (banner) banner.update(now);

  // Particle integration.
  const posAttr = particles.geometry.attributes.position;
  const colAttr = particles.geometry.attributes.color;
  const sizeAttr = particles.geometry.attributes.size;
  for (let i = 0; i < particleData.length; i++) {
    const p = particleData[i];
    if (!p.alive) {
      posAttr.array[i * 3 + 0] = 0;
      posAttr.array[i * 3 + 1] = 0;
      posAttr.array[i * 3 + 2] = -10;
      sizeAttr.array[i] = 0;
      continue;
    }
    p.age += dt;
    if (p.age >= p.life) { p.alive = false; continue; }
    p.x += p.vx * (dt / 1000);
    p.y += p.vy * (dt / 1000);
    p.vy -= 0.5 * (dt / 1000);
    const fade = 1 - p.age / p.life;
    posAttr.array[i * 3 + 0] = p.x;
    posAttr.array[i * 3 + 1] = p.y;
    posAttr.array[i * 3 + 2] = 0;
    colAttr.array[i * 3 + 0] = p.color.r * fade;
    colAttr.array[i * 3 + 1] = p.color.g * fade;
    colAttr.array[i * 3 + 2] = p.color.b * fade;
    sizeAttr.array[i] = p.size * (0.4 + 0.6 * fade);
  }
  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
  sizeAttr.needsUpdate = true;
}

// Banner placement is always dead-center of the canvas — overlap with the
// subject is acceptable because the banner fades out within ~2s.
function pickBannerPlacement() {
  return { x: 0, y: 0 };
}

// MediaPipe normalized image coords → world coords (aspect-aware orthographic).
// MP x: 0..1 left→right → world x: -aspect..aspect.
// MP y: 0..1 top→bottom  → world y: 1..-1 (flipped — world y is up).
function mpToWorld(p, aspect = 1) {
  return { x: (p.x * 2 - 1) * aspect, y: -(p.y * 2 - 1) };
}

function updateSkeleton(s, now) {
  const { skeleton, skeletonMat, skeletonGeom, skeletonPos, skeletonCol, landmarks } = s;
  if (!landmarks) {
    skeleton.visible = false;
    return;
  }

  // Smooth landmarks (exponential lerp, plus visibility smoothing).
  if (!s.smoothedLandmarks || s.smoothedLandmarks.length !== landmarks.length) {
    s.smoothedLandmarks = landmarks.map((l) => ({ x: l.x, y: l.y, v: l.visibility ?? 1 }));
  } else {
    for (let i = 0; i < landmarks.length; i++) {
      const l = landmarks[i];
      const sm = s.smoothedLandmarks[i];
      sm.x += (l.x - sm.x) * SMOOTH_ALPHA;
      sm.y += (l.y - sm.y) * SMOOTH_ALPHA;
      sm.v += ((l.visibility ?? 1) - sm.v) * SMOOTH_VIS_ALPHA;
    }
  }

  // Heat-driven base color — RGB normalized 0..1.
  const heatRgb = hexToRgbNorm(s.active ? heatColor(s.elapsedMs) : '#22D3EE');
  const mix = s.active ? 0.6 : 0.85;   // higher = more heat, less chromatic
  const t = now * 0.001;

  let posIdx = 0;
  let colIdx = 0;
  let anyVisible = false;
  for (const [a, b] of SKELETON_EDGES) {
    const la = s.smoothedLandmarks[a];
    const lb = s.smoothedLandmarks[b];
    const lowVis = !la || !lb || (la.v + lb.v) / 2 < MIN_VIS;
    if (lowVis) {
      // Collapse off-screen so the segment doesn't render.
      skeletonPos[posIdx++] = 0; skeletonPos[posIdx++] = 0; skeletonPos[posIdx++] = -10;
      skeletonPos[posIdx++] = 0; skeletonPos[posIdx++] = 0; skeletonPos[posIdx++] = -10;
      // Black colors (won't matter since segment is hidden).
      for (let k = 0; k < 6; k++) skeletonCol[colIdx++] = 0;
      continue;
    }
    const pa = mpToWorld(la, s.aspect);
    const pb = mpToWorld(lb, s.aspect);
    skeletonPos[posIdx++] = pa.x; skeletonPos[posIdx++] = pa.y; skeletonPos[posIdx++] = 0;
    skeletonPos[posIdx++] = pb.x; skeletonPos[posIdx++] = pb.y; skeletonPos[posIdx++] = 0;

    // Per-vertex chromatic colors mixed with heat — magnetic shimmer that
    // travels along the body as the user moves.
    chromaticMixed(pa.x, t, heatRgb, mix, skeletonCol, colIdx);     colIdx += 3;
    chromaticMixed(pb.x, t, heatRgb, mix, skeletonCol, colIdx);     colIdx += 3;
    anyVisible = true;
  }

  skeletonGeom.setPositions(skeletonPos);
  skeletonGeom.setColors(skeletonCol);
  skeleton.visible = anyVisible;
  skeletonMat.opacity = s.active ? 0.9 : 0.55;
}

function chromaticMixed(x, t, heatRgb, mix, out, base) {
  const phase = x * 6 + t * 2;
  const cr = 0.5 + 0.5 * Math.sin(phase);
  const cg = 0.5 + 0.5 * Math.sin(phase + 2.094);
  const cb = 0.5 + 0.5 * Math.sin(phase + 4.189);
  out[base + 0] = cr * (1 - mix) + heatRgb[0] * mix;
  out[base + 1] = cg * (1 - mix) + heatRgb[1] * mix;
  out[base + 2] = cb * (1 - mix) + heatRgb[2] * mix;
}

function hexToRgbNorm(hex) {
  // Accepts '#RRGGBB'. Returns [r, g, b] in 0..1.
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

// Translates a BufferGeometry so its bounding box is centered around origin.
// EdgesGeometry inherits its source's vertex positions, but the bbox of just
// the edge endpoints can drift slightly from the source's bbox (e.g. text
// baseline vs. cap height). Recentering here guarantees the final mesh sits
// on (0,0,0) regardless of font-metric quirks.
function centerGeometry(geom) {
  geom.computeBoundingBox();
  const bb = geom.boundingBox;
  const cx = (bb.min.x + bb.max.x) / 2;
  const cy = (bb.min.y + bb.max.y) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;
  geom.translate(-cx, -cy, -cz);
  geom.computeBoundingBox();
}

// ---------------------------------------------------------------------------
// LineTextBanner — direct port of the Three.js webgl_custom_attributes_lines
// example, re-scaled for our orthographic viewport.
//
// Approach (matching the example exactly):
//   1. Build a *beveled* TextGeometry — produces a dense vertex cloud
//      describing the 3D extruded glyphs.
//   2. Render with `THREE.Line` (a single continuous stroke through every
//      vertex in geometry order) — this is what creates the signature noisy
//      scribble texture, not edges/segments.
//   3. Per-vertex `displacement` (vec3) + `customColor` (vec3) attributes.
//   4. Each frame: jitter the displacement values + pulse the `amplitude`
//      uniform (sin) + slowly drift `color` uniform hue.
// ---------------------------------------------------------------------------

const BANNER_VERTEX_SHADER = /* glsl */ `
  uniform float amplitude;
  attribute vec3 displacement;
  attribute vec3 customColor;
  varying vec3 vColor;
  void main() {
    vec3 newPosition = position + amplitude * displacement;
    vColor = customColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

const BANNER_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 color;
  uniform float opacity;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor * color, opacity);
  }
`;

class LineTextBanner {
  constructor(scene) {
    this.scene = scene;
    this.font = null;
    this.line = null;
    this.geometry = null;
    this.shownAt = 0;
    this.aspect = 1;
    this.fitScale = 1;
    this.lifeMs = 2400;
    this.uniforms = {
      amplitude: { value: 0 },           // animated per frame
      opacity:   { value: 0 },           // banner fade
      color:     { value: new THREE.Color('#ffffff') },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: BANNER_VERTEX_SHADER,
      fragmentShader: BANNER_FRAGMENT_SHADER,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      transparent: true,
    });
  }

  setFont(font, aspect) {
    this.font = font;
    this.aspect = aspect;
  }

  fitToViewport(aspect) {
    this.aspect = aspect;
    if (this.line) this._applyScale();
  }

  show(text, _subtitle, color) {
    if (!this.font) return;
    this._removeLine();

    this.uniforms.color.value = new THREE.Color(color);
    this.uniforms.opacity.value = 0;
    this.uniforms.amplitude.value = 0;

    // 3D bevelled text — depth + bevels are what make the line cloud chaotic.
    const geometry = new TextGeometry(String(text || '').toUpperCase(), {
      font: this.font,
      size: 0.22,
      depth: 0.07,
      curveSegments: 8,
      bevelEnabled: true,
      bevelThickness: 0.022,
      bevelSize: 0.008,
      bevelSegments: 6,
    });
    geometry.center();

    const count = geometry.attributes.position.count;
    const displacement = new THREE.Float32BufferAttribute(count * 3, 3);
    geometry.setAttribute('displacement', displacement);

    // HSL ladder per vertex — every vertex gets a unique hue, just like the
    // example. The shader multiplies this against the milestone color tint.
    const customColor = new THREE.Float32BufferAttribute(count * 3, 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < count; i++) {
      tmp.setHSL(i / count, 0.55, 0.55);
      tmp.toArray(customColor.array, i * 3);
    }
    geometry.setAttribute('customColor', customColor);

    this.geometry = geometry;
    this.line = new THREE.Line(geometry, this.material);
    this.line.position.set(0, 0, 0);
    // Static tilt so the bevelled extrusion shows depth (the orthographic
    // camera doesn't foreshorten, but the angle reveals side faces of the
    // 3D glyphs). Roughly: 9° pitch up, -6° yaw — enough to read 3D, not
    // enough to make text hard to read.
    this.line.rotation.set(0.16, -0.10, 0);
    this._applyScale();
    this.scene.add(this.line);
    this.shownAt = performance.now();
  }

  _applyScale() {
    if (!this.line) return;
    this.geometry.computeBoundingBox();
    const bb = this.geometry.boundingBox;
    const widthLocal = bb.max.x - bb.min.x;
    // Fit text to ≤ 80% of the current viewport's world-x range, capped.
    const targetWorld = Math.min(2 * this.aspect * 0.8, 2.6);
    const scale = widthLocal > 0 ? Math.min(1.5, targetWorld / widthLocal) : 1;
    this.fitScale = scale;
    this.line.scale.set(scale, scale, scale);
  }

  update(now) {
    if (!this.line) return;
    const t = (now - this.shownAt) / this.lifeMs;
    if (t >= 1) { this._removeLine(); return; }

    // Banner envelope: 0..0.1 fade-in, 0.1..0.85 hold, 0.85..1 fade-out.
    let alpha = 1;
    let popScale = 1;
    if (t < 0.1) {
      const k = t / 0.1;
      alpha = k;
      popScale = 0.6 + k * 0.55;
    } else if (t < 0.2) {
      const k = (t - 0.1) / 0.1;
      popScale = 1.15 - k * 0.15;
    } else if (t < 0.85) {
      popScale = 1;
    } else {
      const k = (t - 0.85) / 0.15;
      alpha = 1 - k;
    }
    this.uniforms.opacity.value = alpha;
    const s = this.fitScale * popScale;
    this.line.scale.set(s, s, s);

    // Pulsing amplitude (matches the example's sin pulse) + accumulating
    // per-vertex jitter — the signature scribble shimmer.
    this.uniforms.amplitude.value = Math.sin(now * 0.005);

    const arr = this.geometry.attributes.displacement.array;
    // Jitter scaled to text size: example used ±0.15 per frame on size 50
    // (0.3% of size). Mirroring that ratio for our 0.22 text gives ~0.0007.
    const J = 0.0007;
    for (let i = 0; i < arr.length; i++) {
      arr[i] += J * (Math.random() - 0.5) * 2;
    }
    this.geometry.attributes.displacement.needsUpdate = true;

    // Slow hue drift on the base color, also from the example.
    this.uniforms.color.value.offsetHSL(0.0008, 0, 0);
  }

  _removeLine() {
    if (!this.line) return;
    this.scene.remove(this.line);
    this.geometry?.dispose();
    this.line = null;
    this.geometry = null;
  }

  dispose() {
    this._removeLine();
    this.material.dispose();
  }
}
