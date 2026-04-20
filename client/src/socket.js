import { io } from "socket.io-client";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD
    ? window.location.origin
    : `http://${window.location.hostname}:5000`);

export const socket = io(SERVER_URL, {
  transports: ["websocket"],
  upgrade: false,
});

// ─── Persistent player ID ─────────────────────────────────────────────────────
// Stored in localStorage so it survives page reloads, sleep, and reconnects.
// The server uses this to restore the player's name, emoji, and team assignment
// automatically when they rejoin after disconnecting.
const STORAGE_KEY = "jp_player_id";

function getOrCreatePlayerId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      // Generate a random persistent ID
      id = "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (e.g. private browsing edge cases)
    return null;
  }
}

export const persistentPlayerId = getOrCreatePlayerId();

// ─── Latency measurement ──────────────────────────────────────────────────────
// Server pings us periodically — we echo back immediately so the server
// can measure round-trip time and compensate for our network latency
socket.on("ping:server", ({ t }) => {
  socket.emit("pong:server", { t });
});