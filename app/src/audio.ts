// Tiny WebAudio synth: every sound and the music loop are generated, so no audio files ship.
// Audio follows the YouTube mute state via setAudioEnabled (no in-game mute button).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let enabled = true;
let sfxOn = true;
let musicOn = true;
let paused = false;
let musicMode: 'menu' | 'battle' | null = null;
let musicTimer: number | null = null;
let beat = 0;
let nextBeatTime = 0;

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = enabled ? 1 : 0;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = musicOn ? 0.55 : 0;
    musicGain.connect(master);
  } catch { ctx = null; }
  return ctx;
}

/** Call from the first user gesture so browsers allow playback. */
export function unlockAudio(): void {
  const c = ensure();
  if (c && c.state === 'suspended' && !paused && enabled) void c.resume();
  if (musicMode && musicTimer === null) startMusic();
}

export function setAudioEnabled(on: boolean): void {
  enabled = on;
  if (master) master.gain.value = on ? 1 : 0;
  if (ctx) { if (!on) void ctx.suspend(); else if (!paused) void ctx.resume(); }
}

/** Settings toggles (the Android build may offer these; the Playables build never did). */
export function setSfxEnabled(on: boolean): void { sfxOn = on; }
export function setMusicEnabled(on: boolean): void { musicOn = on; if (musicGain) musicGain.gain.value = on ? 0.55 : 0; }

export function pauseAudio(): void { paused = true; if (ctx) void ctx.suspend(); }
export function resumeAudio(): void { paused = false; if (ctx && enabled) void ctx.resume(); }

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, delay = 0, slide = 0, dest?: AudioNode): void {
  const c = ensure(); if (!c || !master || (!dest && !sfxOn)) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest ?? master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur: number, gain = 0.1, filterFreq = 1200, q = 1, delay = 0, sweep = 0, dest?: AudioNode): void {
  const c = ensure(); if (!c || !master || (!dest && !sfxOn)) return;
  const t = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(filterFreq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, filterFreq + sweep), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(dest ?? master);
  src.start(t); src.stop(t + dur);
}

export const sfx = {
  click(): void { tone(880, 0.05, 'square', 0.03); },
  cast(pitch = 1): void { noise(0.35, 0.12, 900 * pitch, 1.5, 0, 1400); tone(320 * pitch, 0.25, 'triangle', 0.05, 0, 500); },
  hitEnemy(): void { noise(0.18, 0.16, 500, 0.8, 0, -300); tone(140, 0.2, 'sine', 0.1, 0, -80); },
  hitPlayer(): void { noise(0.25, 0.2, 300, 0.8, 0, -200); tone(90, 0.3, 'sawtooth', 0.09, 0, -50); },
  shield(): void { tone(660, 0.18, 'square', 0.04); tone(990, 0.22, 'square', 0.03, 0.03); },
  dodge(): void { noise(0.14, 0.08, 2400, 1, 0, 1800); },
  miss(): void { noise(0.2, 0.05, 1600, 2, 0, -900); },
  heal(): void { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'sine', 0.05, i * 0.07)); },
  fizzle(): void { tone(180, 0.18, 'sawtooth', 0.04, 0, -80); },
  freeze(): void { [1600, 2100, 2600].forEach((f, i) => tone(f, 0.3, 'triangle', 0.03, i * 0.05)); },
  telegraph(): void { tone(520, 0.08, 'square', 0.025); },
  coin(): void { tone(1320, 0.12, 'square', 0.04); tone(1760, 0.18, 'square', 0.04, 0.08); },
  buy(): void { [660, 880, 1320].forEach((f, i) => tone(f, 0.15, 'triangle', 0.05, i * 0.06)); },
  win(): void { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.5, 'triangle', 0.07, i * 0.12)); noise(0.6, 0.05, 3000, 0.5, 0.5); },
  lose(): void { [440, 392, 330, 262].forEach((f, i) => tone(f, 0.5, 'sawtooth', 0.05, i * 0.22, -20)); },
  boss(): void { tone(110, 1.2, 'sawtooth', 0.08, 0, -30); noise(1, 0.08, 200, 0.5, 0, -100); },
  revive(): void { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.4, 'sine', 0.06, i * 0.08)); },
};

// ---- generative music -------------------------------------------------------------
// A slow chord loop in A minor. Battle mode adds a driving bass and faster arpeggios.
const CHORDS = [
  [220, 261.6, 329.6], // Am
  [174.6, 220, 261.6], // F
  [261.6, 329.6, 392], // C
  [196, 246.9, 293.7], // G
];

function scheduleBeat(t: number): void {
  const c = ctx!; const dest = musicGain!;
  const battle = musicMode === 'battle';
  const bpm = battle ? 112 : 76;
  const step = 60 / bpm / 2; // eighth notes
  const chord = CHORDS[Math.floor(beat / 16) % CHORDS.length];
  const delay = t - c.currentTime;
  if (beat % 16 === 0) {
    // Pad: two detuned triangles per chord tone.
    for (const f of chord) {
      tone(f, step * 16, 'triangle', battle ? 0.022 : 0.03, delay, 0, dest);
      tone(f * 1.005, step * 16, 'triangle', battle ? 0.018 : 0.025, delay, 0, dest);
    }
  }
  if (beat % 4 === 0 || (battle && beat % 4 === 2)) tone(chord[0] / 2, step * (battle ? 1.6 : 3.5), battle ? 'sawtooth' : 'sine', battle ? 0.05 : 0.06, delay, 0, dest);
  if (battle || beat % 2 === 0) {
    const note = chord[Math.floor(Math.random() * chord.length)] * (Math.random() < 0.5 ? 2 : 4);
    tone(note, step * 0.9, 'sine', battle ? 0.03 : 0.025, delay, 0, dest);
  }
  if (battle && beat % 2 === 1) noise(0.05, 0.03, 6000, 1, delay, 0, dest);
  beat++;
  nextBeatTime = t + step;
}

function startMusic(): void {
  const c = ensure(); if (!c || !musicGain) return;
  if (musicTimer !== null) return;
  beat = 0;
  nextBeatTime = c.currentTime + 0.1;
  musicTimer = window.setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    while (nextBeatTime < ctx.currentTime + 0.4) scheduleBeat(nextBeatTime);
  }, 120);
}

export function setMusic(mode: 'menu' | 'battle' | null): void {
  if (musicMode === mode) return;
  musicMode = mode;
  if (musicTimer !== null) { clearInterval(musicTimer); musicTimer = null; }
  if (mode && ctx) startMusic();
}
