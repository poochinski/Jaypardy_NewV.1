import { BrowserRouter, Routes, Route, useNavigate } from “react-router-dom”;
import { useGameState } from “./hooks/useGameState”;
import { socket } from “./socket”;

import HostScreen    from “./screens/HostScreen”;
import DisplayScreen from “./screens/DisplayScreen”;
import PlayerScreen  from “./screens/PlayerScreen”;
import “./screens/jaypardyTheme.css”;

// ─── Landing screen ───────────────────────────────────────────────────────────

function LandingScreen() {
const navigate = useNavigate();

const roles = [
{
path:  “/player”,
label: “Player”,
emoji: “🎯”,
desc:  “Join the game and buzz in”,
color: “#1a3bd1”,
border: “rgba(100,140,255,0.5)”,
},
{
path:  “/host”,
label: “Host”,
emoji: “👑”,
desc:  “Run the game”,
color: “rgba(255,221,117,0.15)”,
border: “rgba(255,221,117,0.6)”,
textColor: “#ffdd75”,
},
{
path:  “/display”,
label: “Display”,
emoji: “📺”,
desc:  “Show on the TV”,
color: “rgba(255,255,255,0.06)”,
border: “rgba(255,255,255,0.2)”,
},
];

return (
<div style={{
minHeight:          “100vh”,
width:              “100%”,
backgroundImage:    “url(’/splash.png’)”,
backgroundSize:     “cover”,
backgroundPosition: “center 15%”,
backgroundRepeat:   “no-repeat”,
display:            “flex”,
flexDirection:      “column”,
justifyContent:     “flex-end”,
fontFamily:         “ui-sans-serif, system-ui, sans-serif”,
}}>

```
  <div style={{
    background:    "linear-gradient(to top, rgba(5,10,42,1) 65%, rgba(5,10,42,0.6) 85%, transparent)",
    padding:       "clamp(32px, 8vw, 80px) clamp(16px, 5vw, 40px) clamp(24px, 5vw, 48px)",
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
    gap:           "clamp(12px, 3vw, 20px)",
  }}>

    <div style={{
      fontSize:      "clamp(11px, 2vw, 14px)",
      color:         "rgba(246,247,255,0.5)",
      fontWeight:    700,
      letterSpacing: 3,
      textTransform: "uppercase",
    }}>
      Who are you?
    </div>

    {/* Role buttons — always a single row on phones, wraps on very small screens */}
    <div style={{
      display:             "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap:                 "clamp(8px, 2vw, 14px)",
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
            gap:           "clamp(4px, 1.5vw, 8px)",
            padding:       "clamp(12px, 3vw, 20px) clamp(8px, 2vw, 16px)",
            borderRadius:  "clamp(12px, 3vw, 18px)",
            border:        `2px solid ${role.border}`,
            background:    role.color,
            cursor:        "pointer",
            transition:    "transform 0.1s ease, filter 0.1s ease",
            minWidth:      0,
          }}
          onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.2)"}
          onMouseLeave={(e) => e.currentTarget.style.filter = "brightness(1)"}
          onMouseDown={(e)  => e.currentTarget.style.transform = "scale(0.96)"}
          onMouseUp={(e)    => e.currentTarget.style.transform = "scale(1)"}
        >
          <div style={{ fontSize: "clamp(24px, 5vw, 36px)" }}>{role.emoji}</div>
          <div style={{
            fontSize:      "clamp(14px, 3vw, 20px)",
            fontWeight:    900,
            color:         role.textColor ?? "#f6f7ff",
            letterSpacing: 0.5,
          }}>
            {role.label}
          </div>
          <div style={{
            fontSize:  "clamp(10px, 2vw, 12px)",
            color:     "rgba(246,247,255,0.5)",
            textAlign: "center",
            lineHeight: 1.3,
          }}>
            {role.desc}
          </div>
        </button>
      ))}
    </div>

    <div style={{ fontSize: "clamp(10px, 2vw, 11px)", color: "rgba(246,247,255,0.25)" }}>
      {socket.connected ? "Connected ✅" : "Connecting…"}
    </div>

  </div>
</div>
```

);
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
const { gameState, lastUpdateAt } = useGameState(socket);

if (!gameState) {
return (
<div className=“jp-root” style={{
minHeight:      “100vh”,
display:        “flex”,
flexDirection:  “column”,
alignItems:     “center”,
justifyContent: “center”,
gap:            16,
color:          “#f6f7ff”,
}}>
<div style={{ fontSize: 32, fontWeight: 900, color: “#ffdd75” }}>
JAYPARDY
</div>
<div style={{ fontSize: 16, color: “rgba(246,247,255,0.6)” }}>
Connecting to server…
</div>
<div style={{
fontSize:     13,
color:        socket.connected ? “#21c55d” : “rgba(246,247,255,0.35)”,
}}>
{socket.connected ? “Connected ✅” : “Disconnected ❌”}
</div>
</div>
);
}

return (
<BrowserRouter>
<Routes>
<Route path=”/”        element={<LandingScreen />} />
<Route path=”/host”    element={<HostScreen    state={gameState} lastUpdateAt={lastUpdateAt} />} />
<Route path=”/display” element={<DisplayScreen state={gameState} lastUpdateAt={lastUpdateAt} />} />
<Route path=”/player”  element={<PlayerScreen  state={gameState} lastUpdateAt={lastUpdateAt} />} />
</Routes>
</BrowserRouter>
);
}