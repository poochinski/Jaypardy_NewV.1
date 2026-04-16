import { io } from "socket.io-client";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD
    ? window.location.origin
    : `http://${window.location.hostname}:5000`);

export const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
});