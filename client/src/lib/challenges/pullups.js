// Pull-ups: rep-based challenge.
//
// "In pose" = wrists above the shoulders and the person is hanging (roughly
// vertical torso). One rep fires when the user pulls high enough that the
// shoulders close the gap to the wrists, then drops back into an extended
// hang. The gap uses the distance shoulder.y − wrist.y, which in MediaPipe
// normalized coords shrinks as the shoulders rise (y=0 is top).

import { LANDMARK, avg, hasAll, visAvg } from './detectorUtils.js';
import { pickMastery } from './common.js';

const REQUIRED = [
  LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER,
  LANDMARK.LEFT_WRIST, LANDMARK.RIGHT_WRIST,
];

// These thresholds are a best-first pass — expect to tune once we have real
// clips. Keep them here so tuning is a single-file change.
const TOP_GAP_EXIT = 0.06;    // shoulder.y - wrist.y < this → entered TOP
const BOTTOM_GAP_ENTER = 0.22; // shoulder.y - wrist.y > this → entered HANG

function createPullupsDetector() {
  let phase = 'hang'; // 'hang' | 'top'
  let lastActiveFrame = 0;
  return {
    update(landmarks) {
      if (!hasAll(landmarks, REQUIRED)) {
        return { active: false, repIncrement: 0, debug: { reason: 'missing-landmarks' } };
      }
      const shoulder = avg(landmarks[LANDMARK.LEFT_SHOULDER], landmarks[LANDMARK.RIGHT_SHOULDER]);
      const wrist = avg(landmarks[LANDMARK.LEFT_WRIST], landmarks[LANDMARK.RIGHT_WRIST]);
      const wristsOverhead = wrist.y < shoulder.y;
      const vis = visAvg(
        landmarks[LANDMARK.LEFT_SHOULDER], landmarks[LANDMARK.RIGHT_SHOULDER],
        landmarks[LANDMARK.LEFT_WRIST], landmarks[LANDMARK.RIGHT_WRIST],
      );

      const active = wristsOverhead && vis >= 0.55;
      if (!active) {
        phase = 'hang';
        return { active: false, repIncrement: 0, debug: { reason: 'not-hanging', vis } };
      }
      lastActiveFrame += 1;

      const gap = shoulder.y - wrist.y;
      let repIncrement = 0;
      if (phase === 'hang' && gap < TOP_GAP_EXIT) {
        phase = 'top';
      } else if (phase === 'top' && gap > BOTTOM_GAP_ENTER) {
        phase = 'hang';
        repIncrement = 1;
      }
      return {
        active: true,
        repIncrement,
        debug: { phase, gap: Number(gap.toFixed(3)), vis },
      };
    },
    reset() { phase = 'hang'; lastActiveFrame = 0; },
  };
}

const TIERS = [
  { at:  1, name: 'First Pull',        tagline: 'one rep on the board',   glyph: 'GiMuscleUp',     tier: 'bronze' },
  { at:  3, name: 'Warming Up',        tagline: 'grip starting to talk',  glyph: 'GiBiceps',       tier: 'bronze' },
  { at:  5, name: 'Five Alive',        tagline: 'five in the bag',        glyph: 'GiHand',         tier: 'bronze' },
  { at:  8, name: 'Forearm Fire',      tagline: 'grip under pressure',    glyph: 'GiFlame',        tier: 'bronze' },
  { at: 10, name: 'Double Digits',     tagline: 'ten and counting',       glyph: 'GiMedal',        tier: 'silver' },
  { at: 12, name: 'Bar Regular',       tagline: 'this is your bar now',   glyph: 'GiAnchor',       tier: 'silver' },
  { at: 15, name: 'Fifteen Up',        tagline: 'the grip is holding',    glyph: 'GiStrong',       tier: 'silver' },
  { at: 18, name: 'Army Grade',        tagline: 'PT test passed',         glyph: 'GiPoliceBadge',  tier: 'silver' },
  { at: 20, name: 'Twenty Club',       tagline: 'welcome in',             glyph: 'GiTrophyCup',    tier: 'silver' },
  { at: 25, name: 'Bar Beast',         tagline: 'the bar fears you',      glyph: 'GiBeastEye',     tier: 'gold' },
  { at: 30, name: 'Three-Pack',        tagline: 'thirty deep',            glyph: 'GiCrown',        tier: 'gold' },
  { at: 35, name: 'Grip Monster',      tagline: 'calluses earned',        glyph: 'GiFist',         tier: 'gold' },
  { at: 40, name: 'Forty Flex',        tagline: 'biceps on fire',         glyph: 'GiBiceps',       tier: 'gold' },
  { at: 50, name: 'Half-Hundred',      tagline: 'fifty reps of pure will',glyph: 'GiZeusSword',    tier: 'mythic' },
];

export const pullups = {
  id: 'pullups',
  label: 'Pull-Ups',
  shortLabel: 'Pulls',
  verb: 'Pull',
  scoreType: 'reps',
  scoreColumn: 'rep_count',
  leaderboardSort: 'best_reps',
  formatScore: (score) => `${score} rep${score === 1 ? '' : 's'}`,
  formatScoreShort: (score) => String(score),
  unitLabel: 'reps',
  icon: '⎯⎯',
  accent: '#ffb454',
  copy: {
    statusIdle: 'Hang from the bar',
    statusReady: 'Start pulling',
    statusTracking: 'Recording · keep going',
    statusComplete: 'Nice set — submit it?',
    statusSubmitted: 'Submitted · go again',
    completeVerb: 'Banged out',
    heroQuestion: 'How many pull-ups can you squeeze out?',
    heroPitch: 'Camera counts every rep. Chin-to-bar clean reps only — full hang resets the counter.',
    shareTemplate: (score, masteryName) =>
      `I just hit ${score} pull-up${score === 1 ? '' : 's'}${masteryName ? ` · ${masteryName}` : ''} — can you beat me?`,
    filenameTag: 'pullups',
  },
  samplePath: '/test-clips/pullups.mp4',
  createDetector: createPullupsDetector,
  tiers: TIERS,
  masteryFor: (score) => pickMastery(score, TIERS),
};
