import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useGameState } from "./hooks/useGameState";
import { socket } from "./socket";

import HostScreen from "./screens/HostScreen";
import DisplayScreen from "./screens/DisplayScreen";
import PlayerScreen from "./screens/PlayerScreen";

export default function App() {
  // ✅ Correct: pass the socket into the hook so it can subscribe to "state:update"
  const { gameState, lastUpdateAt } = useGameState(socket);

  // Wait until the server sends us the first state
  if (!gameState) {
    return (
      <div style={{ padding: 20 }}>
        <h2 style={{ margin: 0 }}>Waiting for server…</h2>
        <div style={{ marginTop: 10 }}>
          Socket: <b>{socket.connected ? "Connected ✅" : "Disconnected ❌"}</b>
        </div>
        <div style={{ marginTop: 10, opacity: 0.8 }}>
          If this never changes, start the server (port 5000) first.
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/host" />} />
        {/* Screens expect `state` to be the REAL gameState object */}
        <Route
          path="/host"
          element={<HostScreen state={gameState} lastUpdateAt={lastUpdateAt} />}
        />
        <Route
          path="/display"
          element={<DisplayScreen state={gameState} lastUpdateAt={lastUpdateAt} />}
        />
        <Route
          path="/player"
          element={<PlayerScreen state={gameState} lastUpdateAt={lastUpdateAt} />}
        />
      </Routes>
    </BrowserRouter>
  );
}
