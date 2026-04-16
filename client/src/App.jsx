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
      path:  "/player",
      label: "Player",
      emoji: "🎯",
      desc:  "Join the game and buzz in",
      color: "rgba(255,221,117,0.15)",
      border: "rgba(100,140,255,0.5)",
    },
    {
      path:  "/host",
      label: "Host",
      emoji: "👑",
      desc:  "Run the game",
      color: "rgba(255,221,117,0.15)",
      border: "rgba(255,221,117,0.6)",
      textColor: "#ffdd75",
    },
    {
      path:  "/display",
      label: "Display",
      emoji: "📺",
      desc:  "Show on the TV",
      color: "rgba(255,255,255,0.06)",
      border: "rgba(255,255,255,0.2)",
    },
  ];

  return (
    <div style={{
      minHeight:          "100vh",
      width:              "100%",
      backgroundImage:    "url('/splash.png')",
      backgroundSize:     "cover",
      backgroundPosition: "center 20%",
      backgroundRepeat:   "no-repeat",
      display:            "flex",
      flexDirection:      "column",
      justifyContent:     "flex-end",
      fontFamily:         "ui-sans-serif, system-ui, sans-serif",
    }}>

      {/* Bottom section — buttons sit below the logo art */}
      <div style={{
        background:    "linear-gradient(to top, rgba(5,10,42,1) 70%, transparent)",
        padding:       "60px 24px 48px",
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:           20,
      }}>

        <div style={{
          fontSize:      13,
          color:         "rgba(246,247,255,0.5)",
          fontWeight:    700,
          letterSpacing: 3,
          textTransform: "uppercase",
        }}>
          Who are you?
        </div>

        {/* Role buttons */}
        <div style={{
          display:             "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap:                 14,
          width:               "100%",
          maxWidth:            640,
        }}>
          {roles.map((role) => (
            <button
              key={role.path}
              onClick={() => navigate(role.path)}
              style={{
                display:       "flex",
                flexDirection: "column",
                alignItems:    "center",
                gap:           8,
                padding:       "20px 16px",
                borderRadius:  18,
                border:        `2px solid ${role.border}`,
                background:    role.color,
                cursor:        "pointer",
                transition:    "transform 0.1s ease, filter 0.1s ease",
              }}
              onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.2)"}
              onMouseLeave={(e) => e.currentTarget.style.filter = "brightness(1)"}
              onMouseDown={(e)  => e.currentTarget.style.transform = "scale(0.96)"}
              onMouseUp={(e)    => e.currentTarget.style.transform = "scale(1)"}
            >
              <div style={{ fontSize: 36 }}>{role.emoji}</div>
              <div style={{
                fontSize:      20,
                fontWeight:    900,
                color:         role.textColor ?? "#f6f7ff",
                letterSpacing: 0.5,
              }}>
                {role.label}
              </div>
              <div style={{
                fontSize:  12,
                color:     "rgba(246,247,255,0.5)",
                textAlign: "center",
              }}>
                {role.desc}
              </div>
            </button>
          ))}
        </div>

        {/* Connection status */}
        <div style={{ fontSize: 11, color: "rgba(246,247,255,0.25)" }}>
          {socket.connected ? "Connected ✅" : "Connecting…"}
        </div>

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
