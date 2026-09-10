// Procedurally synthesizes short "whoosh"/hit WAV sound effects for each
// baton skin, entirely offline (no external audio assets needed).
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(OUT_DIR, { recursive: true });

function writeWav(filename, samples) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT_DIR, filename), buffer);
  console.log('wrote', filename, `${(numSamples / SAMPLE_RATE).toFixed(2)}s`);
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// One-pole lowpass filter applied in place.
function lowpass(arr, amount) {
  let prev = 0;
  for (let i = 0; i < arr.length; i++) {
    prev = prev + amount * (arr[i] - prev);
    arr[i] = prev;
  }
  return arr;
}

// One-pole highpass filter applied in place.
function highpass(arr, amount) {
  let prevIn = 0;
  let prevOut = 0;
  for (let i = 0; i < arr.length; i++) {
    const out = amount * (prevOut + arr[i] - prevIn);
    prevIn = arr[i];
    prevOut = out;
    arr[i] = out;
  }
  return arr;
}

function envelope(t, duration, attack, release) {
  if (t < attack) return t / attack;
  const rel = duration - release;
  if (t > rel) return Math.max(0, 1 - (t - rel) / (duration - rel));
  return 1;
}

function makeWhoosh({ duration, seed, filterSweepFrom, filterSweepTo, lowRumble }) {
  const n = Math.floor(SAMPLE_RATE * duration);
  const rand = seededRandom(seed);
  const noise = new Float32Array(n);
  for (let i = 0; i < n; i++) noise[i] = rand() * 2 - 1;
  // Sweep a lowpass cutoff across the noise for a classic "whoosh" feel.
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const cutoff = filterSweepFrom + (filterSweepTo - filterSweepFrom) * t;
    prev = prev + cutoff * (noise[i] - prev);
    noise[i] = prev;
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = envelope(t, duration, duration * 0.08, duration * 0.55);
    let sample = noise[i] * env;
    if (lowRumble) {
      sample += Math.sin(2 * Math.PI * 70 * t) * env * 0.25 * Math.exp(-t * 6);
    }
    out[i] = sample;
  }
  return out;
}

function addTail(base, tailFn) {
  const out = base.slice();
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    out[i] += tailFn(t);
  }
  return out;
}

function normalize(arr, peak = 0.9) {
  let max = 0;
  for (const v of arr) max = Math.max(max, Math.abs(v));
  if (max === 0) return arr;
  const scale = peak / max;
  for (let i = 0; i < arr.length; i++) arr[i] *= scale;
  return arr;
}

// --- Wood staff: warm, quick swish + soft low thump.
{
  const s = makeWhoosh({ duration: 0.32, seed: 1, filterSweepFrom: 0.6, filterSweepTo: 0.08, lowRumble: true });
  writeWav('wood.wav', normalize(s));
}

// --- Steel rod: sharper swish + bright metallic ring tail.
{
  let s = makeWhoosh({ duration: 0.3, seed: 2, filterSweepFrom: 0.9, filterSweepTo: 0.2, lowRumble: false });
  s = addTail(s, (t) => {
    const decay = Math.exp(-t * 9);
    return (
      0.06 * Math.sin(2 * Math.PI * 3100 * t) +
      0.05 * Math.sin(2 * Math.PI * 4700 * t) +
      0.04 * Math.sin(2 * Math.PI * 6200 * t)
    ) * decay;
  });
  writeWav('steel.wav', normalize(s));
}

// --- Fire staff: whoosh with crackling embers layered on top.
{
  let s = makeWhoosh({ duration: 0.4, seed: 3, filterSweepFrom: 0.7, filterSweepTo: 0.15, lowRumble: true });
  const rand = seededRandom(99);
  const n = s.length;
  const crackle = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (rand() > 0.9975) {
      const len = 60 + Math.floor(rand() * 120);
      for (let j = 0; j < len && i + j < n; j++) {
        crackle[i + j] += (rand() * 2 - 1) * Math.exp(-j / 20);
      }
    }
  }
  highpass(crackle, 0.6);
  for (let i = 0; i < n; i++) s[i] += crackle[i] * 0.5;
  writeWav('fire.wav', normalize(s));
}

// --- Laser sabre: pitched sine sweep with light distortion.
{
  const duration = 0.28;
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 1400 * Math.exp(-t * 6) + 220;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const env = envelope(t, duration, 0.01, duration * 0.6);
    let sample = Math.sin(phase);
    // soft clip distortion for a "zap" edge
    sample = Math.tanh(sample * 2.2);
    out[i] = sample * env * 0.8;
  }
  const rand = seededRandom(7);
  for (let i = 0; i < n; i++) out[i] += (rand() * 2 - 1) * 0.03 * envelope(i / SAMPLE_RATE, duration, 0.01, duration * 0.6);
  writeWav('laser.wav', normalize(out));
}

// --- Rainbow wand: bright arpeggiated bell chime + sparkle noise.
{
  const duration = 0.45;
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C major arpeggio
  notes.forEach((freq, idx) => {
    const start = idx * 0.05;
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      if (t < start) continue;
      const lt = t - start;
      const env = Math.exp(-lt * 7);
      out[i] += Math.sin(2 * Math.PI * freq * lt) * env * 0.35;
    }
  });
  const rand = seededRandom(42);
  const sparkle = new Float32Array(n);
  for (let i = 0; i < n; i++) sparkle[i] = rand() * 2 - 1;
  highpass(sparkle, 0.8);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    out[i] += sparkle[i] * 0.15 * Math.exp(-t * 5);
  }
  writeWav('rainbow.wav', normalize(out));
}

// --- Wood knock, played when the stick hits the ground or a wall.
{
  const duration = 0.22;
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  // A few inharmonic modes: what a hollow-ish piece of wood actually rings at.
  const modes = [196, 331, 512, 743];
  const rand = seededRandom(2024);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let sample = 0;
    modes.forEach((freq, idx) => {
      sample += Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * (26 + idx * 14)) * (0.5 / (idx + 1));
    });
    // Contact click at the very start.
    sample += (rand() * 2 - 1) * Math.exp(-t * 320) * 0.7;
    out[i] = sample;
  }
  writeWav('impact.wav', normalize(out));
}

// --- UI click for shop purchases / equips.
{
  const duration = 0.12;
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 30);
    out[i] = Math.sin(2 * Math.PI * 880 * t) * env * 0.6;
  }
  writeWav('click.wav', normalize(out));
}

console.log('done');
