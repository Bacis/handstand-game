// Tier ladder — gives every attempt a piece of social capital.
// Each tier has a name (used in stamps + share copy), a color, and a sigil
// emoji that doubles as a quick visual identifier.

export const TIERS = [
  { id: 'first',   minMs: 0,       name: 'First Hold',     color: '#FFFFFF', sigil: '✺',  shareLine: 'first hold' },
  { id: 'five',    minMs: 5_000,   name: '5-Second Club',  color: '#22D3EE', sigil: '✦',  shareLine: 'cracked 5s' },
  { id: 'fifteen', minMs: 15_000,  name: '15-Second Club', color: '#A855F7', sigil: '✦',  shareLine: 'cracked 15s' },
  { id: 'thirty',  minMs: 30_000,  name: '30-Second Club', color: '#EAB308', sigil: '✧',  shareLine: 'cracked 30s' },
  { id: 'minute',  minMs: 60_000,  name: 'Minute Club',    color: '#F472B6', sigil: '✧',  shareLine: 'cracked 1 min' },
  { id: 'cosmic',  minMs: 120_000, name: 'Cosmic Architect', color: '#A5F3FC', sigil: '☉', shareLine: 'cracked 2 min' },
];

export function tierFor(durationMs) {
  let current = TIERS[0];
  for (const t of TIERS) {
    if (durationMs >= t.minMs) current = t;
  }
  return current;
}

/** "00:42 · 30-Second Club" */
export function tierLabel(durationMs) {
  return tierFor(durationMs).name;
}
