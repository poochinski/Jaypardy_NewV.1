import { useMemo, useState, useEffect, useRef } from "react";
import { socket } from "../socket";
import "./jaypardyTheme.css";

const EMOJIS = ["😀","😎","🔥","🐝","🧠","🎯","⚡","🍕","👑","🤖",
                 "🦊","🐸","🎸","🚀","🌊","🎲","🦁","🐯","🍀","💎"];

export default function PlayerScreen({ state }) {
  const [name,        setName]        = useState("");
  const [emoji,       setEmoji]       = useState(EMOJIS[0]);
  const [buzzState,   setBuzzState]   = useState("idle");
  const [wagerInput,  setWagerInput]  = useState("");
  const [finalWager,  setFinalWager]  = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [wagerLocked,  setWagerLocked]  = useState(false);
  const [answerLocked, setAnswerLocked] = useState(false);
  const lostTimer = useRef(null);

  const me = useMemo(
    () => (state?.players ?? []).find((p) => p.id === socket.id),
    [state]
  );

  const myTeam = useMemo(
    () => (state?.teams ?? []).find((t) => t.id === me?.teamId),
    [me, state]
  );

  const joined = !!me;
  const phase  = state?.phase;
  const buzz   = state?.buzz;
  const finalJaypardy = state?.finalJaypardy ?? null;

  // Am I eligible for final? (in the wagers map)
  const inFinal = finalJaypardy && (socket.id in (finalJaypardy.wagers ?? {}));
  const myFinalWager = finalJaypardy?.wagers?.[socket.id] ?? null;

  // Max final wager = team score (can wager $0 up to total)
  const maxFinalWager = myTeam?.score ?? 0;

  // Am I the designated wager player for this Daily Double?
  const isWagerPlayer = state?.currentClue?.wagerPlayerId === socket.id;

  // Max DD wager = team score or 1000, whichever is higher
  const maxWager = Math.max(myTeam?.score ?? 0, 1000);

  const doFinalWager = () => {
    const amount = parseInt(finalWager, 10);
    if (!isFinite(amount) || amount < 0) return;
    socket.emit("player:submitFinalWager", { amount });
    setWagerLocked(true);
  };

  const doFinalAnswer = () => {
    if (!finalAnswer.trim()) return;
    socket.emit("player:submitFinalAnswer", { answer: finalAnswer.trim() });
    setAnswerLocked(true);
  };

  // ─── Derive buzz state from server ───────────────────────────────────────
  useEffect(() => {
    if (phase !== "clue" && phase !== "dailyDoubleClue") {
      clearTimeout(lostTimer.current);
      setBuzzState("idle");
      return;
    }

    if (!buzz?.locked) {
      setBuzzState("ready");
      return;
    }

    if (buzz.playerId === socket.id) {
      clearTimeout(lostTimer.current);
      setBuzzState("won");
    } else {
      setBuzzState("lost");
      clearTimeout(lostTimer.current);
      lostTimer.current = setTimeout(() => {
        setBuzzState((prev) => (prev === "lost" ? "ready" : prev));
      }, 1200);
    }
  }, [phase, buzz?.locked, buzz?.playerId]);

  useEffect(() => () => clearTimeout(lostTimer.current), []);

  const doBuzz = () => {
    if (buzzState !== "ready") return;
    socket.emit("player:buzz", { clientTimestamp: Date.now() });
  };

  const doWager = () => {
    const amount = parseInt(wagerInput, 10);
    if (!isFinite(amount) || amount < 1) return;
    socket.emit("player:submitWager", { amount });
    setWagerInput("");
  };

  const join = () => {
    if (!name.trim()) return;
    socket.emit("player:join", { name: name.trim(), emoji });
  };

  // ─── Button styles ────────────────────────────────────────────────────────
  const btnStyles = {
    idle:  { background: "#1a1a2e", border: "2px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.25)", cursor: "not-allowed" },
    ready: { background: "#1a3bd1", border: "2px solid rgba(100,140,255,0.5)",  color: "#ffdd75",                cursor: "pointer"     },
    won:   { background: "#16a34a", border: "2px solid rgba(74,222,128,0.7)",   color: "#ffffff",                cursor: "not-allowed", transform: "scale(1.03)" },
    lost:  { background: "#b91c1c", border: "2px solid rgba(252,165,165,0.5)",  color: "#ffffff",                cursor: "not-allowed" },
  };

  const btnLabels = { idle: "BUZZ", ready: "BUZZ", won: "YOU GOT IT", lost: "TOO SLOW" };

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
            marginLeft:   "auto",
            padding:      "4px 12px",
            borderRadius: 999,
            background:   myTeam.color ?? "rgba(255,255,255,0.1)",
            color:        "#fff",
            fontWeight:   800,
            fontSize:     13,
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
            <div style={{ fontSize: 12, color: "rgba(246,247,255,0.6)", marginBottom: 6 }}>Your name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && join()}
              placeholder="Type your name…"
              maxLength={32}
              style={{
                width: "100%", padding: "12px 14px", fontSize: 16,
                borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.08)", color: "#f6f7ff", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "rgba(246,247,255,0.6)", marginBottom: 6 }}>Pick an emoji</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => setEmoji(e)} style={{
                  fontSize: 24, width: 48, height: 48, borderRadius: 12,
                  border: emoji === e ? "2px solid #ffdd75" : "2px solid rgba(255,255,255,0.10)",
                  background: emoji === e ? "rgba(255,221,117,0.15)" : "rgba(255,255,255,0.05)",
                  cursor: "pointer",
                }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <button onClick={join} disabled={!name.trim()} style={{
            width: "100%", padding: 16, fontSize: 18, fontWeight: 900,
            borderRadius: 14, border: "none",
            background: name.trim() ? "#1a3bd1" : "rgba(255,255,255,0.08)",
            color: name.trim() ? "#ffdd75" : "rgba(255,255,255,0.3)",
            cursor: name.trim() ? "pointer" : "not-allowed",
          }}>
            Join Game
          </button>
        </div>
      )}

      {/* JOINED VIEW */}
      {joined && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Status card */}
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

          {/* ── DAILY DOUBLE WAGER VIEW ── */}
          {phase === "dailyDouble" && isWagerPlayer && (
            <div className="jp-panel">
              <div style={{
                textAlign: "center", marginBottom: 16,
                fontSize: 22, fontWeight: 900, color: "#ffdd75", letterSpacing: 1,
              }}>
                DAILY DOUBLE
              </div>
              <div style={{ fontSize: 13, color: "rgba(246,247,255,0.6)", marginBottom: 6 }}>
                Enter your wager (max ${maxWager.toLocaleString()})
              </div>
              <input
                type="number"
                value={wagerInput}
                onChange={(e) => setWagerInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doWager()}
                placeholder="e.g. 500"
                min={1}
                max={maxWager}
                style={{
                  width: "100%", padding: "14px", fontSize: 24, fontWeight: 900,
                  borderRadius: 12, border: "2px solid #ffdd75",
                  background: "rgba(255,221,117,0.08)", color: "#ffdd75",
                  textAlign: "center", boxSizing: "border-box", marginBottom: 12,
                }}
              />
              <button onClick={doWager} disabled={!wagerInput} style={{
                width: "100%", padding: 16, fontSize: 18, fontWeight: 900,
                borderRadius: 14, border: "none",
                background: wagerInput ? "#ffdd75" : "rgba(255,255,255,0.08)",
                color: wagerInput ? "#000" : "rgba(255,255,255,0.3)",
                cursor: wagerInput ? "pointer" : "not-allowed",
              }}>
                Submit Wager
              </button>
            </div>
          )}

          {/* Waiting for wager (not the wager player) */}
          {phase === "dailyDouble" && !isWagerPlayer && (
            <div style={{
              textAlign: "center", color: "#ffdd75",
              fontSize: 20, fontWeight: 900, padding: "20px 0",
            }}>
              DAILY DOUBLE
              <div style={{ fontSize: 14, color: "rgba(246,247,255,0.45)", marginTop: 8, fontWeight: 400 }}>
                Waiting for wager…
              </div>
            </div>
          )}

          {/* Phase hint for board */}
          {phase === "board" && (
            <div style={{ textAlign: "center", color: "rgba(246,247,255,0.45)", fontSize: 14, padding: "8px 0" }}>
              Waiting for host to pick a clue…
            </div>
          )}

          {/* ── FINAL JAYPARDY — WAGER ── */}
          {phase === "finalWager" && inFinal && (
            <div className="jp-panel">
              <div style={{ textAlign:"center", fontSize:22, fontWeight:900, color:"#ffdd75", marginBottom:8, letterSpacing:1 }}>
                FINAL JAYPARDY
              </div>
              <div style={{ textAlign:"center", fontSize:15, fontWeight:700, color:"rgba(246,247,255,0.7)", marginBottom:16 }}>
                Category: <span style={{ color:"#fff" }}>{finalJaypardy?.category}</span>
              </div>
              {wagerLocked || myFinalWager !== null ? (
                <div style={{ textAlign:"center", padding:16 }}>
                  <div style={{ fontSize:18, fontWeight:900, color:"#21c55d", marginBottom:6 }}>Wager submitted ✅</div>
                  <div style={{ fontSize:24, fontWeight:900, color:"#ffdd75" }}>
                    ${(myFinalWager ?? parseInt(finalWager)).toLocaleString()}
                  </div>
                  <div style={{ fontSize:13, color:"rgba(246,247,255,0.45)", marginTop:8 }}>
                    Waiting for host to reveal the clue…
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:13, color:"rgba(246,247,255,0.6)", marginBottom:6 }}>
                    Your wager (max ${maxFinalWager.toLocaleString()})
                  </div>
                  <input
                    type="number"
                    value={finalWager}
                    onChange={(e) => setFinalWager(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doFinalWager()}
                    placeholder="e.g. 500"
                    min={0}
                    max={maxFinalWager}
                    style={{
                      width:"100%", padding:"14px", fontSize:24, fontWeight:900,
                      borderRadius:12, border:"2px solid #ffdd75",
                      background:"rgba(255,221,117,0.08)", color:"#ffdd75",
                      textAlign:"center", boxSizing:"border-box", marginBottom:12,
                    }}
                  />
                  <button onClick={doFinalWager} disabled={finalWager === ""} style={{
                    width:"100%", padding:16, fontSize:18, fontWeight:900,
                    borderRadius:14, border:"none",
                    background: finalWager !== "" ? "#ffdd75" : "rgba(255,255,255,0.08)",
                    color: finalWager !== "" ? "#000" : "rgba(255,255,255,0.3)",
                    cursor: finalWager !== "" ? "pointer" : "not-allowed",
                  }}>
                    Lock In Wager
                  </button>
                </>
              )}
            </div>
          )}

          {phase === "finalWager" && !inFinal && (
            <div style={{ textAlign:"center", color:"#ffdd75", fontSize:18, fontWeight:900, padding:"20px 0" }}>
              FINAL JAYPARDY
              <div style={{ fontSize:13, color:"rgba(246,247,255,0.45)", marginTop:8, fontWeight:400 }}>
                Wagering in progress…
              </div>
            </div>
          )}

          {/* ── FINAL JAYPARDY — ANSWER ── */}
          {phase === "finalClue" && inFinal && (
            <div className="jp-panel">
              <div style={{ textAlign:"center", fontSize:20, fontWeight:900, color:"#ffdd75", marginBottom:12 }}>
                FINAL JAYPARDY
              </div>
              <div style={{ fontSize:16, fontWeight:900, color:"#fff", lineHeight:1.4, marginBottom:16, textAlign:"center" }}>
                {finalJaypardy?.question}
              </div>
              {answerLocked ? (
                <div style={{ textAlign:"center", padding:12 }}>
                  <div style={{ fontSize:16, fontWeight:900, color:"#21c55d", marginBottom:6 }}>Answer submitted ✅</div>
                  <div style={{ fontSize:15, color:"rgba(246,247,255,0.7)", fontStyle:"italic" }}>
                    "{finalAnswer}"
                  </div>
                  <div style={{ fontSize:12, color:"rgba(246,247,255,0.4)", marginTop:8 }}>
                    Waiting for reveal…
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:13, color:"rgba(246,247,255,0.6)", marginBottom:6 }}>
                    Your answer (answer in the form of a question)
                  </div>
                  <input
                    value={finalAnswer}
                    onChange={(e) => setFinalAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doFinalAnswer()}
                    placeholder="Who is / What is…"
                    maxLength={200}
                    style={{
                      width:"100%", padding:"14px", fontSize:16, fontWeight:700,
                      borderRadius:12, border:"2px solid rgba(255,255,255,0.25)",
                      background:"rgba(255,255,255,0.08)", color:"#fff",
                      boxSizing:"border-box", marginBottom:12,
                    }}
                  />
                  <button onClick={doFinalAnswer} disabled={!finalAnswer.trim()} style={{
                    width:"100%", padding:16, fontSize:18, fontWeight:900,
                    borderRadius:14, border:"none",
                    background: finalAnswer.trim() ? "#1a3bd1" : "rgba(255,255,255,0.08)",
                    color: finalAnswer.trim() ? "#ffdd75" : "rgba(255,255,255,0.3)",
                    cursor: finalAnswer.trim() ? "pointer" : "not-allowed",
                  }}>
                    Submit Answer
                  </button>
                </>
              )}
            </div>
          )}

          {phase === "finalClue" && !inFinal && (
            <div style={{ textAlign:"center", color:"rgba(246,247,255,0.45)", fontSize:14, padding:"20px 0" }}>
              Final Jaypardy in progress…
            </div>
          )}

          {/* ── FINAL JAYPARDY — REVEAL ── */}
          {phase === "finalReveal" && (
            <div style={{ textAlign:"center", padding:"20px 0" }}>
              <div style={{ fontSize:20, fontWeight:900, color:"#ffdd75", marginBottom:8 }}>
                FINAL JAYPARDY
              </div>
              <div style={{ fontSize:14, color:"rgba(246,247,255,0.5)" }}>
                Host is revealing answers…
              </div>
            </div>
          )}

          {/* ── GAME OVER ── */}
          {phase === "gameOver" && (
            <div style={{ textAlign:"center", padding:"20px 0" }}>
              <div style={{ fontSize:32, fontWeight:900, color:"#ffdd75", marginBottom:8 }}>
                GAME OVER
              </div>
              <div style={{ fontSize:14, color:"rgba(246,247,255,0.5)" }}>
                Thanks for playing!
              </div>
            </div>
          )}

          {/* BUZZ BUTTON — shown during clue and dailyDoubleClue */}
          {(phase === "clue" || phase === "dailyDoubleClue") && (
            <>
              <button
                onClick={doBuzz}
                style={{
                  width: "100%", height: 280,
                  fontSize: buzzState === "won" || buzzState === "lost" ? 28 : 52,
                  fontWeight: 900, borderRadius: 24, letterSpacing: 2,
                  transition: "background 0.15s ease, transform 0.1s ease",
                  ...(btnStyles[buzzState] ?? btnStyles.idle),
                }}
              >
                {btnLabels[buzzState]}
              </button>
              <div style={{ textAlign: "center", fontSize: 12, color: "rgba(246,247,255,0.35)" }}>
                {buzzState === "idle"  && "Waiting…"}
                {buzzState === "ready" && !me?.teamId && "You need a team to buzz in"}
                {buzzState === "ready" && me?.teamId  && "Tap the moment you know!"}
                {buzzState === "won"   && "Answer out loud — host is listening"}
                {buzzState === "lost"  && "Wait for their answer…"}
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}
