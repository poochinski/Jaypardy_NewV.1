import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useGameState } from "./hooks/useGameState";
import { socket } from "./socket";

import HostScreen    from "./screens/HostScreen";
import DisplayScreen from "./screens/DisplayScreen";
import PlayerScreen  from "./screens/PlayerScreen";
import "./screens/jaypardyTheme.css";

// ─── Landing screen ───────────────────────────────────────────────────────────

function LandingScreen() {
  const navigate = useNavigate();

  const roles = [
    {
      path:    "/player",
      label:   "Player",
      emoji:   "🎯",
      desc:    "Join the game and buzz in on your phone",
      color:   "rgba(255,221,117,0.15)",
      border:  "rgba(100,140,255,0.4)",
    },
    {
      path:    "/host",
      label:   "Host",
      emoji:   "👑",
      desc:    "Run the game — pick clues and judge answers",
      color:   "rgba(255,221,117,0.15)",
      border:  "rgba(255,221,117,0.5)",
      textColor: "#ffdd75",
    },
    {
      path:    "/display",
      label:   "Display",
      emoji:   "📺",
      desc:    "Show on the TV or projector for everyone to see",
      color:   "rgba(255,255,255,0.06)",
      border:  "rgba(255,255,255,0.15)",
    },
  ];

  return (
    <div className="jp-root" style={{
      minHeight:      "100vh",
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      padding:        24,
      gap:            32,
    }}>

      {/* Logo */}
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontSize:      "clamp(48px, 10vw, 96px)",
          fontWeight:    900,
          color:         "#ffdd75",
          letterSpacing: -2,
          lineHeight:    1,
          textShadow:    "0 4px 0 rgba(0,0,0,0.3)",
        }}>
          JAYPARDY
        </div>
        <div style={{
          fontSize:     16,
          color:        "rgba(246,247,255,0.45)",
          marginTop:    10,
          fontWeight:   700,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}>
          Who are you?
        </div>
      </div>

      {/* Role cards */}
      <div style={{
        display:             "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap:                 16,
        width:               "100%",
        maxWidth:            720,
      }}>
        {roles.map((role) => (
          <button
            key={role.path}
            onClick={() => navigate(role.path)}
            style={{
              display:       "flex",
              flexDirection: "column",
              alignItems:    "center",
              gap:           12,
              padding:       "28px 20px",
              borderRadius:  20,
              border:        `2px solid ${role.border}`,
              background:    role.color,
              cursor:        "pointer",
              transition:    "transform 0.1s ease, filter 0.1s ease",
            }}
            onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.15)"}
            onMouseLeave={(e) => e.currentTarget.style.filter = "brightness(1)"}
            onMouseDown={(e)  => e.currentTarget.style.transform = "scale(0.97)"}
            onMouseUp={(e)    => e.currentTarget.style.transform = "scale(1)"}
          >
            <div style={{ fontSize: 48 }}>{role.emoji}</div>
            <div style={{
              fontSize:   24,
              fontWeight: 900,
              color:      role.textColor ?? "#f6f7ff",
              letterSpacing: 0.5,
            }}>
              {role.label}
            </div>
            <div style={{
              fontSize:   13,
              color:      "rgba(246,247,255,0.55)",
              textAlign:  "center",
              lineHeight: 1.4,
            }}>
              {role.desc}
            </div>
          </button>
        ))}
      </div>

      {/* Connection status */}
      <div style={{
        fontSize:  12,
        color:     "rgba(246,247,255,0.3)",
        textAlign: "center",
      }}>
        {socket.connected ? "Connected to server ✅" : "Connecting to server…"}
      </div>

    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { gameState, lastUpdateAt } = useGameState(socket);

  if (!gameState) {
    return (
      <div className="jp-root" style={{
        minHeight:      "100vh",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        gap:            16,
        color:          "#f6f7ff",
      }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: "#ffdd75" }}>
          JAYPARDY
        </div>
        <div style={{ fontSize: 16, color: "rgba(246,247,255,0.6)" }}>
          Connecting to server…
        </div>
        <div style={{
          fontSize:     13,
          color:        socket.connected ? "#21c55d" : "rgba(246,247,255,0.35)",
        }}>
          {socket.connected ? "Connected ✅" : "Disconnected ❌"}
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<LandingScreen />} />
        <Route path="/host"    element={<HostScreen    state={gameState} lastUpdateAt={lastUpdateAt} />} />
        <Route path="/display" element={<DisplayScreen state={gameState} lastUpdateAt={lastUpdateAt} />} />
        <Route path="/player"  element={<PlayerScreen  state={gameState} lastUpdateAt={lastUpdateAt} />} />
      </Routes>
    </BrowserRouter>
  );
}
