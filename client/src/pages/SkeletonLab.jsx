import { useEffect, useRef } from 'react';
import SkeletonTile from '../components/skeleton-lab/SkeletonTile.jsx';
import { samplePose, applySplitOverlay, LOOP_DURATION } from '../components/skeleton-lab/handstandKeyframes.js';
import NeonWireframe from '../components/skeleton-lab/renderers/NeonWireframe.js';
import MagneticField from '../components/skeleton-lab/renderers/MagneticField.js';
import PlasmaArcs from '../components/skeleton-lab/renderers/PlasmaArcs.js';
import ParticleTrail from '../components/skeleton-lab/renderers/ParticleTrail.js';

const VARIANTS = [
  {
    key: 'neon',
    title: 'Neon Wireframe · Split',
    blurb: 'Soft halo + crisp core, magenta → cyan drift. Legs fan into a straddle mid-handstand.',
    accent: 'text-aura-purple',
    Renderer: NeonWireframe,
    usesSplit: true,
  },
  {
    key: 'magnetic',
    title: 'Magnetic Field',
    blurb: 'Iron-filing field pulled toward the body. Polarity flips every 4s.',
    accent: 'text-aura-cyan',
    Renderer: MagneticField,
  },
  {
    key: 'plasma',
    title: 'Plasma Arcs',
    blurb: 'Jagged electric bones, flickering, with occasional jump arcs.',
    accent: 'text-aura-gold',
    Renderer: PlasmaArcs,
  },
  {
    key: 'particles',
    title: 'Particle Trail',
    blurb: 'Each joint emits a hue-keyed trail of fading particles.',
    accent: 'text-aura-green',
    Renderer: ParticleTrail,
  },
];

export default function SkeletonLab() {
  const tileRefs = useRef(VARIANTS.map(() => ({ current: null })));

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const tSec = now / 1000;
      const base = samplePose(tSec);
      const withSplit = applySplitOverlay(base, tSec);
      for (let i = 0; i < VARIANTS.length; i++) {
        const p = VARIANTS[i].usesSplit ? withSplit : base;
        tileRefs.current[i].current?.update(p, dt);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
          Skeleton <span className="text-aura-purple">Lab</span>
        </h1>
        <p className="text-gray-400 mt-2 max-w-2xl">
          Four PixiJS candidates for the homepage hero animation. All four share the same
          pre-baked handstand loop ({LOOP_DURATION.toFixed(1)}s), driven by one RAF so they
          stay in sync — eyeball them side-by-side and pick a winner.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {VARIANTS.map((v, i) => (
          <SkeletonTile
            key={v.key}
            ref={tileRefs.current[i]}
            title={v.title}
            blurb={v.blurb}
            accentClass={v.accent}
            RendererClass={v.Renderer}
          />
        ))}
      </div>
    </div>
  );
}
