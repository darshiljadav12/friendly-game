import type { A11y, A11yKey } from "../app/types";

// Each player's own accessibility choices on this device. A key that's missing
// means "follow the room's setting" (picked by the creator).
const KEY = "friendly-game:a11y";
const listeners = new Set<() => void>();
const EMPTY: Partial<A11y> = {};

let cached: Partial<A11y> | undefined;

function read(): Partial<A11y> {
  if (cached) return cached;
  try {
    cached = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<A11y>;
  } catch {
    cached = {};
  }
  return cached;
}

export const a11yPrefs = {
  get: read,
  getServer: () => EMPTY,

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  set(key: A11yKey, value: boolean | null) {
    const next = { ...read() };
    if (value === null) delete next[key];
    else next[key] = value;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // ignore: works until reload
    }
    cached = next;
    listeners.forEach((l) => l());
  },
};

// Room setting, overridden by this player's own choice when they made one
export function effectiveA11y(room: A11y | undefined, local: Partial<A11y>): A11y {
  const base = room ?? { reduceMotion: false, largeText: false, highContrast: false, colorBlind: false };
  return {
    reduceMotion: local.reduceMotion ?? base.reduceMotion,
    largeText: local.largeText ?? base.largeText,
    highContrast: local.highContrast ?? base.highContrast,
    colorBlind: local.colorBlind ?? base.colorBlind,
  };
}

// Respect the OS "reduce motion" setting too
export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
