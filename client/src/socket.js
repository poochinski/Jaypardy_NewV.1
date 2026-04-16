import { io } from "socket.io-client";

// In production (Railway), the server and client are on the same domain
// In development, the server runs on port 5000 separately
// In Codespaces, VITE_SERVER_URL overrides everything
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD
    ? window.location.origin          // production — same domain
    : `http://${window.location.hostname}:5000`); // dev — separate port

export const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
});
