// Every-3s mastery ranks. Tone: casual, funny, recognizable to the handstand
// community — even 3s is real, 10s is "pro", 30s is impressive, 60s is elite.
// Beyond the named ladder, the last rank repeats with Roman numerals.

export const TICK_SEC = 3;

export const MASTERIES = [
  { atSec:   3, name: 'Toes Up!',             tagline: 'liftoff achieved',           glyph: 'GiRocket',        tier: 'bronze' },
  { atSec:   6, name: 'Wobble Mode',          tagline: 'still finding it',           glyph: 'GiWeightScale',   tier: 'bronze' },
  { atSec:   9, name: 'Almost Pro',           tagline: 'one more second…',           glyph: 'GiStairsGoal',    tier: 'bronze' },
  { atSec:  12, name: 'Solid Hold',           tagline: 'past the pro line',          glyph: 'GiAnchor',        tier: 'bronze' },
  { atSec:  15, name: 'Banana-Free',          tagline: 'no over-arch in sight',      glyph: 'GiBanana',        tier: 'bronze' },
  { atSec:  18, name: 'Stacked & Locked',     tagline: 'shoulders over wrists',      glyph: 'GiStoneTower',    tier: 'bronze' },
  { atSec:  21, name: 'Show-Off Mode',        tagline: 'someone is filming',         glyph: 'GiVideoCamera',   tier: 'bronze' },
  { atSec:  24, name: 'Forearm Fire',         tagline: 'the burn arrives',           glyph: 'GiFlame',         tier: 'bronze' },
  { atSec:  27, name: 'Shoulder Toast',       tagline: 'they are cooked',            glyph: 'GiToaster',       tier: 'bronze' },
  { atSec:  30, name: 'Half-Minute Hero',     tagline: 'half a minute upside down',  glyph: 'GiMedal',         tier: 'bronze' },
  { atSec:  33, name: 'Yoga Class Goals',     tagline: 'instructor noticed',         glyph: 'GiMeditation',    tier: 'silver' },
  { atSec:  36, name: 'CrossFit Brag',        tagline: 'main feed material',         glyph: 'GiBiceps',        tier: 'silver' },
  { atSec:  39, name: 'Form Police Approved', tagline: 'hollow body lives',          glyph: 'GiPoliceBadge',   tier: 'silver' },
  { atSec:  42, name: 'Gym Legend',           tagline: 'word is spreading',          glyph: 'GiTrophyCup',     tier: 'silver' },
  { atSec:  45, name: 'Three-Quarter Beast',  tagline: '45 and counting',            glyph: 'GiBeastEye',      tier: 'silver' },
  { atSec:  48, name: 'Cirque-Worthy',        tagline: 'send the resume',            glyph: 'GiJuggler',       tier: 'silver' },
  { atSec:  51, name: 'Gymnast Grade',        tagline: 'national team energy',       glyph: 'GiAcrobatic',     tier: 'silver' },
  { atSec:  54, name: 'Sub-60 Slayer',        tagline: 'minute is right there',      glyph: 'GiTargetShot',    tier: 'silver' },
  { atSec:  57, name: 'Almost There…',        tagline: 'three more seconds',         glyph: 'GiFinishLine',    tier: 'silver' },
  { atSec:  60, name: 'MINUTE MAKER',         tagline: 'sixty seconds inverted',     glyph: 'GiCrown',         tier: 'silver' },
  { atSec:  63, name: 'Time Bender',          tagline: 'past the minute',            glyph: 'GiTimeTrap',      tier: 'gold'   },
  { atSec:  66, name: 'Inverted Monk',        tagline: 'tranquility achieved',       glyph: 'GiMonkFace',      tier: 'gold'   },
  { atSec:  69, name: 'Nice.',                tagline: 'sixty-nine, dude',           glyph: 'GiSunglasses',    tier: 'gold'   },
  { atSec:  72, name: 'Calluses Earned',      tagline: 'palms remember',             glyph: 'GiFist',          tier: 'gold'   },
  { atSec:  75, name: 'Forearm Statue',       tagline: 'no movement detected',       glyph: 'GiStoneBlock',    tier: 'gold'   },
  { atSec:  78, name: 'Floor Whisperer',      tagline: 'in conversation with gravity', glyph: 'GiSoundWaves',  tier: 'gold'   },
  { atSec:  81, name: 'Sweat Architect',      tagline: 'building puddles',           glyph: 'GiWaterDrop',     tier: 'gold'   },
  { atSec:  84, name: 'Pure Hollow Body',     tagline: 'textbook alignment',         glyph: 'GiStraightPipe',  tier: 'gold'   },
  { atSec:  87, name: 'Spotter-Free Wonder',  tagline: 'no wall, no help',           glyph: 'GiInvisible',     tier: 'gold'   },
  { atSec:  90, name: 'Minute and a Half',    tagline: 'world rare territory',       glyph: 'GiHourglass',     tier: 'gold'   },
  { atSec:  93, name: 'Press-Up Royalty',     tagline: 'crown earned',               glyph: 'GiCrownedHeart',  tier: 'mythic' },
  { atSec:  96, name: 'Hand Hermit',          tagline: 'lives upside down now',      glyph: 'GiCrab',          tier: 'mythic' },
  { atSec:  99, name: 'Verging Legend',       tagline: 'almost mythical',            glyph: 'GiDragonHead',    tier: 'mythic' },
  { atSec: 102, name: 'Chalk Demon',          tagline: 'powdered and possessed',     glyph: 'GiDevilMask',     tier: 'mythic' },
  { atSec: 105, name: 'Pike Master',          tagline: 'legs locked, soul calm',     glyph: 'GiTrident',       tier: 'mythic' },
  { atSec: 108, name: 'Floor Forsaker',       tagline: 'rejected ground entirely',   glyph: 'GiAngelWings',    tier: 'mythic' },
  { atSec: 111, name: 'Time Inverter',        tagline: 'clocks confused',            glyph: 'GiSandsOfTime',   tier: 'mythic' },
  { atSec: 114, name: 'Sky Roots',            tagline: 'planted in the air',         glyph: 'GiTreeBranch',    tier: 'mythic' },
  { atSec: 117, name: 'Almost Two',           tagline: 'three more seconds, hero',   glyph: 'GiCrosshair',     tier: 'mythic' },
  { atSec: 120, name: 'TWO-MIN TITAN',        tagline: 'elite of the elite',         glyph: 'GiZeusSword',     tier: 'mythic' },
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
