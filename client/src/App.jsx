import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useGameState } from "./hooks/useGameState";
import { socket } from "./socket";

import HostScreen from "./screens/HostScreen";
import DisplayScreen from "./screens/DisplayScreen";
import PlayerScreen from "./screens/PlayerScreen";
import "./screens/jaypardyTheme.css";

function LandingScreen() {
  const navigate = useNavigate();

  const roles = [
    { path: "/player", label: "Player", emoji: "🎯", desc: "Join the game and buzz in", color: "#1a3bd1", border: "rgba(100,140,255,0.5)" },
    { path: "/host", label: "Host", emoji: "👑", desc: "Run the game", color: "rgba(255,221,117,0.15)", border: "rgba(255,221,117,0.6)", textColor: "#ffdd75" },
    { path: "/display", label: "Display", emoji: "📺", desc: "Show on the TV", color: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.2)" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        backgroundImage: "url('/splash.png')",
        backgroundSize: "cover",
        backgroundPosition: "center 15%",
        backgroundRepeat: "no-repeat",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background: "linear-gradient(to top, rgba(5,10,42,1) 65%, rgba(5,10,42,0.6) 85%, transparent)",
          padding: "clamp(32px,8vw,80px) clamp(16px,5vw,40px) clamp(24px,5vw,48px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "clamp(12px,3vw,20px)",
        }}
      >
        <div
          style={{
            fontSize: "clamp(11px,2vw,14px)",
            color: "rgba(246,247,255,0.5)",
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          Who are you?
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: "clamp(8px,2vw,14px)",
            width: "100%",
            maxWidth: 640,
          }}
        >
          {roles.map((role) => (
            <button
              key={role.path}
              onClick={() => navigate(role.path)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "clamp(4px,1.5vw,8px)",
                padding: "clamp(12px,3vw,20px) clamp(8px,2vw,16px)",
                borderRadius: "clamp(12px,3vw,18px)",
                border: `2px solid ${role.border}`,
                background: role.color,
                cursor: "pointer",
                minWidth: 0,
              }}
            >
              <div style={{ fontSize: "clamp(24px,5vw,36px)" }}>{role.emoji}</div>
              <div
                style={{
                  fontSize: "clamp(14px,3vw,20px)",
                  fontWeight: 900,
                  color: role.textColor ?? "#f6f7ff",
                }}
              >
                {role.label}
              </div>
              <div
                style={{
                  fontSize: "clamp(10px,2vw,12px)",
                  color: "rgba(246,247,255,0.5)",
                  textAlign: "center",
                  lineHeight: 1.3,
                }}
              >
                {role.desc}
              </div>
            </button>
          ))}
        </div>

        <div
          style={{
            fontSize: "clamp(10px,2vw,11px)",
            color: "rgba(246,247,255,0.25)",
          }}
        >
          Open a screen to begin
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div
      className="jp-root"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        color: "#f6f7ff",
      }}
    >
      <div style={{ fontSize: 32, fontWeight: 900, color: "#ffdd75" }}>JAYPARDY</div>
      <div style={{ fontSize: 16, color: "rgba(246,247,255,0.6)" }}>Connecting to server…</div>
    </div>
  );
}

export default function App() {
  const { gameState, lastUpdateAt } = useGameState(socket);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route
          path="/host"
          element={
            gameState ? (
              <HostScreen state={gameState} lastUpdateAt={lastUpdateAt} />
            ) : (
              <LoadingScreen />
            )
          }
        />
        <Route
          path="/display"
          element={
            gameState ? (
              <DisplayScreen state={gameState} lastUpdateAt={lastUpdateAt} />
            ) : (
              <LoadingScreen />
            )
          }
        />
        <Route
          path="/player"
          element={
            gameState ? (
              <PlayerScreen state={gameState} lastUpdateAt={lastUpdateAt} />
            ) : (
              <LoadingScreen />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}