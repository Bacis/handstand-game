// Corner-bracket + scanline chrome around the video frame. Pure CSS/SVG.
// The child is rendered as-is; this component overlays decorations via
// pointer-events-none absolutely-positioned layers so game logic stays untouched.
export default function HudFrame({ children, className = '', cornerColor = '#22D3EE' }) {
  const corner = (pos) => (
    <span
      aria-hidden
      className={`absolute w-8 h-8 pointer-events-none ${pos}`}
      style={{ color: cornerColor }}
    >
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <path
          d="M2 10 V2 H10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );

  return (
    <div className={`relative ${className}`}>
      {children}
      {/* Corner brackets — rotate same SVG for each corner. */}
      <span aria-hidden className="absolute inset-0 pointer-events-none">
        <span className="absolute top-1.5 left-1.5 w-8 h-8" style={{ color: cornerColor }}>
          <svg viewBox="0 0 32 32" className="w-full h-full">
            <path d="M2 10 V2 H10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </span>
        <span className="absolute top-1.5 right-1.5 w-8 h-8 rotate-90" style={{ color: cornerColor }}>
          <svg viewBox="0 0 32 32" className="w-full h-full">
            <path d="M2 10 V2 H10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </span>
        <span className="absolute bottom-1.5 right-1.5 w-8 h-8 rotate-180" style={{ color: cornerColor }}>
          <svg viewBox="0 0 32 32" className="w-full h-full">
            <path d="M2 10 V2 H10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </span>
        <span className="absolute bottom-1.5 left-1.5 w-8 h-8 -rotate-90" style={{ color: cornerColor }}>
          <svg viewBox="0 0 32 32" className="w-full h-full">
            <path d="M2 10 V2 H10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </span>
      </span>
      {/* Subtle scanline overlay. */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-20"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,255,255,0.06) 3px, transparent 4px)',
        }}
      />
    </div>
  );
}
