import { io } from "socket.io-client";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:5000";

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

// Stable id per tab (survives refresh) so a refresh can reclaim the same seat
export function getPlayerId() {
  let id = sessionStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = randomId();
    sessionStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

export function getSavedRoom() {
  return sessionStorage.getItem(ROOM_KEY);
}

export function saveRoom(roomId: string | null) {
  if (roomId) sessionStorage.setItem(ROOM_KEY, roomId);
  else sessionStorage.removeItem(ROOM_KEY);
}
