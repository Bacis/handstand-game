// Persistent client-side achievement store. Same localStorage safety pattern
// as personalBest.js — silent reset on parse failure, wrap I/O in try/catch.

import { ACHIEVEMENTS } from './achievements.js';

const KEY = 'handstand:achievements:v1';

const EMPTY = () => ({
  unlocked: {},       // { [key]: iso string }
  counters: {
    total_attempts: 0,
    total_hold_ms: 0,
    day_keys: [],      // YYYY-MM-DD local strings, de-duped
    shared_count: 0,
    shorts_since_last_pb: 0,
  },
});

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY();
    const parsed = JSON.parse(raw);
    // Shape-check: if anything critical is missing, reset.
    if (!parsed || typeof parsed !== 'object' || !parsed.unlocked || !parsed.counters) {
      return EMPTY();
    }
    // Merge any missing counter keys so additions don't break old installs.
    return {
      unlocked: parsed.unlocked,
      counters: { ...EMPTY().counters, ...parsed.counters },
    };
  } catch {
    return EMPTY();
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getState() {
  return read();
}

export function isUnlocked(key) {
  return Boolean(read().unlocked[key]);
}

export function listUnlocked() {
  const state = read();
  return Object.entries(state.unlocked).map(([key, at]) => ({ key, unlocked_at: at }));
}

function runChecks(state, ctx) {
  const newlyUnlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (state.unlocked[a.key]) continue;
    // Event-triggered achievements fire only from recordEvent (skip on attempt).
    if (a.event && !ctx.eventKeys?.has(a.event)) continue;
    try {
      if (a.check(ctx)) {
        state.unlocked[a.key] = new Date().toISOString();
        newlyUnlocked.push(a.key);
      }
    } catch {
      // Bad check function — ignore silently.
    }
  }
  return newlyUnlocked;
}

/** Call on attempt complete. Returns array of newly-unlocked keys. */
export function recordAttempt({ durationMs, prevPb = 0, isNewPb = false }) {
  const state = read();
  const now = new Date();
  state.counters.total_attempts += 1;
  state.counters.total_hold_ms += Math.max(0, Math.floor(durationMs || 0));
  const k = dayKey(now);
  if (!state.counters.day_keys.includes(k)) state.counters.day_keys.push(k);
  if (isNewPb) {
    state.counters.shorts_since_last_pb = 0;
  } else if (prevPb > 0 && durationMs < prevPb) {
    state.counters.shorts_since_last_pb += 1;
  }
  const ctx = {
    durationMs,
    prevPb,
    isNewPb,
    now,
    counters: state.counters,
    eventKeys: new Set(),
  };
  const newly = runChecks(state, ctx);
  write(state);
  return newly;
}

/** Call on non-attempt events (e.g. 'shared'). Returns newly-unlocked keys. */
export function recordEvent(name) {
  const state = read();
  if (name === 'shared') state.counters.shared_count += 1;
  const ctx = {
    durationMs: 0,
    prevPb: 0,
    isNewPb: false,
    now: new Date(),
    counters: state.counters,
    eventKeys: new Set([name]),
  };
  const newly = runChecks(state, ctx);
  write(state);
  return newly;
}

/** Dev/testing escape hatch. */
export function clearAll() {
  try { localStorage.removeItem(KEY); } catch {}
}
