import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useGameState } from "./hooks/useGameState";
import { socket } from "./socket";

import HostScreen    from "./screens/HostScreen";
import DisplayScreen from "./screens/DisplayScreen";
import PlayerScreen  from "./screens/PlayerScreen";
import EditorScreen  from "./screens/EditorScreen";
import "./screens/jaypardyTheme.css";

function LandingScreen() {
  const navigate = useNavigate();

  const roles = [
    { path: "/player", label: "Player", emoji: "🎯", desc: "Join the game and buzz in" },
    { path: "/host",   label: "Host",   emoji: "👑", desc: "Run the game"             },
    { path: "/display",label: "Display",emoji: "📺", desc: "Show on the TV"           },
  ];

  return (
    <div style={{
      minHeight:   "100vh",
      width:       "100%",
      background:  "#050a2a",
      display:     "flex",
      flexDirection: "column",
      fontFamily:  "ui-sans-serif, system-ui, sans-serif",
      overflow:    "hidden",
      minHeight:           "100vh",
      width:               "100%",
      backgroundImage:     "url('/splash.png')",
      backgroundSize:      "cover",
      backgroundPosition:  "center center",
      backgroundRepeat:    "no-repeat",
      backgroundAttachment:"fixed",
      display:             "flex",
      flexDirection:       "column",
      justifyContent:      "flex-end",
      fontFamily:          "ui-sans-serif, system-ui, sans-serif",
    }}>
      {/* Logo image — always fully visible, scales with screen */}
      <div style={{
        flex:       "1 1 auto",
        display:    "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight:  0,
        padding:    "16px 16px 0",
      }}>
        <img
          src="/splash.png"
          alt="Jaypardy"
          style={{
            width:     "100%",
            maxWidth:  900,
            height:    "auto",
            maxHeight: "55vh",
            objectFit: "contain",
            objectPosition: "center",
            display:   "block",
          }}
        />
      </div>

      {/* Buttons section */}
      <div style={{
        flexShrink: 0,
        background: "linear-gradient(to top, rgba(5,10,42,1) 80%, transparent)",
        background: "linear-gradient(to top, rgba(5,10,42,0.97) 40%, rgba(5,10,42,0.3) 60%, transparent 80%)",
        padding:    "clamp(16px,4vw,40px) clamp(16px,5vw,40px) clamp(20px,4vw,40px)",
        display:    "flex",
        flexDirection: "column",
        alignItems: "center",
        gap:        "clamp(10px,2vw,16px)",
      }}>
        <div style={{ fontSize: "clamp(11px,2vw,14px)", color: "rgba(246,247,255,0.5)", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>
          Who are you?
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "clamp(8px,2vw,14px)", width: "100%", maxWidth: 640 }}>
          {roles.map((role) => (
            <button key={role.path} onClick={() => navigate(role.path)} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: "clamp(4px,1.5vw,8px)", padding: "clamp(12px,3vw,20px) clamp(8px,2vw,16px)",
              borderRadius: "clamp(12px,3vw,18px)",
              border: "2px solid rgba(255,221,117,0.5)",
              background: "rgba(255,221,117,0.10)",
              cursor: "pointer", minWidth: 0,
            }}>
              <div style={{ fontSize: "clamp(22px,4vw,34px)" }}>{role.emoji}</div>
              <div style={{ fontSize: "clamp(14px,3vw,20px)", fontWeight: 900, color: "#ffdd75" }}>{role.label}</div>
              <div style={{ fontSize: "clamp(10px,2vw,12px)", color: "rgba(246,247,255,0.5)", textAlign: "center", lineHeight: 1.3 }}>{role.desc}</div>
            </button>
          ))}
        </div>

        <button onClick={() => navigate("/editor")} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 24px", borderRadius: 12,
          border: "1px solid rgba(255,221,117,0.2)",
          background: "rgba(255,221,117,0.05)",
          cursor: "pointer", width: "100%", maxWidth: 640,
        }}>
          <span style={{ fontSize: 16 }}>✏️</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,221,117,0.6)" }}>Clue Editor</div>
            <div style={{ fontSize: 11, color: "rgba(246,247,255,0.3)" }}>Add, edit, or delete categories and clues</div>
          </div>
        </button>

        <div style={{ fontSize: "clamp(10px,2vw,11px)", color: "rgba(246,247,255,0.25)" }}>
          {socket.connected ? "Connected ✅" : "Connecting…"}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { gameState, lastUpdateAt } = useGameState(socket);

  return (
    <BrowserRouter>
      {!gameState ? (
        <div className="jp-root" style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16, color: "#f6f7ff",
        }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#ffdd75" }}>JAYPARDY</div>
          <div style={{ fontSize: 16, color: "rgba(246,247,255,0.6)" }}>Connecting to server…</div>
          <div style={{ fontSize: 13, color: socket.connected ? "#21c55d" : "rgba(246,247,255,0.35)" }}>
            {socket.connected ? "Connected ✅" : "Disconnected ❌"}
          </div>
        </div>
      ) : (
        <Routes>
          <Route path="/"        element={<LandingScreen />} />
          <Route path="/host"    element={<HostScreen    state={gameState} lastUpdateAt={lastUpdateAt} />} />
          <Route path="/display" element={<DisplayScreen state={gameState} lastUpdateAt={lastUpdateAt} />} />
          <Route path="/player"  element={<PlayerScreen  state={gameState} lastUpdateAt={lastUpdateAt} />} />
          <Route path="/editor"  element={<EditorScreen />} />
        </Routes>
      )}
    </BrowserRouter>
  );