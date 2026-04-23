// Cinematic synthesized sound effects — no asset bundle.
//
// Architecture:
//
//   source nodes ─┐
//                 ├─→ dryBus ─┬─→ lp ─→ master ─→ destination
//                 │           └─→ wetSend ─→ convolver ─→ wetReturn ─→ lp
//
// All voices feed `dryBus`. A parallel reverb send produces a 2.5s tail with
// no per-voice config, so every sound naturally sits in the same space.
//
// Voices:
//   - bell:     multi-partial sine cluster with inharmonic ratios (crystal/glock)
//   - subKick:  sine pitch-drop (60–35Hz) for low-end punch
//   - riser:    high-pass-swept white noise that rises in cutoff + amplitude
//   - chip:     square/triangle pulse (legacy chiptune note for arpeggios)
//   - noiseHit: short filtered white-noise burst (impacts / percussion)

let ctx = null;
let masterGain = null;
let dryBus = null;
let unlocked = false;

const N = {
  C2: 65.41, E2: 82.41, G2: 98.00,
  C3: 130.81, E3: 164.81, G3: 196.00,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50, D6: 1174.66, E6: 1318.51, F6: 1396.91, G6: 1567.98, A6: 1760.00, B6: 1975.53,
  C7: 2093.00, D7: 2349.32, E7: 2637.02, G7: 3135.96, C8: 4186.01,
};

function makeReverbImpulse(c, duration = 2.5, decay = 3) {
  const len = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function getCtx() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();

  masterGain = ctx.createGain();
  masterGain.gain.value = 0.55;

  // Subtle low-pass smooths brittle highs without dulling the mix.
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 12000;
  lp.Q.value = 0.5;

  // Dry bus — every voice connects here.
  dryBus = ctx.createGain();
  dryBus.gain.value = 1;
  dryBus.connect(lp);

  // Parallel reverb send.
  const reverb = ctx.createConvolver();
  reverb.buffer = makeReverbImpulse(ctx, 2.5, 3);
  const wetSend = ctx.createGain();
  wetSend.gain.value = 0.32;
  const wetReturn = ctx.createGain();
  wetReturn.gain.value = 0.7;
  dryBus.connect(wetSend).connect(reverb).connect(wetReturn).connect(lp);

  lp.connect(masterGain).connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  if (unlocked) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  unlocked = true;
}

// ---------- voices ----------

function bell({ freq, start = 0, duration = 1.4, gain = 0.22 }) {
  const c = getCtx();
  if (!c) return;
  // Inharmonic ratios produce a metallic / bell timbre. Higher partials decay
  // faster than the fundamental, so the attack is bright and the tail is pure.
  const partials = [
    { mul: 1.000, gain: 1.00, decay: duration * 1.0 },
    { mul: 2.000, gain: 0.40, decay: duration * 0.50 },
    { mul: 2.756, gain: 0.55, decay: duration * 0.40 },
    { mul: 5.404, gain: 0.20, decay: duration * 0.18 },
    { mul: 8.933, gain: 0.10, decay: duration * 0.10 },
  ];
  const t0 = c.currentTime + start;
  for (const p of partials) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * p.mul;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain * p.gain, t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + p.decay);
    osc.connect(g).connect(dryBus);
    osc.start(t0);
    osc.stop(t0 + p.decay + 0.05);
  }
}

function subKick({ start = 0, freqStart = 90, freqEnd = 35, duration = 0.4, gain = 0.45 }) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  const t0 = c.currentTime + start;
  osc.frequency.setValueAtTime(freqStart, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + duration);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(dryBus);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function riser({ start = 0, duration = 0.8, gain = 0.18, fromHz = 200, toHz = 8000 }) {
  const c = getCtx();
  if (!c) return;
  const len = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'highpass';
  filt.Q.value = 0.7;
  const t0 = c.currentTime + start;
  filt.frequency.setValueAtTime(fromHz, t0);
  filt.frequency.exponentialRampToValueAtTime(toHz, t0 + duration);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + duration * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filt).connect(g).connect(dryBus);
  src.start(t0);
  src.stop(t0 + duration + 0.05);
}

function chip({ freq, start = 0, duration = 0.4, gain = 0.2, type = 'square' }) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
  g.gain.setValueAtTime(gain, t0 + Math.max(0.01, duration - 0.02));
  g.gain.linearRampToValueAtTime(0, t0 + duration);
  osc.connect(g).connect(dryBus);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noiseHit({ start = 0, duration = 0.08, gain = 0.18, hp = 1500 }) {
  const c = getCtx();
  if (!c) return;
  const len = Math.max(64, Math.floor(c.sampleRate * duration));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = c.createGain();
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(f).connect(g).connect(dryBus);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

// ---------- public API ----------

// Tick (every 3s): crystal bell. Pitch climbs the ladder so a long run sounds
// like it's building. Tiny sub-thump underneath gives physicality.
const TICK_LADDER = [N.A5, N.B5, N.D6, N.E6, N.G6, N.A6, N.B6, N.D7, N.E7, N.G7];
let tickStep = 0;

export function playTickSound() {
  unlockAudio();
  const f = TICK_LADDER[Math.min(tickStep, TICK_LADDER.length - 1)];
  bell({ freq: f, start: 0, duration: 1.1, gain: 0.20 });
  bell({ freq: f * 4, start: 0, duration: 0.35, gain: 0.06 });   // sparkle
  subKick({ start: 0, freqStart: 90, freqEnd: 60, duration: 0.10, gain: 0.10 });
  tickStep += 1;
}

export function tickReset() { tickStep = 0; }

// Opponent-joined ping — friendly two-note ascending chime, Hangouts-style.
// Short and unobtrusive so it doesn't compete with the countdown tone.
export function playOpponentJoinedSound() {
  unlockAudio();
  // If audio hasn't actually unlocked yet (no user gesture on this page
  // yet — e.g. the guest clicked the invite link in another app and
  // landed here without tapping), skip. Scheduling through a suspended
  // AudioContext just spams ~16 warnings to the console for no audible
  // sound.
  const c = getCtx();
  if (!c || c.state !== 'running') return;
  bell({ freq: N.G5, start: 0, duration: 0.8, gain: 0.18 });
  bell({ freq: N.C6, start: 0.14, duration: 0.9, gain: 0.20 });
  bell({ freq: N.E6, start: 0.28, duration: 0.9, gain: 0.14 }); // sparkle
}

// Personal best: cinematic riser → impact → bright bell cluster → sustained
// pad chord → reverb tail. ~2.5s total event.
export function playPersonalBestSound() {
  unlockAudio();

  // Stage 1: riser (filtered noise sweep up)
  riser({ start: 0, duration: 0.7, gain: 0.18, fromHz: 200, toHz: 9000 });

  // Stage 2: impact at 0.7s
  subKick({ start: 0.7, freqStart: 95, freqEnd: 32, duration: 0.45, gain: 0.55 });
  noiseHit({ start: 0.7, duration: 0.20, gain: 0.30, hp: 200 });

  // Stage 3: bright bell cluster on the impact (perfect-fifth stack)
  bell({ freq: N.C6, start: 0.72, duration: 1.8, gain: 0.20 });
  bell({ freq: N.G6, start: 0.72, duration: 1.7, gain: 0.18 });
  bell({ freq: N.C7, start: 0.74, duration: 1.6, gain: 0.16 });
  bell({ freq: N.E7, start: 0.78, duration: 1.5, gain: 0.12 });

  // Stage 4: sustained pad chord (C major, sawtooth) sitting low
  chip({ freq: N.C4, start: 0.7, duration: 1.8, gain: 0.16, type: 'sawtooth' });
  chip({ freq: N.E4, start: 0.7, duration: 1.8, gain: 0.14, type: 'sawtooth' });
  chip({ freq: N.G4, start: 0.7, duration: 1.8, gain: 0.14, type: 'sawtooth' });
  // Octave reinforcement
  chip({ freq: N.C5, start: 0.7, duration: 1.6, gain: 0.10, type: 'triangle' });

  // Stage 5: sparkle arpeggio in the tail
  const sparkle = [N.G7, N.C8];
  sparkle.forEach((f, i) => bell({ freq: f, start: 1.0 + i * 0.08, duration: 0.5, gain: 0.06 }));
}
