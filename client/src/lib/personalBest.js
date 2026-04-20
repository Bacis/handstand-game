// Persistent personal-best tracking via localStorage. Survives page reloads
// and browser restarts. Anonymous users get the same celebration loop as
// logged-in ones; submitted scores still hit the server independently.

const KEY = 'handstand:personalBest:v1';

export function getPersonalBest() {
  try {
    const v = localStorage.getItem(KEY);
    const n = v ? Number(v) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function setPersonalBest(durationMs) {
  try {
    localStorage.setItem(KEY, String(Math.floor(durationMs)));
  } catch {}
}

export function clearPersonalBest() {
  try { localStorage.removeItem(KEY); } catch {}
}
