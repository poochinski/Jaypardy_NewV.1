import { useMemo, useState, useEffect, useRef } from "react";
import { socket } from "../socket";
import "./jaypardyTheme.css";

const EMOJIS = ["😀","😎","🔥","🐝","🧠","🎯","⚡","🍕","👑","🤖",
                 "🦊","🐸","🎸","🚀","🌊","🎲","🦁","🐯","🍀","💎"];

// ─── Buzz states ──────────────────────────────────────────────────────────────
// idle      — no clue active, button is dark/disabled
// ready     — clue is active, button is blue and waiting
// won       — I buzzed first — button turns green
// lost      — someone else buzzed first — button turns red briefly then back to ready
// answered  — host marked result, resetting

export default function PlayerScreen({ state }) {
  const [name, setName]       = useState("");
  const [emoji, setEmoji]     = useState(EMOJIS[0]);
  const [buzzState, setBuzzState] = useState("idle"); // idle | ready | won | lost
  const lostTimer = useRef(null);

  // Derive whether I exist in server state (handles reconnects correctly)
  const me = useMemo(
    () => (state?.players ?? []).find((p) => p.id === socket.id),
    [state]
  );

  const myTeam = useMemo(
    () => (state?.teams ?? []).find((t) => t.id === me?.teamId),
    [me, state]
  );

  // Derive buzz state from server state every render
  useEffect(() => {
    const phase = state?.phase;
    const buzz  = state?.buzz;

    if (phase !== "clue") {
      // No clue active — clear any lost timer and go idle
      clearTimeout(lostTimer.current);
      setBuzzState("idle");
      return;
    }

    if (!buzz?.locked) {
      // Clue is active, nobody has buzzed yet
      setBuzzState("ready");
      return;
    }

    if (buzz.playerId === socket.id) {
      // I won the buzz
      clearTimeout(lostTimer.current);
      setBuzzState("won");
    } else {
      // Someone else buzzed — show red briefly then back to ready
      // (they might get it wrong and the clue stays active)
      setBuzzState("lost");
      clearTimeout(lostTimer.current);
      lostTimer.current = setTimeout(() => {
        // Only go back to ready if clue is still active
        setBuzzState((prev) => (prev === "lost" ? "ready" : prev));
      }, 1200);
    }
  }, [state?.phase, state?.buzz?.locked, state?.buzz?.playerId]);

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(lostTimer.current), []);

  const buzz = () => {
    if (buzzState !== "ready") return;
    // Send timestamp so server can compensate for network lag
    socket.emit("player:buzz", { clientTimestamp: Date.now() });
  };

  const join = () => {
    if (!name.trim()) return;
    socket.emit("player:join", { name: name.trim(), emoji });
  };

  // Derive joined from server state — not local state
  // This means reconnects work correctly
  const joined = !!me;

  // ─── Button appearance based on buzz state ────────────────────────────────

  const btnStyles = {
    idle: {
      background: "#1a1a2e",
      border: "2px solid rgba(255,255,255,0.10)",
      color: "rgba(255,255,255,0.25)",
      cursor: "not-allowed",
      transform: "none",
    },
    ready: {
      background: "linear-gradient(180deg, #1a3bd1, #0f2499)",
      border: "2px solid rgba(100,140,255,0.5)",
      color: "#ffdd75",
      cursor: "pointer",
      transform: "none",
    },
    won: {
      background: "linear-gradient(180deg, #16a34a, #0f7a32)",
      border: "2px solid rgba(74,222,128,0.7)",
      color: "#ffffff",
      cursor: "not-allowed",
      transform: "scale(1.03)",
    },
    lost: {
      background: "linear-gradient(180deg, #b91c1c, #7f1d1d)",
      border: "2px solid rgba(252,165,165,0.5)",
      color: "#ffffff",
      cursor: "not-allowed",
      transform: "none",
    },
  };

  const btnLabels = {
    idle:  "BUZZ",
    ready: "BUZZ",
    won:   "",
    lost:  "",
  };

  const currentBtnStyle = btnStyles[buzzState] ?? btnStyles.idle;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="jp-root" style={{ minHeight: "100vh", padding: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: 1.5, color: "#ffdd75" }}>
          JAYPARDY
        </div>
        {myTeam && (
          <div style={{
            marginLeft: "auto",
            padding: "4px 12px",
            borderRadius: 999,
            background: myTeam.color ?? "rgba(255,255,255,0.1)",
            color: "#fff",
            fontWeight: 800,
            fontSize: 13,
          }}>
            {myTeam.name}
          </div>
        )}
      </div>

      {/* JOIN FORM */}
      {!joined && (
        <div className="jp-panel">
          <div className="jp-panelTitle">Join Game</div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "rgba(246,247,255,0.6)", marginBottom: 6 }}>
              Your name
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && join()}
              placeholder="Type your name…"
              maxLength={32}
              style={{
                width: "100%",
                padding: "12px 14px",
                fontSize: 16,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.08)",
                color: "#f6f7ff",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "rgba(246,247,255,0.6)", marginBottom: 6 }}>
              Pick an emoji
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  style={{
                    fontSize: 24,
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    border: emoji === e
                      ? "2px solid #ffdd75"
                      : "2px solid rgba(255,255,255,0.10)",
                    background: emoji === e
                      ? "rgba(255,221,117,0.15)"
                      : "rgba(255,255,255,0.05)",
                    cursor: "pointer",
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={join}
            disabled={!name.trim()}
            style={{
              width: "100%",
              padding: 16,
              fontSize: 18,
              fontWeight: 900,
              borderRadius: 14,
              border: "none",
              background: name.trim() ? "#1a3bd1" : "rgba(255,255,255,0.08)",
              color: name.trim() ? "#ffdd75" : "rgba(255,255,255,0.3)",
              cursor: name.trim() ? "pointer" : "not-allowed",
            }}
          >
            Join Game
          </button>
        </div>
      )}

      {/* JOINED VIEW */}
      {joined && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Player status card */}
          <div className="jp-panel" style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 28 }}>{me.emoji}</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{me.name}</div>
                <div style={{ fontSize: 13, color: "rgba(246,247,255,0.6)", marginTop: 2 }}>
                  {myTeam
                    ? <span style={{ color: myTeam.color ?? "#ffdd75", fontWeight: 700 }}>{myTeam.name}</span>
                    : <span style={{ color: "rgba(255,100,100,0.9)" }}>Waiting for host to assign team…</span>
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Phase hint */}
          {state?.phase === "board" && (
            <div style={{
              textAlign: "center",
              color: "rgba(246,247,255,0.45)",
              fontSize: 14,
              padding: "8px 0",
            }}>
              Waiting for host to pick a clue…
            </div>
          )}

          {/* BUZZ BUTTON */}
          <button
            onClick={buzz}
            style={{
              width: "100%",
              height: 280,
              fontSize: buzzState === "won" || buzzState === "lost" ? 28 : 52,
              fontWeight: 900,
              borderRadius: 24,
              letterSpacing: 2,
              transition: "background 0.15s ease, transform 0.1s ease, border 0.15s ease",
              ...currentBtnStyle,
            }}
          >
            {btnLabels[buzzState]}
          </button>

          {/* Buzz hint text */}
          <div style={{ textAlign: "center", fontSize: 12, color: "rgba(246,247,255,0.35)" }}>
            {buzzState === "idle"  && "Waiting for a clue…"}
            {buzzState === "ready" && !me?.teamId && "You need a team to buzz in"}
            {buzzState === "ready" && me?.teamId  && "Tap the button the moment you know!"}
            {buzzState === "won"   && "Answer out loud — host is listening"}
            {buzzState === "lost"  && "Someone else got it — wait for their answer"}
          </div>

        </div>
      )}
    </div>
  );
}


