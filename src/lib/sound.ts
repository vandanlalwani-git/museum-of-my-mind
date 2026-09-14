import { motionReduced } from '@/lib/motion';

/**
 * Two procedural sounds, both very quiet, made with the Web Audio API.
 * Nothing plays until the keeper has interacted with the page (the browser
 * would refuse anyway), the sound setting is on, and motion is not reduced.
 */

let ctx: AudioContext | null = null;
let armed = false;
let enabled = false;

export function setSoundEnabled(on: boolean) { enabled = on; }

/** Call once from a user gesture handler; creates the context lazily. */
function arm() {
  if (armed) return;
  armed = true;
  try { ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { ctx = null; }
}

export function installSoundGesture() {
  if (typeof window === 'undefined') return () => {};
  const onGesture = () => { arm(); void ctx?.resume(); };
  window.addEventListener('pointerdown', onGesture, { passive: true });
  window.addEventListener('keydown', onGesture);
  return () => { window.removeEventListener('pointerdown', onGesture); window.removeEventListener('keydown', onGesture); };
}

function canPlay(): AudioContext | null {
  if (!enabled || !armed || !ctx || motionReduced()) return null;
  if (ctx.state !== 'running') return null;
  return ctx;
}

/** A soft hinge: a low filtered noise sweep, about a quarter of a second. */
export function playDoor() {
  const ac = canPlay(); if (!ac) return;
  const now = ac.currentTime;
  const len = Math.floor(ac.sampleRate * 0.35);
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { const white = Math.random() * 2 - 1; last = (last + 0.02 * white) / 1.02; data[i] = last * 3.5; } // brown-ish noise
  const src = ac.createBufferSource(); src.buffer = buffer;
  const filter = ac.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.setValueAtTime(220, now); filter.frequency.exponentialRampToValueAtTime(90, now + 0.3); filter.Q.value = 0.7;
  const gain = ac.createGain(); gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.035, now + 0.04); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(now); src.stop(now + 0.36);
}

/** A small glass bell: two sines with a quick decay, about four tenths of a second. */
export function playChime() {
  const ac = canPlay(); if (!ac) return;
  const now = ac.currentTime;
  const gain = ac.createGain(); gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.03, now + 0.008); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  gain.connect(ac.destination);
  for (const [freq, level] of [[1318.5, 1], [2637, 0.35]] as const) {
    const osc = ac.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
    const g = ac.createGain(); g.gain.value = level;
    osc.connect(g).connect(gain);
    osc.start(now); osc.stop(now + 0.45);
  }
}
