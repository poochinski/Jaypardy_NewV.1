import { io } from "socket.io-client";

// If you open the site on your phone via your PC's LAN IP (ex: http://192.168.0.50:5173),
// window.location.hostname will be "192.168.0.50" so this will correctly connect to:
// http://192.168.0.50:5000
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:5000`;

export const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
});
