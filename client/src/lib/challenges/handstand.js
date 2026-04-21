// Handstand challenge: duration-based. Pose classifier is the same inverted-
// body geometry that HandstandDetector.js has always used, now packaged as
// a challenge strategy.

import { formatTime } from '../../hooks/useTimer.js';
import { LANDMARK, avg, visAvg } from './detectorUtils.js';
import { pickMastery } from './common.js';

const THRESHOLDS = {
  WRISTS_BELOW: 0.55,
  ANKLES_ABOVE: 0.45,
  WRIST_SPREAD_MAX: 0.40,
  MIN_VISIBILITY: 0.6,
};

function classifyHandstand(landmarks) {
  if (!landmarks || landmarks.length < 33) {
    return { active: false, reason: 'no-pose' };
  }
  const lw = landmarks[LANDMARK.LEFT_WRIST];
  const rw = landmarks[LANDMARK.RIGHT_WRIST];
  const lh = landmarks[LANDMARK.LEFT_HIP];
  const rh = landmarks[LANDMARK.RIGHT_HIP];
  const la = landmarks[LANDMARK.LEFT_ANKLE];
  const ra = landmarks[LANDMARK.RIGHT_ANKLE];
  const nose = landmarks[LANDMARK.NOSE];

  const wrists = avg(lw, rw);
  const hips = avg(lh, rh);
  const ankles = avg(la, ra);
  const visibility = visAvg(lw, rw, lh, rh, la, ra, nose);
  const wristSpread = Math.abs(lw.x - rw.x);

  const checks = {
    visibility: { pass: visibility >= THRESHOLDS.MIN_VISIBILITY, value: visibility, threshold: THRESHOLDS.MIN_VISIBILITY, op: '>=' },
    wristsDown: { pass: wrists.y > THRESHOLDS.WRISTS_BELOW, value: wrists.y, threshold: THRESHOLDS.WRISTS_BELOW, op: '>' },
    anklesUp:   { pass: ankles.y < THRESHOLDS.ANKLES_ABOVE, value: ankles.y, threshold: THRESHOLDS.ANKLES_ABOVE, op: '<' },
    hipsAboveWrists: { pass: hips.y < wrists.y, value: hips.y, threshold: wrists.y, op: '<' },
    headBelowHips:   { pass: nose.y > hips.y, value: nose.y, threshold: hips.y, op: '>' },
    handsClose:      { pass: wristSpread <= THRESHOLDS.WRIST_SPREAD_MAX, value: wristSpread, threshold: THRESHOLDS.WRIST_SPREAD_MAX, op: '<=' },
  };
  const failed = Object.entries(checks).find(([, c]) => !c.pass);
  if (failed) return { active: false, reason: failed[0], midpoint: hips, checks };
  return { active: true, midpoint: hips, checks };
}

function createHandstandDetector() {
  return {
    update(landmarks) {
      const c = classifyHandstand(landmarks);
      return {
        active: c.active,
        repIncrement: 0,
        debug: { reason: c.reason, checks: c.checks, midpoint: c.midpoint, isHandstand: c.active },
      };
    },
    reset() {},
  };
}

// Tiers migrated verbatim from the legacy masteries.js — `atSec` becomes `at`
// measured in ms so the generic mastery lookup can handle duration + reps the
// same way.
const MS = 1000;
const TIERS = [
  { at:   3 * MS, name: 'Toes Up!',             tagline: 'liftoff achieved',             glyph: 'GiRocket',        tier: 'bronze' },
  { at:   6 * MS, name: 'Wobble Mode',          tagline: 'still finding it',             glyph: 'GiWeightScale',   tier: 'bronze' },
  { at:   9 * MS, name: 'Almost Pro',           tagline: 'one more second…',             glyph: 'GiStairsGoal',    tier: 'bronze' },
  { at:  12 * MS, name: 'Solid Hold',           tagline: 'past the pro line',            glyph: 'GiAnchor',        tier: 'bronze' },
  { at:  15 * MS, name: 'Banana-Free',          tagline: 'no over-arch in sight',        glyph: 'GiBanana',        tier: 'bronze' },
  { at:  18 * MS, name: 'Stacked & Locked',     tagline: 'shoulders over wrists',        glyph: 'GiStoneTower',    tier: 'bronze' },
  { at:  21 * MS, name: 'Show-Off Mode',        tagline: 'someone is filming',           glyph: 'GiVideoCamera',   tier: 'bronze' },
  { at:  24 * MS, name: 'Forearm Fire',         tagline: 'the burn arrives',             glyph: 'GiFlame',         tier: 'bronze' },
  { at:  27 * MS, name: 'Shoulder Toast',       tagline: 'they are cooked',              glyph: 'GiToaster',       tier: 'bronze' },
  { at:  30 * MS, name: 'Half-Minute Hero',     tagline: 'half a minute upside down',    glyph: 'GiMedal',         tier: 'bronze' },
  { at:  33 * MS, name: 'Yoga Class Goals',     tagline: 'instructor noticed',           glyph: 'GiMeditation',    tier: 'silver' },
  { at:  36 * MS, name: 'CrossFit Brag',        tagline: 'main feed material',           glyph: 'GiBiceps',        tier: 'silver' },
  { at:  39 * MS, name: 'Form Police Approved', tagline: 'hollow body lives',            glyph: 'GiPoliceBadge',   tier: 'silver' },
  { at:  42 * MS, name: 'Gym Legend',           tagline: 'word is spreading',            glyph: 'GiTrophyCup',     tier: 'silver' },
  { at:  45 * MS, name: 'Three-Quarter Beast',  tagline: '45 and counting',              glyph: 'GiBeastEye',      tier: 'silver' },
  { at:  48 * MS, name: 'Cirque-Worthy',        tagline: 'send the resume',              glyph: 'GiJuggler',       tier: 'silver' },
  { at:  51 * MS, name: 'Gymnast Grade',        tagline: 'national team energy',         glyph: 'GiAcrobatic',     tier: 'silver' },
  { at:  54 * MS, name: 'Sub-60 Slayer',        tagline: 'minute is right there',        glyph: 'GiTargetShot',    tier: 'silver' },
  { at:  57 * MS, name: 'Almost There…',        tagline: 'three more seconds',           glyph: 'GiFinishLine',    tier: 'silver' },
  { at:  60 * MS, name: 'MINUTE MAKER',         tagline: 'sixty seconds inverted',       glyph: 'GiCrown',         tier: 'silver' },
  { at:  63 * MS, name: 'Time Bender',          tagline: 'past the minute',              glyph: 'GiTimeTrap',      tier: 'gold'   },
  { at:  66 * MS, name: 'Inverted Monk',        tagline: 'tranquility achieved',         glyph: 'GiMonkFace',      tier: 'gold'   },
  { at:  69 * MS, name: 'Nice.',                tagline: 'sixty-nine, dude',             glyph: 'GiSunglasses',    tier: 'gold'   },
  { at:  72 * MS, name: 'Calluses Earned',      tagline: 'palms remember',               glyph: 'GiFist',          tier: 'gold'   },
  { at:  75 * MS, name: 'Forearm Statue',       tagline: 'no movement detected',         glyph: 'GiStoneBlock',    tier: 'gold'   },
  { at:  78 * MS, name: 'Floor Whisperer',      tagline: 'in conversation with gravity', glyph: 'GiSoundWaves',    tier: 'gold'   },
  { at:  81 * MS, name: 'Sweat Architect',      tagline: 'building puddles',             glyph: 'GiWaterDrop',     tier: 'gold'   },
  { at:  84 * MS, name: 'Pure Hollow Body',     tagline: 'textbook alignment',           glyph: 'GiStraightPipe',  tier: 'gold'   },
  { at:  87 * MS, name: 'Spotter-Free Wonder',  tagline: 'no wall, no help',             glyph: 'GiInvisible',     tier: 'gold'   },
  { at:  90 * MS, name: 'Minute and a Half',    tagline: 'world rare territory',         glyph: 'GiHourglass',     tier: 'gold'   },
  { at:  93 * MS, name: 'Press-Up Royalty',     tagline: 'crown earned',                 glyph: 'GiCrownedHeart',  tier: 'mythic' },
  { at:  96 * MS, name: 'Hand Hermit',          tagline: 'lives upside down now',        glyph: 'GiCrab',          tier: 'mythic' },
  { at:  99 * MS, name: 'Verging Legend',       tagline: 'almost mythical',              glyph: 'GiDragonHead',    tier: 'mythic' },
  { at: 102 * MS, name: 'Chalk Demon',          tagline: 'powdered and possessed',       glyph: 'GiDevilMask',     tier: 'mythic' },
  { at: 105 * MS, name: 'Pike Master',          tagline: 'legs locked, soul calm',       glyph: 'GiTrident',       tier: 'mythic' },
  { at: 108 * MS, name: 'Floor Forsaker',       tagline: 'rejected ground entirely',     glyph: 'GiAngelWings',    tier: 'mythic' },
  { at: 111 * MS, name: 'Time Inverter',        tagline: 'clocks confused',              glyph: 'GiSandsOfTime',   tier: 'mythic' },
  { at: 114 * MS, name: 'Sky Roots',            tagline: 'planted in the air',           glyph: 'GiTreeBranch',    tier: 'mythic' },
  { at: 117 * MS, name: 'Almost Two',           tagline: 'three more seconds, hero',     glyph: 'GiCrosshair',     tier: 'mythic' },
  { at: 120 * MS, name: 'TWO-MIN TITAN',        tagline: 'elite of the elite',           glyph: 'GiZeusSword',     tier: 'mythic' },
];

export const handstand = {
  id: 'handstand',
  label: 'Handstand',
  shortLabel: 'Hold',
  verb: 'Hold',
  scoreType: 'duration',
  scoreColumn: 'duration_ms',
  leaderboardSort: 'best_time_ms',
  formatScore: (score) => formatTime(score),
  formatScoreShort: (score) => formatTime(score),
  unitLabel: '',
  icon: '▲',
  accent: '#ff4d2e',
  copy: {
    statusIdle: 'Position yourself in frame',
    statusReady: 'Get into your handstand',
    statusTracking: 'Recording · hold it',
    statusComplete: 'Nice hold — submit it?',
    statusSubmitted: 'Submitted · go again',
    completeVerb: 'Held',
    heroQuestion: 'How long can you stand on your hands?',
    heroPitch: 'Your webcam watches your pose. Kick up, hold, and the clock counts.',
    shareTemplate: (score, masteryName) =>
      `I held a handstand for ${formatTime(score)}${masteryName ? ` · ${masteryName}` : ''} — can you beat me?`,
    filenameTag: 'handstand',
  },
  samplePath: '/test-clips/handstand.mp4',
  createDetector: createHandstandDetector,
  tiers: TIERS,
  masteryFor: (score) => pickMastery(score, TIERS),
};
