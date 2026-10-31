// Tiny synthesized sound effects (Web Audio), so there are no audio files to ship.

const MUTE_KEY = "friendly-game:muted";

let ctx: AudioContext | null = null;
let muted = false;

if (typeof window !== "undefined") {
  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    // storage blocked: default to sound on
  }

  // Browsers only allow audio after a user gesture; unlock on the first one
  const unlock = () => getContext()?.resume();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

function getContext() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    ctx = new AudioCtor();
  }
  return ctx;
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = "sine", volume = 0.15) {
  const audio = getContext();
  if (!audio || muted) return;

  const t = audio.currentTime + start;
  const osc = audio.createOscillator();
  const gain = audio.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function noise(start: number, duration: number, volume = 0.12) {
  const audio = getContext();
  if (!audio || muted) return;

  const length = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);

  const src = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  filter.type = "bandpass";
  filter.frequency.value = 2200;
  gain.gain.value = volume;

  src.buffer = buffer;
  src.connect(filter).connect(gain).connect(audio.destination);
  src.start(audio.currentTime + start);
}

export const sound = {
  isMuted: () => muted,

  setMuted(value: boolean) {
    muted = value;
    try {
      localStorage.setItem(MUTE_KEY, value ? "1" : "0");
    } catch {
      // ignore
    }
  },

  roll() {
    for (let i = 0; i < 7; i++) noise(i * 0.09, 0.05, 0.1 + Math.random() * 0.08);
  },

  step() {
    tone(880, 0, 0.06, "triangle", 0.08);
  },

  points() {
    [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.18, "sine", 0.12));
  },

  turn() {
    tone(660, 0, 0.15, "sine", 0.14);
    tone(990, 0.12, 0.25, "sine", 0.12);
  },

  event() {
    [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, i * 0.05, 0.12, "triangle", 0.06));
  },

  pop() {
    tone(500, 0, 0.08, "sine", 0.1);
    tone(800, 0.03, 0.06, "sine", 0.06);
  },

  tick() {
    tone(1200, 0, 0.03, "square", 0.03);
  },

  win() {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, "triangle", 0.12));
  },
};

export function vibrate(pattern: number | number[]) {
  if (muted) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // not supported (e.g. iOS Safari)
  }
}
