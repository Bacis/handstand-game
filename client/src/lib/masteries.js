// Every-3s mastery ranks. Tone: casual, funny, recognizable to the handstand
// community — even 3s is real, 10s is "pro", 30s is impressive, 60s is elite.
// Beyond the named ladder, the last rank repeats with Roman numerals.

export const TICK_SEC = 3;

export const MASTERIES = [
  { atSec:   3, name: 'Toes Up!',           tagline: 'liftoff achieved' },
  { atSec:   6, name: 'Wobble Mode',        tagline: 'still finding it' },
  { atSec:   9, name: 'Almost Pro',         tagline: 'one more second…' },
  { atSec:  12, name: 'Solid Hold',         tagline: 'past the pro line' },
  { atSec:  15, name: 'Banana-Free',        tagline: 'no over-arch in sight' },
  { atSec:  18, name: 'Stacked & Locked',   tagline: 'shoulders over wrists' },
  { atSec:  21, name: 'Show-Off Mode',      tagline: 'someone is filming' },
  { atSec:  24, name: 'Forearm Fire',       tagline: 'the burn arrives' },
  { atSec:  27, name: 'Shoulder Toast',     tagline: 'they are cooked' },
  { atSec:  30, name: 'Half-Minute Hero',   tagline: 'half a minute upside down' },
  { atSec:  33, name: 'Yoga Class Goals',   tagline: 'instructor noticed' },
  { atSec:  36, name: 'CrossFit Brag',      tagline: 'main feed material' },
  { atSec:  39, name: 'Form Police Approved', tagline: 'hollow body lives' },
  { atSec:  42, name: 'Gym Legend',         tagline: 'word is spreading' },
  { atSec:  45, name: 'Three-Quarter Beast', tagline: '45 and counting' },
  { atSec:  48, name: 'Cirque-Worthy',      tagline: 'send the resume' },
  { atSec:  51, name: 'Gymnast Grade',      tagline: 'national team energy' },
  { atSec:  54, name: 'Sub-60 Slayer',      tagline: 'minute is right there' },
  { atSec:  57, name: 'Almost There…',      tagline: 'three more seconds' },
  { atSec:  60, name: 'MINUTE MAKER',       tagline: 'sixty seconds inverted' },
  { atSec:  63, name: 'Time Bender',        tagline: 'past the minute' },
  { atSec:  66, name: 'Inverted Monk',      tagline: 'tranquility achieved' },
  { atSec:  69, name: 'Nice.',              tagline: 'sixty-nine, dude' },
  { atSec:  72, name: 'Calluses Earned',    tagline: 'palms remember' },
  { atSec:  75, name: 'Forearm Statue',     tagline: 'no movement detected' },
  { atSec:  78, name: 'Floor Whisperer',    tagline: 'in conversation with gravity' },
  { atSec:  81, name: 'Sweat Architect',    tagline: 'building puddles' },
  { atSec:  84, name: 'Pure Hollow Body',   tagline: 'textbook alignment' },
  { atSec:  87, name: 'Spotter-Free Wonder', tagline: 'no wall, no help' },
  { atSec:  90, name: 'Minute and a Half',  tagline: 'world rare territory' },
  { atSec:  93, name: 'Press-Up Royalty',   tagline: 'crown earned' },
  { atSec:  96, name: 'Hand Hermit',        tagline: 'lives upside down now' },
  { atSec:  99, name: 'Verging Legend',     tagline: 'almost mythical' },
  { atSec: 102, name: 'Chalk Demon',        tagline: 'powdered and possessed' },
  { atSec: 105, name: 'Pike Master',        tagline: 'legs locked, soul calm' },
  { atSec: 108, name: 'Floor Forsaker',     tagline: 'rejected ground entirely' },
  { atSec: 111, name: 'Time Inverter',      tagline: 'clocks confused' },
  { atSec: 114, name: 'Sky Roots',          tagline: 'planted in the air' },
  { atSec: 117, name: 'Almost Two',         tagline: 'three more seconds, hero' },
  { atSec: 120, name: 'TWO-MIN TITAN',      tagline: 'elite of the elite' },
];

const ROMAN = ['', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
function roman(n) {
  return ROMAN[Math.min(n, ROMAN.length - 1)];
}

/** Returns the mastery just unlocked at `elapsedMs`, or null if under 3s. */
export function masteryFor(elapsedMs) {
  const ticks = Math.floor(elapsedMs / (TICK_SEC * 1000));
  if (ticks <= 0) return null;
  if (ticks <= MASTERIES.length) return MASTERIES[ticks - 1];
  // Beyond named ladder: keep the final mastery + Roman numeral suffix.
  const overflow = ticks - MASTERIES.length + 1;
  const last = MASTERIES[MASTERIES.length - 1];
  return { ...last, name: `${last.name} ${roman(overflow)}` };
}
