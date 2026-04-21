// Registry of challenge strategies. Order here drives picker/leaderboard tab
// order — handstand first because it's the flagship, then body-weight staples.

import { handstand } from './handstand.js';
import { pullups } from './pullups.js';
import { pushups } from './pushups.js';
import { squats } from './squats.js';

export const CHALLENGES = [handstand, pullups, pushups, squats];
export const CHALLENGE_IDS = CHALLENGES.map((c) => c.id);
export const DEFAULT_CHALLENGE_ID = 'handstand';

const INDEX = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));

export function getChallenge(id) {
  return INDEX[id] ?? null;
}

/** Returns the challenge for an id, falling back to handstand for unknown ids. */
export function challengeOrDefault(id) {
  return INDEX[id] ?? INDEX[DEFAULT_CHALLENGE_ID];
}

export function isValidChallengeId(id) {
  return Object.hasOwn(INDEX, id);
}
