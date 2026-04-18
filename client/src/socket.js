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

// ─── Latency measurement ──────────────────────────────────────────────────────
// Server pings us periodically — we echo back immediately so the server
// can measure round-trip time and compensate for our network latency
socket.on("ping:server", ({ t }) => {
  socket.emit("pong:server", { t });
});