// Push-ups: rep-based challenge. Person roughly horizontal to the camera,
// elbow-bend cycle counts reps.
//
// "In pose" = torso close to a straight line (shoulder-hip-ankle collinear
// in screen-y) and NOT inverted. We sample the mean elbow angle across both
// arms; a rep is UP → DOWN → UP.

import { LANDMARK, avg, angleDeg, hasAll, visAvg } from './detectorUtils.js';
import { pickMastery } from './common.js';

const REQUIRED = [
  LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER,
  LANDMARK.LEFT_ELBOW, LANDMARK.RIGHT_ELBOW,
  LANDMARK.LEFT_WRIST, LANDMARK.RIGHT_WRIST,
  LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP,
];

const UP_THRESHOLD = 150;    // elbow angle >= this → fully extended
const DOWN_THRESHOLD = 100;  // elbow angle <= this → bottom of rep
const HORIZONTAL_DELTA = 0.22; // max abs(shoulder.y - hip.y) to call it "plank-ish"

function createPushupsDetector() {
  let phase = 'up'; // 'up' | 'down'
  return {
    update(landmarks) {
      if (!hasAll(landmarks, REQUIRED)) {
        return { active: false, repIncrement: 0, debug: { reason: 'missing-landmarks' } };
      }
      const shoulder = avg(landmarks[LANDMARK.LEFT_SHOULDER], landmarks[LANDMARK.RIGHT_SHOULDER]);
      const hip = avg(landmarks[LANDMARK.LEFT_HIP], landmarks[LANDMARK.RIGHT_HIP]);

      const horizontalish = Math.abs(shoulder.y - hip.y) < HORIZONTAL_DELTA;
      const notInverted = shoulder.y < 0.92 && hip.y < 0.92;
      const vis = visAvg(
        landmarks[LANDMARK.LEFT_SHOULDER], landmarks[LANDMARK.RIGHT_SHOULDER],
        landmarks[LANDMARK.LEFT_ELBOW], landmarks[LANDMARK.RIGHT_ELBOW],
        landmarks[LANDMARK.LEFT_WRIST], landmarks[LANDMARK.RIGHT_WRIST],
      );
      const active = horizontalish && notInverted && vis >= 0.55;
      if (!active) {
        phase = 'up';
        return { active: false, repIncrement: 0, debug: { reason: 'not-plank', horizontalish, vis } };
      }

      const leftAngle = angleDeg(
        landmarks[LANDMARK.LEFT_SHOULDER],
        landmarks[LANDMARK.LEFT_ELBOW],
        landmarks[LANDMARK.LEFT_WRIST],
      );
      const rightAngle = angleDeg(
        landmarks[LANDMARK.RIGHT_SHOULDER],
        landmarks[LANDMARK.RIGHT_ELBOW],
        landmarks[LANDMARK.RIGHT_WRIST],
      );
      const elbow = (leftAngle + rightAngle) / 2;

      let repIncrement = 0;
      if (phase === 'up' && elbow < DOWN_THRESHOLD) {
        phase = 'down';
      } else if (phase === 'down' && elbow > UP_THRESHOLD) {
        phase = 'up';
        repIncrement = 1;
      }
      return {
        active: true,
        repIncrement,
        debug: { phase, elbow: Math.round(elbow), vis },
      };
    },
    reset() { phase = 'up'; },
  };
}

const TIERS = [
  { at:   1, name: 'First Down',       tagline: 'one on the floor',          glyph: 'GiArrowDown',     tier: 'bronze' },
  { at:   5, name: 'Warm-Up Set',      tagline: 'shoulders saying hi',       glyph: 'GiMuscleUp',      tier: 'bronze' },
  { at:  10, name: 'Ten Pack',         tagline: 'clean reps only',           glyph: 'GiBiceps',        tier: 'bronze' },
  { at:  15, name: 'Fifteen Locked',   tagline: 'form police approve',       glyph: 'GiAnchor',        tier: 'bronze' },
  { at:  20, name: 'Twenty Town',      tagline: 'population: you',           glyph: 'GiStoneTower',    tier: 'silver' },
  { at:  25, name: 'PT Passed',        tagline: 'army grade effort',         glyph: 'GiPoliceBadge',   tier: 'silver' },
  { at:  30, name: 'Thirty Strong',    tagline: 'the burn is real',          glyph: 'GiFlame',         tier: 'silver' },
  { at:  40, name: 'Forty Flex',       tagline: 'pumped and proud',          glyph: 'GiStrong',        tier: 'silver' },
  { at:  50, name: 'Half-Century',     tagline: 'fifty clean reps',          glyph: 'GiMedal',         tier: 'gold' },
  { at:  60, name: 'Sixty Stacker',    tagline: 'pushing past the wall',     glyph: 'GiTrophyCup',     tier: 'gold' },
  { at:  75, name: 'Seventy-Five',     tagline: 'legendary set',             glyph: 'GiCrown',         tier: 'gold' },
  { at: 100, name: 'CENTURION',        tagline: 'one hundred in one go',     glyph: 'GiZeusSword',     tier: 'mythic' },
];

export const pushups = {
  id: 'pushups',
  label: 'Push-Ups',
  shortLabel: 'Pushes',
  verb: 'Push',
  scoreType: 'reps',
  scoreColumn: 'rep_count',
  leaderboardSort: 'best_reps',
  formatScore: (score) => `${score} rep${score === 1 ? '' : 's'}`,
  formatScoreShort: (score) => String(score),
  unitLabel: 'reps',
  icon: '⎯',
  accent: '#61d0c8',
  copy: {
    statusIdle: 'Get into plank position',
    statusReady: 'Start pushing',
    statusTracking: 'Recording · keep going',
    statusComplete: 'Nice set — submit it?',
    statusSubmitted: 'Submitted · go again',
    completeVerb: 'Pushed out',
    heroQuestion: 'How many push-ups can you stack in one go?',
    heroPitch: 'Clean chest-to-floor to lockout reps. Camera counts every good one — no half reps.',
    shareTemplate: (score, masteryName) =>
      `I just pushed out ${score} rep${score === 1 ? '' : 's'}${masteryName ? ` · ${masteryName}` : ''} — can you beat me?`,
    filenameTag: 'pushups',
  },
  samplePath: '/test-clips/pushups.mp4',
  createDetector: createPushupsDetector,
  tiers: TIERS,
  masteryFor: (score) => pickMastery(score, TIERS),
};
