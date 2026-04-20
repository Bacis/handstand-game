import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';

// Generic tile: owns a canvas + a renderer instance. Exposes imperative update()
// so the parent's shared RAF can drive all tiles from one pose sample, instead
// of each tile ticking its own loop (which would desync them visually).
const SkeletonTile = forwardRef(function SkeletonTile(
  { title, blurb, RendererClass, accentClass = 'text-aura-purple' },
  ref
) {
  const hostRef = useRef(null);
  const rendererRef = useRef(null);
  const readyRef = useRef(false);

  useImperativeHandle(ref, () => ({
    update(pose, dt) {
      if (readyRef.current && rendererRef.current) {
        rendererRef.current.update(pose, dt);
      }
    },
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let destroyed = false;
    let initDone = false;
    const renderer = new RendererClass();
    rendererRef.current = renderer;

    const measure = () => {
      const rect = host.getBoundingClientRect();
      return { width: Math.max(1, Math.floor(rect.width)), height: Math.max(1, Math.floor(rect.height)) };
    };

    const { width, height } = measure();

    // Pixi v8 init is async — guard against unmount racing init (StrictMode remounts).
    // Renderer creates its own canvas inside `host`, so a stale init that resolves
    // after unmount can safely remove its own canvas without affecting the new renderer.
    renderer.init(host, width, height).then(() => {
      initDone = true;
      if (destroyed) {
        renderer.destroy();
        return;
      }
      readyRef.current = true;
    });

    const ro = new ResizeObserver(() => {
      const { width: w, height: h } = measure();
      if (readyRef.current) renderer.resize(w, h);
    });
    ro.observe(host);

    return () => {
      destroyed = true;
      readyRef.current = false;
      ro.disconnect();
      if (initDone) renderer.destroy();
      rendererRef.current = null;
    };
  }, [RendererClass]);

  return (
    <div className="rounded-2xl overflow-hidden border border-white/5 bg-ink-900/60 backdrop-blur flex flex-col">
      <div className="px-5 pt-4 pb-3 flex items-baseline justify-between gap-3">
        <div>
          <h3 className={`font-bold text-lg ${accentClass}`}>{title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{blurb}</p>
        </div>
        <button
          type="button"
          className="text-[11px] uppercase tracking-wider text-gray-500 hover:text-white border border-white/10 hover:border-white/30 rounded px-2 py-1 transition"
        >
          Pick
        </button>
      </div>
      <div
        ref={hostRef}
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '1 / 1', background: 'radial-gradient(ellipse at center, rgba(20,20,40,0.6), rgba(0,0,0,0.95))' }}
      />
      {/* Canvas is owned and appended by the renderer. */}
    </div>
  );
});

export default SkeletonTile;
