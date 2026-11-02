import { socket } from "./socket";
import type { AccountSession } from "../app/types";

// Account login is per device (localStorage), unlike the game seat which is per tab
const SESSION_KEY = "friendly-game:account";
const listeners = new Set<() => void>();

let cached: AccountSession | null | undefined;
let cachedRaw: string | null = null;

function read(): AccountSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw === cachedRaw && cached !== undefined) return cached;
    cachedRaw = raw;
    cached = raw ? (JSON.parse(raw) as AccountSession) : null;
  } catch {
    cached = null;
  }
  return cached ?? null;
}

export const accountSession = {
  // useSyncExternalStore needs a stable value between changes, hence the cache
  get: read,

  subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => e.key === SESSION_KEY && listener();
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },

  set(session: AccountSession | null) {
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      // storage blocked: the session lasts until the tab closes
    }
    cached = undefined;
    listeners.forEach((l) => l());
  },
};

// Socket.io request/response with a timeout, for the account/couple endpoints
export function request<T>(event: string, payload: unknown, timeoutMs = 10_000): Promise<T & { error?: string }> {
  return new Promise((resolve) => {
    socket.timeout(timeoutMs).emit(event, payload, (err: Error | null, response: T & { error?: string }) => {
      resolve(err ? ({ error: "The server didn't answer, check your connection" } as T & { error?: string }) : response);
    });
  });
}
