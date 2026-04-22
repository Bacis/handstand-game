// Floating overlay that fires once the guest attaches to the match. Sits
// above the split view for ~1.8 s, animates in and out, doesn't block the
// cameras so both players see the other appear as the banner fades.
export default function DuelJoinBanner({ visible, guestName }) {
  return (
    <div
      className={`absolute inset-x-0 top-16 z-40 pointer-events-none flex justify-center transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
      aria-hidden={!visible}
    >
      <div className="bg-brand-accent text-black font-mono uppercase tracking-[0.18em] text-sm font-bold px-5 py-3 rounded-sm shadow-[0_18px_50px_rgba(255,77,46,0.55)] flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-black motion-safe:animate-[pulseOp_1.2s_ease-in-out_infinite]" />
        Opponent joined{guestName ? ` · ${guestName}` : ''}
      </div>
    </div>
  );
}
