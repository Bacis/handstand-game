// Persistent personal-best tracking via localStorage — namespaced per
// challenge so handstand time, pull-up reps, push-up reps, and squat reps
// are each tracked independently. Legacy (pre-multi-challenge) key is
// migrated once on first read so users don't lose their old PB.

const LEGACY_KEY = 'handstand:personalBest:v1';
const keyFor = (challengeId) => `playstando:${challengeId}:personalBest:v1`;

let migrated = false;
function migrateLegacyOnce() {
  if (migrated) return;
  migrated = true;
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    const handstandKey = keyFor('handstand');
    if (legacy && !localStorage.getItem(handstandKey)) {
      localStorage.setItem(handstandKey, legacy);
    }
  } catch {}
}

export function getPersonalBest(challengeId = 'handstand') {
  migrateLegacyOnce();
  try {
    const v = localStorage.getItem(keyFor(challengeId));
    const n = v ? Number(v) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function setPersonalBest(score, challengeId = 'handstand') {
  try {
    localStorage.setItem(keyFor(challengeId), String(Math.floor(score)));
  } catch {}
}

export function clearPersonalBest(challengeId = 'handstand') {
  try { localStorage.removeItem(keyFor(challengeId)); } catch {}
}
