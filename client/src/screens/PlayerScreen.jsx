import { useMemo, useState, useEffect, useRef } from "react";
import { socket, persistentPlayerId } from "../socket";
import "./jaypardyTheme.css";
import { playBuzz } from "../sounds";

const EMOJIS = ["😀","😎","🔥","🐝","🧠","🎯","⚡","🍕","👑","🤖",
                 "🦊","🐸","🎸","🚀","🌊","🎲","🦁","🐯","🍀","💎"];


// ─── Shape helper (used by PuzzleScreen) ─────────────────────────────────────

function ShapeIcon({ shape, color, size = 40 }) {
  const s = size, c = color;
  if (shape === "circle")   return <svg width={s} height={s}><circle cx={s/2} cy={s/2} r={s/2-2} fill={c} /></svg>;
  if (shape === "square")   return <svg width={s} height={s}><rect x={2} y={2} width={s-4} height={s-4} fill={c} rx={4} /></svg>;
  if (shape === "triangle") return <svg width={s} height={s}><polygon points={`${s/2},2 ${s-2},${s-2} 2,${s-2}`} fill={c} /></svg>;
  if (shape === "star")     return <svg width={s} height={s} viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill={c} /></svg>;
  if (shape === "diamond")  return <svg width={s} height={s}><polygon points={`${s/2},2 ${s-2},${s/2} ${s/2},${s-2} 2,${s/2}`} fill={c} /></svg>;
  if (shape === "hexagon")  return <svg width={s} height={s} viewBox="0 0 24 24"><polygon points="12,2 20,7 20,17 12,22 4,17 4,7" fill={c} /></svg>;
  return null;
}

function PuzzleScreen({ state, me, myTeam, phase, puzzleSeed, slotShapes, setSlotShapes }) {
  const clue = state?.currentClue;
  const { answer, pool } = puzzleSeed;
  const [wrongAnim, setWrongAnim] = useState(false);

  // Reset slots when puzzle seed changes (new puzzle launched)
  useEffect(() => {
    setSlotShapes([null, null, null]);
  }, [puzzleSeed]);

  // Auto-submit when all 3 slots filled
  useEffect(() => {
    if (slotShapes.every((s) => s !== null)) {
      socket.emit("player:puzzleSolved", { solution: slotShapes });
    }
  }, [slotShapes]);

  // Listen for wrong answer feedback from server
  useEffect(() => {
    const onWrong = () => {
      setWrongAnim(true);
      // Reset shapes after a short delay so player sees the red flash first
      setTimeout(() => {
        setSlotShapes([null, null, null]);
        setTimeout(() => setWrongAnim(false), 100);
      }, 600);
    };
    socket.on("puzzle:wrong", onWrong);
    return () => socket.off("puzzle:wrong", onWrong);
  }, []);

  const usedInSlots = slotShapes.filter(Boolean);
  const getShapeById = (id) => pool.find((s) => s.id === id);

  const dropOnSlot = (slotIndex, shapeId) => {
    setSlotShapes((prev) => {
      const next = [...prev];
      for (let i = 0; i < next.length; i++) {
        if (next[i] === shapeId) next[i] = null;
      }
      next[slotIndex] = shapeId;
      return next;
    });
  };

  const removeFromSlot = (slotIndex) => {
    setSlotShapes((prev) => { const next = [...prev]; next[slotIndex] = null; return next; });
  };

  const tapShape = (shapeId) => {
    if (usedInSlots.includes(shapeId)) return;
    const firstEmpty = slotShapes.findIndex((x) => x === null);
    if (firstEmpty !== -1) dropOnSlot(firstEmpty, shapeId);
  };

  return (
    <div style={{ minHeight:"100vh", paddingTop:"env(safe-area-inset-top,0px)", background:"#050a2a", color:"#f6f7ff", fontFamily:"ui-sans-serif,system-ui,sans-serif", display:"flex", flexDirection:"column" }}>
      {/* Top bar */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"calc(env(safe-area-inset-top,0px) + 14px) 18px 14px 18px", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:22 }}>{me.emoji}</div>
          <div>
            <div style={{ fontWeight:900, fontSize:15 }}>{me.name}</div>
            {myTeam && <div style={{ width:10, height:10, borderRadius:"50%", background:myTeam.color, flexShrink:0 }} />}
          </div>
        </div>
        {myTeam && <div style={{ background:myTeam.color, color:"#fff", fontWeight:900, fontSize:18, padding:"6px 14px", borderRadius:10 }}>${myTeam.score.toLocaleString()}</div>}
      </div>

      {/* Clue info */}
      {clue && (
        <div style={{ padding:"12px 18px 0", textAlign:"center" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"rgba(246,247,255,0.4)", textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>{clue.category}</div>
          <div style={{ fontSize:22, fontWeight:900, color:"#ffdd75" }}>{phase === "dailyDoubleClue" ? "Daily Double" : `$${clue.value}`}</div>
        </div>
      )}

      <div style={{ flex:1, display:"flex", flexDirection:"column", padding:"16px 20px", gap:16 }}>
        <div style={{ textAlign:"center", fontSize:13, fontWeight:700, color:"rgba(246,247,255,0.5)" }}>
          Place the 3 shapes in the correct order
        </div>

        {/* Target slots — show outline silhouette of correct answer */}
        <div style={{
          display:"flex", justifyContent:"center", gap:12,
          animation: wrongAnim ? "jp-shake 0.5s ease" : "none",
        }}>
          {[0,1,2].map((i) => {
            const filled = slotShapes[i] ? getShapeById(slotShapes[i]) : null;
            const target = answer[i];
            return (
              <div key={i}
                onClick={() => filled && removeFromSlot(i)}
                style={{ width:76, height:76, borderRadius:14,
  border: wrongAnim ? "2px solid #ef4444" : filled ? `2px solid ${filled.color}` : "2px dashed rgba(255,255,255,0.2)",
  background: wrongAnim ? "rgba(239,68,68,0.15)" : filled ? `${filled.color}20` : "rgba(255,255,255,0.03)",
  display:"flex", alignItems:"center", justifyContent:"center", cursor: filled ? "pointer" : "default", position:"relative", transition:"border 0.15s, background 0.15s" }}>
                {filled
                  ? <ShapeIcon shape={filled.shape} color={filled.color} size={48} />
                  : <ShapeIcon shape={target.shape} color="rgba(255,255,255,0.12)" size={48} />
                }
                <div style={{ position:"absolute", bottom:3, right:5, fontSize:10, fontWeight:900, color:"rgba(255,255,255,0.2)" }}>{i+1}</div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.07)" }} />
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.2)", fontWeight:700, letterSpacing:1 }}>TAP TO PLACE</div>
          <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.07)" }} />
        </div>

        {/* Shape pool */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {pool.map((s) => {
            const inSlot = usedInSlots.includes(s.id);
            return (
              <div key={s.id}
                draggable={!inSlot}
                onDragStart={(e) => { e.dataTransfer.setData("shapeId", s.id); }}
                onClick={() => tapShape(s.id)}
                style={{ height:76, borderRadius:14, border:`1px solid ${inSlot ? "rgba(255,255,255,0.05)" : s.color+"55"}`, background: inSlot ? "rgba(255,255,255,0.02)" : `${s.color}15`, display:"flex", alignItems:"center", justifyContent:"center", cursor: inSlot ? "default" : "pointer", opacity: inSlot ? 0.2 : 1, transition:"opacity 0.15s" }}>
                {!inSlot && <ShapeIcon shape={s.shape} color={s.color} size={42} />}
              </div>
            );
          })}
        </div>

        <div style={{ textAlign:"center", fontSize:11, color:"rgba(246,247,255,0.25)" }}>
          Tap a filled slot to remove a shape
        </div>
      </div>
    </div>
  );
}

export default function PlayerScreen({ state }) {
  const [name,         setName]         = useState("");
  const [emoji,        setEmoji]        = useState(EMOJIS[0]);
  const [buzzState,    setBuzzState]    = useState("idle");
  const [wagerInput,   setWagerInput]   = useState("");
  const [finalWager,   setFinalWager]   = useState("");
  const [finalAnswer,  setFinalAnswer]  = useState("");
  const [wagerLocked,  setWagerLocked]  = useState(false);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [buzzFlash,    setBuzzFlash]    = useState(false);
  const [slotShapes,   setSlotShapes]   = useState([null, null, null]); // puzzle slots
  const lostTimer  = useRef(null);
  const flashTimer = useRef(null);

  const me = useMemo(
    () => (state?.players ?? []).find((p) => p.id === socket.id),
    [state]
  );

  const myTeam = useMemo(
    () => (state?.teams ?? []).find((t) => t.id === me?.teamId),
    [me, state]
  );

  const joined        = !!me;
  const phase         = state?.phase;
  const puzzleActive  = state?.puzzleActive ?? false;
  const puzzleSeed    = state?.puzzleSeed ?? null;
  const buzzerType    = state?.buzzerType ?? "standard";
  const buzz          = state?.buzz;
  const paused        = state?.paused ?? false;
  const pauseMessage  = state?.pauseMessage ?? "";
  const finalJaypardy = state?.finalJaypardy ?? null;
  const board         = state?.board ?? null;

  const inFinal       = finalJaypardy && (persistentPlayerId in (finalJaypardy.wagers ?? {}));
  const myFinalWager  = finalJaypardy?.wagers?.[persistentPlayerId] ?? null;
  const maxFinalWager = Math.max(myTeam?.score ?? 0, 100);
  const isWagerPlayer = state?.currentClue?.wagerPlayerId === socket.id;
  const maxWager      = Math.max(myTeam?.score ?? 0, 1000);

  const allTeams     = state?.teams ?? [];
  const visibleTeams = allTeams.filter((t) =>
    (state?.players ?? []).some((p) => p.teamId === t.id)
  );

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

  // ─── Buzz state ───────────────────────────────────────────────────────────
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
      playBuzz();
      // Flash effect
      setBuzzFlash(true);
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setBuzzFlash(false), 600);
    } else {
      setBuzzState("lost");
      clearTimeout(lostTimer.current);
      lostTimer.current = setTimeout(() => {
        setBuzzState((prev) => (prev === "lost" ? "ready" : prev));
      }, 1200);
    }
  }, [phase, buzz?.locked, buzz?.playerId]);

  useEffect(() => () => {
    clearTimeout(lostTimer.current);
    clearTimeout(flashTimer.current);
  }, []);

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
  socket.emit("player:join", { name: name.trim(), emoji, playerId: persistentPlayerId });
};

  // ─── Join screen ──────────────────────────────────────────────────────────
  if (!joined) {
    return (
      <div style={{
        minHeight: "100vh", paddingTop: "env(safe-area-inset-top, 0px)", background: "#050a2a", color: "#f6f7ff",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        display: "flex", flexDirection: "column", padding: "24px 20px",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 2, color: "#ffdd75" }}>JAYPARDY</div>
          <div style={{ fontSize: 13, color: "rgba(246,247,255,0.4)", marginTop: 4 }}>Enter your name to join</div>
        </div>

        {/* Name input */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(246,247,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Your Name</div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && join()}
            placeholder="Type your name…"
            maxLength={32}
            style={{
              width: "100%", padding: "16px", fontSize: 18, fontWeight: 700,
              borderRadius: 14, border: "2px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.07)", color: "#f6f7ff",
              boxSizing: "border-box", outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => e.target.style.borderColor = "rgba(255,221,117,0.5)"}
            onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.15)"}
          />
        </div>

        {/* Emoji picker */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(246,247,255,0.5)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Pick Your Emoji</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => setEmoji(e)} style={{
                fontSize: 28, height: 56, borderRadius: 14,
                border: emoji === e ? "2px solid #ffdd75" : "2px solid rgba(255,255,255,0.08)",
                background: emoji === e ? "rgba(255,221,117,0.15)" : "rgba(255,255,255,0.04)",
                cursor: "pointer",
                transform: emoji === e ? "scale(1.1)" : "scale(1)",
                transition: "transform 0.1s, border-color 0.1s",
              }}>
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Join button */}
        <button
          onClick={join}
          disabled={!name.trim()}
          style={{
            width: "100%", padding: 18, fontSize: 20, fontWeight: 900,
            borderRadius: 16, border: "none",
            background: name.trim() ? "#ffdd75" : "rgba(255,255,255,0.08)",
            color: name.trim() ? "#000" : "rgba(255,255,255,0.3)",
            cursor: name.trim() ? "pointer" : "not-allowed",
            transition: "background 0.15s",
          }}
        >
          Join Game
        </button>
      </div>
    );
  }

  // ─── Pause overlay ────────────────────────────────────────────────────────
  if (paused) {
    return (
      <div style={{
        minHeight: "100vh", paddingTop: "env(safe-area-inset-top, 0px)", background: "#050a2a",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 20, padding: 32, textAlign: "center",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}>
        <div style={{ fontSize: 72, lineHeight: 1 }}>⏸</div>
        <div style={{ fontSize: "clamp(24px, 6vw, 36px)", fontWeight: 900, color: "#ffdd75", lineHeight: 1.2 }}>
          {pauseMessage || "Stand By"}
        </div>
        <div style={{ fontSize: 14, color: "rgba(246,247,255,0.4)", fontWeight: 700 }}>
          Game paused — host will resume shortly
        </div>
      </div>
    );
  }

  // ─── Buzz screen (standard) or puzzle screen ────────────────────────────────
  if (phase === "clue" || phase === "dailyDoubleClue") {
    // Puzzle mode active — show puzzle UI
    if (puzzleActive && puzzleSeed) {
      return <PuzzleScreen state={state} me={me} myTeam={myTeam} phase={phase}
        puzzleSeed={puzzleSeed} slotShapes={slotShapes} setSlotShapes={setSlotShapes} />;
    }
    // Puzzle mode selected but not yet launched — show waiting screen, no buzz button
    if (buzzerType === "puzzle") {
      const clue = state?.currentClue;
      return (
        <div style={{ minHeight:"100vh", paddingTop:"env(safe-area-inset-top,0px)", background:"#050a2a", color:"#f6f7ff", fontFamily:"ui-sans-serif,system-ui,sans-serif", display:"flex", flexDirection:"column" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"calc(env(safe-area-inset-top,0px) + 14px) 18px 14px 18px", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ fontSize:22 }}>{me.emoji}</div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ fontWeight:900, fontSize:15 }}>{me.name}</div>
                {myTeam && <div style={{ width:10, height:10, borderRadius:"50%", background:myTeam.color, flexShrink:0 }} />}
              </div>
            </div>
            {myTeam && <div style={{ background:myTeam.color, color:"#fff", fontWeight:900, fontSize:18, padding:"6px 14px", borderRadius:10 }}>${myTeam.score.toLocaleString()}</div>}
          </div>
          {clue && (
            <div style={{ padding:"12px 18px 0", textAlign:"center" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"rgba(246,247,255,0.4)", textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>{clue.category}</div>
              <div style={{ fontSize:22, fontWeight:900, color:"#ffdd75" }}>{phase === "dailyDoubleClue" ? "Daily Double" : `$${clue.value}`}</div>
            </div>
          )}
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, padding:32, textAlign:"center" }}>
            <div style={{ fontSize:48 }}>🧩</div>
            <div style={{ fontSize:18, fontWeight:900, color:"rgba(246,247,255,0.6)" }}>Get ready…</div>
            <div style={{ fontSize:14, color:"rgba(246,247,255,0.35)" }}>Host will launch the puzzle when ready</div>
          </div>
        </div>
      );
    }
    const clue = state?.currentClue;
    const buzzColors = {
      idle:  { bg: "#0d1117", border: "rgba(255,255,255,0.08)", text: "rgba(255,255,255,0.2)" },
      ready: { bg: "#1a3bd1", border: "rgba(100,140,255,0.6)",  text: "#ffdd75" },
      won:   { bg: "#15803d", border: "rgba(74,222,128,0.8)",   text: "#ffffff" },
      lost:  { bg: "#991b1b", border: "rgba(252,165,165,0.6)",  text: "#ffffff" },
    };
    const bc = buzzColors[buzzState] ?? buzzColors.idle;
    const buzzLabels = { idle: "BUZZ IN", ready: "BUZZ IN", won: "YOU GOT IT!", lost: "TOO SLOW" };

    return (
      <div style={{
        minHeight: "100vh", paddingTop: "env(safe-area-inset-top, 0px)", background: "#050a2a", color: "#f6f7ff",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        display: "flex", flexDirection: "column",
      }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "calc(env(safe-area-inset-top, 0px) + 14px) 18px 14px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 22 }}>{me.emoji}</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15 }}>{me.name}</div>
              {myTeam && <div style={{ width:10, height:10, borderRadius:"50%", background:myTeam.color, flexShrink:0 }} />}
            </div>
          </div>
          {myTeam && (
            <div style={{ background: myTeam.color, color: "#fff", fontWeight: 900, fontSize: 18, padding: "6px 14px", borderRadius: 10 }}>
              ${myTeam.score.toLocaleString()}
            </div>
          )}
        </div>

        {/* Category + value */}
        {clue && (
          <div style={{ padding: "16px 18px 0", textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(246,247,255,0.4)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
              {clue.category}
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#ffdd75" }}>
              {phase === "dailyDoubleClue"
                ? `Daily Double — $${state?.wager?.amount?.toLocaleString() ?? "?"}`
                : `$${clue.value}`
              }
            </div>
          </div>
        )}

        {/* Buzz button — takes up most of the screen */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 20px 32px" }}>
          <button
            onClick={doBuzz}
            className={buzzState === "ready" ? "jp-buzz-ready" : ""}
            style={{
              width: "100%", flex: 1, maxHeight: 320,
              fontSize: buzzState === "won" || buzzState === "lost" ? 32 : 56,
              fontWeight: 900, borderRadius: 28, letterSpacing: 2,
              border: `3px solid ${bc.border}`,
              background: buzzState === "ready"
                ? "linear-gradient(180deg, #1e4ae0 0%, #1232b0 100%)"
                : bc.bg,
              color: bc.text,
              cursor: buzzState === "ready" ? "pointer" : "not-allowed",
              transition: "background 0.1s ease, transform 0.08s ease",
              transform: buzzFlash ? "scale(0.97)" : "scale(1)",
              boxShadow: buzzState === "ready"
                ? "0 4px 40px rgba(26,59,209,0.45), inset 0 1px 0 rgba(255,255,255,0.12)"
                : buzzState === "won"
                ? "0 0 40px rgba(21,128,61,0.5)"
                : "none",
            }}
          >
            {buzzLabels[buzzState]}
          </button>

          <div style={{ marginTop: 14, fontSize: 13, color: "rgba(246,247,255,0.35)", textAlign: "center", fontWeight: 600 }}>
            {buzzState === "idle"  && "Waiting for clue…"}
            {buzzState === "ready" && !me?.teamId && "You need a team to buzz in"}
            {buzzState === "ready" && me?.teamId  && "Tap the moment you know the answer!"}
            {buzzState === "won"   && "Say your answer out loud!"}
            {buzzState === "lost"  && "Wait for their answer…"}
          </div>
        </div>
      </div>
    );
  }

  // ─── Daily Double wager screen ────────────────────────────────────────────
  if (phase === "dailyDouble") {
    return (
      <div style={{ minHeight: "100vh", paddingTop: "env(safe-area-inset-top, 0px)", background: "#050a2a", color: "#f6f7ff", fontFamily: "ui-sans-serif, system-ui, sans-serif", display: "flex", flexDirection: "column", padding: "24px 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(246,247,255,0.4)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
            {state?.currentClue?.category}
          </div>
          <div style={{ fontSize: 40, fontWeight: 900, color: "#ffdd75", letterSpacing: -1 }}>Daily Double</div>
        </div>

        {isWagerPlayer ? (
          <>
            <div style={{ fontSize: 14, color: "rgba(246,247,255,0.6)", marginBottom: 8 }}>
              Your wager — max <span style={{ color: "#ffdd75", fontWeight: 900 }}>${maxWager.toLocaleString()}</span>
            </div>
            <input
              autoFocus type="number" value={wagerInput}
              onChange={(e) => setWagerInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doWager()}
              placeholder="Enter amount…" min={1} max={maxWager}
              style={{ width: "100%", padding: "18px", fontSize: 28, fontWeight: 900, borderRadius: 14, border: "2px solid rgba(255,221,117,0.4)", background: "rgba(255,221,117,0.07)", color: "#ffdd75", textAlign: "center", boxSizing: "border-box", marginBottom: 16, outline: "none" }}
            />
            <button onClick={doWager} disabled={!wagerInput}
              style={{ width: "100%", padding: 18, fontSize: 18, fontWeight: 900, borderRadius: 14, border: "none", background: wagerInput ? "#ffdd75" : "rgba(255,255,255,0.08)", color: wagerInput ? "#000" : "rgba(255,255,255,0.3)", cursor: wagerInput ? "pointer" : "not-allowed" }}>
              Lock In Wager
            </button>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(246,247,255,0.4)", fontSize: 15, textAlign: "center" }}>
            Another player is entering their wager…
          </div>
        )}
      </div>
    );
  }

  // ─── Lobby / board / waiting screens ─────────────────────────────────────
  const renderPhaseContent = () => {
    if (phase === "lobby") {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center", padding: "0 20px" }}>
          <div style={{ fontSize: 40 }}>⏳</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#ffdd75" }}>Waiting for game to start</div>
          <div style={{ fontSize: 14, color: "rgba(246,247,255,0.4)" }}>
            {!me?.teamId ? "Host will assign you to a team" : "You're all set — waiting for host to start"}
          </div>
        </div>
      );
    }

    if (phase === "board") {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px" }}>
          {/* Scoreboard */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(246,247,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Scores</div>
            {[...visibleTeams].sort((a, b) => b.score - a.score).map((t) => {
              const isMyTeam = t.id === me?.teamId;
              const teamPlayers = (state?.players ?? []).filter((p) => p.teamId === t.id);
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, marginBottom: 8, background: isMyTeam ? `${t.color}18` : "rgba(255,255,255,0.03)", border: isMyTeam ? `1px solid ${t.color}55` : "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {teamPlayers.map((p) => (
                        <span key={p.id} style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: isMyTeam ? 900 : 600, fontSize: 14, color: isMyTeam ? t.color : "#f6f7ff" }}>
                          <span style={{ fontSize: 16 }}>{p.emoji}</span>
                          <span>{p.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: isMyTeam ? t.color : "#f6f7ff", flexShrink: 0 }}>
                    ${t.score.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ textAlign: "center", color: "rgba(246,247,255,0.3)", fontSize: 13 }}>
            Host is picking the next clue…
          </div>
        </div>
      );
    }

    if (phase === "finalWager") {
      const hasTeam = !!me?.teamId;
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#ffdd75", marginBottom: 6 }}>FINAL JAYPARDY</div>
            <div style={{ fontSize: 15, color: "rgba(246,247,255,0.7)" }}>
              Category: <span style={{ color: "#fff", fontWeight: 700 }}>{finalJaypardy?.category}</span>
            </div>
          </div>
          {!hasTeam ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(246,247,255,0.4)", fontSize: 15, textAlign: "center" }}>
              You're not on a team — sit this one out
            </div>
          ) : wagerLocked || myFinalWager !== null ? (
            <div style={{ textAlign: "center", padding: 24, background: "rgba(33,197,93,0.08)", borderRadius: 16, border: "1px solid rgba(33,197,93,0.3)" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#21c55d", marginBottom: 8 }}>Wager locked in!</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#ffdd75" }}>${(myFinalWager ?? parseInt(finalWager)).toLocaleString()}</div>
              <div style={{ fontSize: 13, color: "rgba(246,247,255,0.4)", marginTop: 10 }}>Waiting for the clue…</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 14, color: "rgba(246,247,255,0.6)", marginBottom: 8 }}>
                Your wager — max <span style={{ color: "#ffdd75", fontWeight: 900 }}>${maxFinalWager.toLocaleString()}</span>
              </div>
              <input autoFocus type="number" value={finalWager} onChange={(e) => setFinalWager(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doFinalWager()} placeholder="Enter amount…" min={0} max={maxFinalWager}
                style={{ width: "100%", padding: "18px", fontSize: 28, fontWeight: 900, borderRadius: 14, border: "2px solid rgba(255,221,117,0.4)", background: "rgba(255,221,117,0.07)", color: "#ffdd75", textAlign: "center", boxSizing: "border-box", marginBottom: 16, outline: "none" }} />
              <button onClick={doFinalWager} disabled={finalWager === ""}
                style={{ width: "100%", padding: 18, fontSize: 18, fontWeight: 900, borderRadius: 14, border: "none", background: finalWager !== "" ? "#ffdd75" : "rgba(255,255,255,0.08)", color: finalWager !== "" ? "#000" : "rgba(255,255,255,0.3)", cursor: finalWager !== "" ? "pointer" : "not-allowed" }}>
                Lock In Wager
              </button>
            </>
          )}
        </div>
      );
    }

    if (phase === "finalClue") {
      const hasTeam = !!me?.teamId;
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#ffdd75", textAlign: "center", marginBottom: 16 }}>FINAL JAYPARDY</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", lineHeight: 1.5, marginBottom: 20, textAlign: "center", padding: "16px", background: "rgba(255,255,255,0.04)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)" }}>
            {finalJaypardy?.question}
          </div>
          {answerLocked ? (
            <div style={{ textAlign: "center", padding: 20, background: "rgba(33,197,93,0.08)", borderRadius: 16, border: "1px solid rgba(33,197,93,0.3)" }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#21c55d", marginBottom: 8 }}>Answer submitted!</div>
              <div style={{ fontSize: 15, color: "rgba(246,247,255,0.7)", fontStyle: "italic" }}>"{finalAnswer}"</div>
              <div style={{ fontSize: 12, color: "rgba(246,247,255,0.4)", marginTop: 8 }}>Waiting for the reveal…</div>
            </div>
          ) : (
            <>
              <input value={finalAnswer} onChange={(e) => setFinalAnswer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doFinalAnswer()} placeholder="Type your answer…" maxLength={200}
                style={{ width: "100%", padding: "16px", fontSize: 16, fontWeight: 700, borderRadius: 14, border: "2px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.07)", color: "#fff", boxSizing: "border-box", marginBottom: 14, outline: "none" }} />
              <button onClick={doFinalAnswer} disabled={!finalAnswer.trim()}
                style={{ width: "100%", padding: 18, fontSize: 18, fontWeight: 900, borderRadius: 14, border: "none", background: finalAnswer.trim() ? "#1a3bd1" : "rgba(255,255,255,0.08)", color: finalAnswer.trim() ? "#ffdd75" : "rgba(255,255,255,0.3)", cursor: finalAnswer.trim() ? "pointer" : "not-allowed" }}>
                Submit Answer
              </button>
            </>
          )}
        </div>
      );
    }

    if (phase === "finalReveal") {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center", padding: "20px" }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#ffdd75" }}>FINAL JAYPARDY</div>
          <div style={{ fontSize: 14, color: "rgba(246,247,255,0.4)" }}>Host is revealing answers…</div>
        </div>
      );
    }

    if (phase === "gameOver") {
      const sorted = [...allTeams]
        .filter((t) => (state?.players ?? []).some((p) => p.teamId === t.id))
        .sort((a, b) => b.score - a.score);
      const myRank = sorted.findIndex((t) => t.id === me?.teamId);
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "20px", textAlign: "center" }}>
          <div style={{ fontSize:44, fontWeight:900, color:"#ffdd75", letterSpacing:-1, textShadow:"0 3px 0 rgba(0,0,0,0.3)" }}>GAME OVER</div>
          {myRank === 0 && <div style={{ fontSize:56, lineHeight:1 }}>🏆</div>}
          {myTeam && (
            <div style={{ padding:"18px 28px", borderRadius:16, background:`${myTeam.color}18`, border:`2px solid ${myTeam.color}66`, textAlign:"center", minWidth:200 }}>
              <div style={{ fontSize:13, color:"rgba(246,247,255,0.5)", marginBottom:6, fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>
                {myRank === 0 ? "🎉 Winner!" : `${myRank+1}${myRank===1?"nd":myRank===2?"rd":"th"} Place`}
              </div>
              <div style={{ fontSize:32, fontWeight:900, color:myTeam.color }}>${myTeam.score.toLocaleString()}</div>
            </div>
          )}
          {sorted.map((t, i) => i === myRank ? null : (
            <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 16px", borderRadius:10, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", width:"100%", maxWidth:280 }}>
              <span style={{ fontSize:13, color:"rgba(246,247,255,0.4)", fontWeight:700, width:24 }}>{i+1}.</span>
              <span style={{ flex:1, fontSize:13, color:"rgba(246,247,255,0.6)" }}>{players.filter((p)=>p.teamId===t.id).map((p)=>p.name).join(", ")}</span>
              <span style={{ fontSize:13, fontWeight:900, color:t.color }}>${t.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  // ─── Default layout (lobby, board, final, game over) ─────────────────────
  return (
    <div style={{
      minHeight: "100vh", paddingTop: "env(safe-area-inset-top, 0px)", background: "#050a2a", color: "#f6f7ff",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      {/* Top bar — consistent across all phases */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "calc(env(safe-area-inset-top, 0px) + 14px) 18px 14px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22 }}>{me.emoji}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>{me.name}</div>
            {myTeam && <div style={{ width: 10, height: 10, borderRadius: "50%", background: myTeam.color, flexShrink: 0 }} />}
          </div>
        </div>
        {myTeam && (
          <div style={{ background: myTeam.color, color: "#fff", fontWeight: 900, fontSize: 18, padding: "6px 14px", borderRadius: 10 }}>
            ${myTeam.score.toLocaleString()}
          </div>
        )}
      </div>

      {/* Phase content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
        {renderPhaseContent()}
      </div>
    </div>
  );
}