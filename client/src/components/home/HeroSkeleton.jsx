import { useEffect, useRef } from 'react';
import NeonWireframe from '../skeleton-lab/renderers/NeonWireframe.js';
import { samplePose, applySplitOverlay } from '../skeleton-lab/handstandKeyframes.js';

// Lock whichever landmark is lowest in the pose to a fixed ground y, so the body
// always "stands" on the same horizontal line — feet in STAND, hands in HANDSTAND,
// hands during KICK/PIKE. Makes the skeleton sit cleanly on the CTA button.
const GROUND_Y = 0.85;
function normalizeToGround(pose) {
  let maxY = -Infinity;
  for (const k in pose) if (pose[k].y > maxY) maxY = pose[k].y;
  const shift = GROUND_Y - maxY;
  if (Math.abs(shift) < 1e-6) return pose;
  const out = {};
  for (const k in pose) out[k] = { x: pose[k].x, y: pose[k].y + shift };
  return out;
}

// Slim embed: runs the Neon Wireframe renderer (with the split-legs overlay) as a
// standalone hero backdrop. Owns its own RAF so the hero stays self-contained.
export default function HeroSkeleton({ className = '', style }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const state = { destroyed: false, initDone: false, raf: 0, last: 0 };
    const renderer = new NeonWireframe();

    const measure = () => {
      const r = host.getBoundingClientRect();
      return { w: Math.max(1, Math.floor(r.width)), h: Math.max(1, Math.floor(r.height)) };
    };

    const { w, h } = measure();

    renderer.init(host, w, h).then(() => {
      state.initDone = true;
      if (state.destroyed) {
        renderer.destroy();
        return;
      }
      state.last = performance.now();
      const loop = (now) => {
        if (state.destroyed) return;
        const dt = Math.min(0.05, (now - state.last) / 1000);
        state.last = now;
        const t = now / 1000;
        const pose = normalizeToGround(applySplitOverlay(samplePose(t), t));
        renderer.update(pose, dt);
        state.raf = requestAnimationFrame(loop);
      };
      state.raf = requestAnimationFrame(loop);
    });

    const ro = new ResizeObserver(() => {
      if (!state.initDone) return;
      const m = measure();
      renderer.resize(m.w, m.h);
    });
    ro.observe(host);

    return () => {
      state.destroyed = true;
      cancelAnimationFrame(state.raf);
      ro.disconnect();
      if (state.initDone) renderer.destroy();
    };
  }, []);

  return <div ref={hostRef} className={className} style={style} aria-hidden />;
}
