// Small rank medallion for top-3. Anything past 3 just renders the number
// to keep rows compact. Accepts an optional size override.
const STYLES = {
  1: { ring: 'ring-yellow-400/70', bg: 'bg-yellow-500/15',  emoji: '🥇' },
  2: { ring: 'ring-gray-300/70',   bg: 'bg-gray-400/15',    emoji: '🥈' },
  3: { ring: 'ring-orange-400/70', bg: 'bg-orange-500/15',  emoji: '🥉' },
};

export default function Medal({ place, size = 'md' }) {
  const s = STYLES[place];
  const dims = size === 'lg' ? 'w-10 h-10 text-xl' : 'w-8 h-8 text-base';
  if (!s) {
    return <span className={`inline-flex items-center justify-center ${dims} text-gray-500 font-bold tabular-nums`}>{place}</span>;
  }
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ring-2 ${s.ring} ${s.bg} ${dims}`}
      aria-label={`rank ${place}`}
      title={`#${place}`}
    >
      {s.emoji}
    </span>
  );
}
