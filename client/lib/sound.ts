// Tiny synthesized sound effects (Web Audio), so there are no audio files to ship.

const MUTE_KEY = "friendly-game:muted";

let ctx: AudioContext | null = null;
let muted = false;
let stale = false; // the page was in the background; replace the audio context on the next tap
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    // storage blocked: default to sound on
  }

  // iPhone: play Web Audio as media, so the silent switch doesn't mute the game (Safari 17+)
  try {
    const audioSession = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (audioSession) audioSession.type = "playback";
  } catch {
    // not supported
  }

  // Browsers only allow audio after a user gesture. On touch screens only touchend/click
  // count (not pointerdown), and phones suspend the audio again after the app was in the
  // background, so resume on every gesture, not just the first.
  const unlock = () => {
    // Back from another app: iPhones often leave the old audio context "running" but silent,
    // so start a fresh one inside this tap
    if (stale && ctx) {
      ctx.close().catch(() => {});
      ctx = null;
    }
    const fresh = stale || !ctx;
    stale = false;

    const audio = getContext();
    if (!audio || (audio.state === "running" && !fresh)) return;
    audio.resume().catch(() => {});
    // iOS only really starts the context once something plays inside the gesture
    const src = audio.createBufferSource();
    src.buffer = audio.createBuffer(1, 1, audio.sampleRate);
    src.connect(audio.destination);
    src.start(0);
  };
  for (const type of ["touchend", "click", "keydown"]) window.addEventListener(type, unlock, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      stale = true;
    } else {
      // Android allows resuming without a new tap, so sounds work right away again
      ctx?.resume().catch(() => {});
    }
  });
  // Coming back through the back/forward cache
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) stale = true;
  });
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
  if (audio.state !== "running") audio.resume().catch(() => {});

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
  if (audio.state !== "running") audio.resume().catch(() => {});

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

  // For useSyncExternalStore, so the mute button re-renders when this changes
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setMuted(value: boolean) {
    muted = value;
    try {
      localStorage.setItem(MUTE_KEY, value ? "1" : "0");
    } catch {
      // ignore
    }
    listeners.forEach((l) => l());
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
