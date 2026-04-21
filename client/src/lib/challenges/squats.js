// Squats: rep-based challenge. Upright person, knee-bend cycle counts reps.
//
// "In pose" = standing with hips above knees above ankles. One rep fires on
// the STAND → SQUAT → STAND cycle, using the mean knee angle.

import { LANDMARK, avg, angleDeg, hasAll, visAvg } from './detectorUtils.js';
import { pickMastery } from './common.js';

const REQUIRED = [
  LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP,
  LANDMARK.LEFT_KNEE, LANDMARK.RIGHT_KNEE,
  LANDMARK.LEFT_ANKLE, LANDMARK.RIGHT_ANKLE,
];

const STAND_THRESHOLD = 160;
const SQUAT_THRESHOLD = 110;

function createSquatsDetector() {
  let phase = 'stand'; // 'stand' | 'squat'
  return {
    update(landmarks) {
      if (!hasAll(landmarks, REQUIRED)) {
        return { active: false, repIncrement: 0, debug: { reason: 'missing-landmarks' } };
      }
      const hip = avg(landmarks[LANDMARK.LEFT_HIP], landmarks[LANDMARK.RIGHT_HIP]);
      const knee = avg(landmarks[LANDMARK.LEFT_KNEE], landmarks[LANDMARK.RIGHT_KNEE]);
      const ankle = avg(landmarks[LANDMARK.LEFT_ANKLE], landmarks[LANDMARK.RIGHT_ANKLE]);

      // Upright: hips above knees above ankles (lower y = higher on screen).
      const upright = hip.y < knee.y && knee.y < ankle.y + 0.02;
      const vis = visAvg(
        landmarks[LANDMARK.LEFT_HIP], landmarks[LANDMARK.RIGHT_HIP],
        landmarks[LANDMARK.LEFT_KNEE], landmarks[LANDMARK.RIGHT_KNEE],
        landmarks[LANDMARK.LEFT_ANKLE], landmarks[LANDMARK.RIGHT_ANKLE],
      );
      const active = upright && vis >= 0.55;
      if (!active) {
        phase = 'stand';
        return { active: false, repIncrement: 0, debug: { reason: 'not-upright', vis } };
      }

      const leftAngle = angleDeg(
        landmarks[LANDMARK.LEFT_HIP],
        landmarks[LANDMARK.LEFT_KNEE],
        landmarks[LANDMARK.LEFT_ANKLE],
      );
      const rightAngle = angleDeg(
        landmarks[LANDMARK.RIGHT_HIP],
        landmarks[LANDMARK.RIGHT_KNEE],
        landmarks[LANDMARK.RIGHT_ANKLE],
      );
      const kneeAngle = (leftAngle + rightAngle) / 2;

      let repIncrement = 0;
      if (phase === 'stand' && kneeAngle < SQUAT_THRESHOLD) {
        phase = 'squat';
      } else if (phase === 'squat' && kneeAngle > STAND_THRESHOLD) {
        phase = 'stand';
        repIncrement = 1;
      }
      return {
        active: true,
        repIncrement,
        debug: { phase, kneeAngle: Math.round(kneeAngle), vis },
      };
    },
    reset() { phase = 'stand'; },
  };
}

const TIERS = [
  { at:   1, name: 'First Drop',       tagline: 'knees broke in',            glyph: 'GiArrowDown',     tier: 'bronze' },
  { at:   5, name: 'Warmup Done',      tagline: 'quads waking up',           glyph: 'GiMuscleUp',      tier: 'bronze' },
  { at:  10, name: 'Ten Deep',         tagline: 'knees on board',            glyph: 'GiLeg',           tier: 'bronze' },
  { at:  15, name: 'Teen Squats',      tagline: 'fifteen and steady',        glyph: 'GiAnchor',        tier: 'bronze' },
  { at:  20, name: 'Twenty Down',      tagline: 'quads say hello',           glyph: 'GiFlame',         tier: 'silver' },
  { at:  30, name: 'Thirty Strong',    tagline: 'the burn is real',          glyph: 'GiStrong',        tier: 'silver' },
  { at:  40, name: 'Forty Full',       tagline: 'still going deep',          glyph: 'GiBiceps',        tier: 'silver' },
  { at:  50, name: 'Half-Hundred',     tagline: 'fifty full squats',         glyph: 'GiMedal',         tier: 'silver' },
  { at:  75, name: 'Seventy-Five',     tagline: 'impressive endurance',      glyph: 'GiTrophyCup',     tier: 'gold' },
  { at: 100, name: 'Centurion Legs',   tagline: 'one hundred reps!',         glyph: 'GiCrown',         tier: 'gold' },
  { at: 150, name: 'Quad Machine',     tagline: 'legs of an engine',         glyph: 'GiBeastEye',      tier: 'gold' },
  { at: 200, name: 'LEG DAY LEGEND',   tagline: 'they will remember',        glyph: 'GiZeusSword',     tier: 'mythic' },
];

export const squats = {
  id: 'squats',
  label: 'Squats',
  shortLabel: 'Squats',
  verb: 'Squat',
  scoreType: 'reps',
  scoreColumn: 'rep_count',
  leaderboardSort: 'best_reps',
  formatScore: (score) => `${score} rep${score === 1 ? '' : 's'}`,
  formatScoreShort: (score) => String(score),
  unitLabel: 'reps',
  icon: '⩗',
  accent: '#b4e769',
  copy: {
    statusIdle: 'Stand in frame',
    statusReady: 'Start squatting',
    statusTracking: 'Recording · keep going',
    statusComplete: 'Nice set — submit it?',
    statusSubmitted: 'Submitted · go again',
    completeVerb: 'Squatted',
    heroQuestion: 'How many squats can you crank out?',
    heroPitch: 'Hips below parallel, up to full lockout — camera only counts clean depth.',
    shareTemplate: (score, masteryName) =>
      `I just squatted ${score} rep${score === 1 ? '' : 's'}${masteryName ? ` · ${masteryName}` : ''} — can you beat me?`,
    filenameTag: 'squats',
  },
  samplePath: '/test-clips/squats.mp4',
  createDetector: createSquatsDetector,
  tiers: TIERS,
  masteryFor: (score) => pickMastery(score, TIERS),
};
