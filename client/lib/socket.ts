import { io } from "socket.io-client";

// Without an explicit URL, use the same host the page was opened from (port 5000), so
// opening http://<your-pc-ip>:3001 on a phone talks to the server on that PC too.
const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  (typeof window === "undefined" ? "http://localhost:5000" : `${window.location.protocol}//${window.location.hostname}:5000`);

// Connected manually from the page so nothing connects during server rendering
export const socket = io(SERVER_URL, { autoConnect: false });

const PLAYER_ID_KEY = "friendly-game:player-id";
const ROOM_KEY = "friendly-game:room-id";

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // randomUUID is missing on plain http (e.g. testing over LAN IP)
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const playerIdListeners = new Set<() => void>();

// Stable id per tab (survives refresh) so a refresh can reclaim the same seat
export function getPlayerId() {
  let id = sessionStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = randomId();
    sessionStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

export function subscribePlayerId(listener: () => void) {
  playerIdListeners.add(listener);
  return () => playerIdListeners.delete(listener);
}

// Taking over a couple seat from another browser means playing as that seat's id
export function adoptPlayerId(id: string) {
  if (id === getPlayerId()) return;
  sessionStorage.setItem(PLAYER_ID_KEY, id);
  playerIdListeners.forEach((listener) => listener());
}

export function getSavedRoom() {
  return sessionStorage.getItem(ROOM_KEY);
}

export function saveRoom(roomId: string | null) {
  if (roomId) sessionStorage.setItem(ROOM_KEY, roomId);
  else sessionStorage.removeItem(ROOM_KEY);
}
