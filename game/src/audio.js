// All sound is synthesised with WebAudio: short oscillator/noise blips for
// effects and a quiet pulsing bass line for music. No audio files, no network.
// Everything is a no-op until the first user gesture creates the context
// (browsers block audio before that), and until then nothing throws.

let ctx = null;
let master = null;
let musicTimer = null;
let muted = false;
let musicStep = 0;

/** Create the audio context. Call from a user gesture (click / key press). */
export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    startMusic();
  } catch {
    ctx = null;
  }
}

/** Toggle sound on/off; returns the new muted state. */
export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function isMuted() {
  return muted;
}

function tone(freq, duration, type, volume, slideTo) {
  if (!ctx || muted) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    // Audio is decoration: never let it break the game.
  }
}

function noise(duration, volume, lowpass) {
  if (!ctx || muted) return;
  try {
    const now = ctx.currentTime;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  } catch {
    // Audio is decoration: never let it break the game.
  }
}

export function playShoot() {
  tone(880, 0.07, 'square', 0.05, 440);
}

export function playHit() {
  noise(0.08, 0.12, 1800);
}

export function playKill() {
  tone(520, 0.16, 'triangle', 0.14, 130);
  noise(0.14, 0.1, 900);
}

export function playPlayerHurt() {
  tone(160, 0.25, 'sawtooth', 0.2, 55);
  noise(0.18, 0.16, 700);
}

export function playPickup() {
  tone(660, 0.09, 'sine', 0.12, 990);
}

export function playHeart() {
  tone(520, 0.12, 'sine', 0.14, 780);
  tone(780, 0.16, 'sine', 0.1, 1040);
}

export function playNova() {
  tone(220, 0.4, 'sawtooth', 0.16, 880);
  noise(0.35, 0.18, 2400);
}

export function playDash() {
  noise(0.14, 0.1, 3200);
}

export function playWaveClear() {
  [523, 659, 784, 1047].forEach((freq, i) => {
    setTimeout(() => tone(freq, 0.18, 'triangle', 0.12), i * 90);
  });
}

export function playBoss() {
  tone(98, 0.7, 'sawtooth', 0.18, 49);
  tone(147, 0.7, 'sawtooth', 0.1, 73);
}

export function playUpgrade() {
  [392, 523, 659].forEach((freq, i) => {
    setTimeout(() => tone(freq, 0.14, 'sine', 0.12), i * 70);
  });
}

export function playGameOver() {
  [392, 330, 262, 196].forEach((freq, i) => {
    setTimeout(() => tone(freq, 0.32, 'triangle', 0.14), i * 160);
  });
}

export function playVictory() {
  [523, 659, 784, 1047, 1319].forEach((freq, i) => {
    setTimeout(() => tone(freq, 0.28, 'triangle', 0.13), i * 120);
  });
}

/** A quiet two-bar bass pulse in A minor, stepped on a timer. */
const BASS_LINE = [55, 0, 55, 65.41, 55, 0, 49, 58.27, 55, 0, 55, 65.41, 82.41, 0, 73.42, 65.41];

function startMusic() {
  if (musicTimer !== null) return;
  musicTimer = setInterval(() => {
    if (!ctx || muted || ctx.state !== 'running') return;
    const note = BASS_LINE[musicStep % BASS_LINE.length];
    musicStep += 1;
    if (note) tone(note, 0.22, 'triangle', 0.05);
    if (musicStep % 8 === 4) tone(220, 0.1, 'sine', 0.02, 330);
  }, 240);
}
