import { useState, useEffect, useRef } from "react";
import "./jaypardyTheme.css";
import { playDDChime, playCorrect, playWrong } from "../sounds";
import { socket } from "../socket";

export default function DisplayScreen({ state }) {
  const phase      = state?.phase;
  const board      = state?.board;
  const clue       = state?.currentClue;
  const buzz       = state?.buzz;
  const teams      = state?.teams ?? [];
  const players    = state?.players ?? [];
  const paused       = state?.paused ?? false;
  const pauseMessage = state?.pauseMessage ?? "";
  const introIndex   = state?.introIndex ?? -1;

  const [revealAnswer, setRevealAnswer] = useState(null);
  const [wrongFlash,   setWrongFlash]   = useState(null);
  const [muted,        setMuted]        = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false); // ── NEW
  const prevPhaseRef   = useRef(null);
  const prevBuzzRef    = useRef(null);
  const revealTimer    = useRef(null);
  const wrongTimer     = useRef(null);
  const ddChimeFired   = useRef(false);
  const mutedRef       = useRef(false);
  const correctFiredRef = useRef(false);

  useEffect(() => { mutedRef.current = muted; }, [muted]);

  // ── Fullscreen API ────────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.()
        ?? document.documentElement.webkitRequestFullscreen?.()
        ?? document.documentElement.mozRequestFullScreen?.()
        ?? document.documentElement.msRequestFullscreen?.();
    } else {
      document.exitFullscreen?.()
        ?? document.webkitExitFullscreen?.()
        ?? document.mozCancelFullScreen?.()
        ?? document.msExitFullscreen?.();
    }
  };

  // Track actual fullscreen state from browser events
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(
        !!(document.fullscreenElement
          || document.webkitFullscreenElement
          || document.mozFullScreenElement
          || document.msFullscreenElement)
      );
    };
    document.addEventListener("fullscreenchange",       onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    document.addEventListener("mozfullscreenchange",    onFsChange);
    document.addEventListener("MSFullscreenChange",     onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange",       onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
      document.removeEventListener("mozfullscreenchange",    onFsChange);
      document.removeEventListener("MSFullscreenChange",     onFsChange);
    };
  }, []);

  const visibleTeams = teams.filter((t) =>
    players.some((p) => p.teamId === t.id)
  );

  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));

  useEffect(() => {
    if (phase === "dailyDouble" && !ddChimeFired.current && !mutedRef.current) {
      ddChimeFired.current = true;
      playDDChime();
    }
    if (phase !== "dailyDouble") {
      ddChimeFired.current = false;
    }
  }, [phase]);

  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    const prevBuzz  = prevBuzzRef.current;
    if (
      (prevPhase === "clue" || prevPhase === "dailyDoubleClue") &&
      phase === "board" &&
      prevBuzz?.locked &&
      prevBuzz?.teamId &&
      correctFiredRef.current
    ) {
      correctFiredRef.current = false;
      const team = teamById[prevBuzz.teamId];
      setRevealAnswer({
        teamName: team?.name ?? "",
        color:    team?.color ?? "#21c55d",
        name:     prevBuzz.name,
        emoji:    prevBuzz.emoji,
      });
      clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(() => setRevealAnswer(null), 2500);
    } else {
      correctFiredRef.current = false;
    }
    prevPhaseRef.current = phase;
    prevBuzzRef.current  = buzz;
  }, [phase, buzz]);

  useEffect(() => {
    const onCue = (cue) => {
      if (cue === "correct") {
        correctFiredRef.current = true;
        if (!mutedRef.current) playCorrect();
      }
      if (cue === "wrong") {
        if (!mutedRef.current) playWrong();
      }
    };
    socket.on("sound:cue", onCue);
    return () => socket.off("sound:cue", onCue);
  }, []);

  useEffect(() => {
    const prevBuzz = prevBuzzRef.current;
    if (
      (phase === "clue" || phase === "dailyDoubleClue") &&
      prevBuzz?.locked &&
      !buzz?.locked &&
      prevBuzz?.playerId
    ) {
      const team = teamById[prevBuzz.teamId];
      setWrongFlash({
        name:  prevBuzz.name,
        emoji: prevBuzz.emoji,
        color: team?.color ?? "#ef4444",
      });
      clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => setWrongFlash(null), 1500);
    }
  }, [buzz?.locked]);

  useEffect(() => () => {
    clearTimeout(revealTimer.current);
    clearTimeout(wrongTimer.current);
  }, []);

  // ─── Score flash tracking ─────────────────────────────────────────────────
  const [flashTeams, setFlashTeams] = useState({});
  const prevScoresRef = useRef({});

  useEffect(() => {
    const newFlashes = {};
    teams.forEach((t) => {
      const prev = prevScoresRef.current[t.id];
      if (prev !== undefined && prev !== t.score) {
        newFlashes[t.id] = t.score > prev ? "positive" : "negative";
      }
      prevScoresRef.current[t.id] = t.score;
    });
    if (Object.keys(newFlashes).length > 0) {
      setFlashTeams(newFlashes);
      setTimeout(() => setFlashTeams({}), 700);
    }
  }, [teams]);

  // ─── Score strip ──────────────────────────────────────────────────────────
  const ScoreStrip = () => (
    <div style={{ position: "relative" }}>
      <div style={{
        display: "flex", gap: 10, padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(0,0,0,0.18)", flexWrap: "wrap",
        justifyContent: "center", alignItems: "center", position: "relative",
      }}>
        {visibleTeams.length === 0 ? (
          <div style={{ color: "rgba(246,247,255,0.4)", fontSize: 14 }}>No teams yet</div>
        ) : (
          visibleTeams.map((t) => {
            const teamPlayers = players.filter((p) => p.teamId === t.id);
            const names       = teamPlayers.map((p) => p.name).join(", ");
            const flash       = flashTeams[t.id];
            return (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 16px", borderRadius: 12,
                background: flash ? (flash === "positive" ? `${t.color}55` : "rgba(239,68,68,0.3)") : "rgba(0,0,0,0.25)",
                border: `1px solid ${flash ? t.color : t.color + "44"}`,
                minWidth: 140, justifyContent: "center",
                transition: "background 0.15s ease, border 0.15s ease",
              }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                <div style={{ fontWeight: 700, fontSize: 15, color: "#f6f7ff" }}>{names || t.name}</div>
                <div style={{
                  background: t.color, color: "#fff", fontWeight: 900, fontSize: 16,
                  padding: "3px 10px", borderRadius: 8, minWidth: 52, textAlign: "center",
                  transform: flash ? "scale(1.12)" : "scale(1)", transition: "transform 0.15s ease",
                }}>
                  ${t.score.toLocaleString()}
                </div>
              </div>
            );
          })
        )}

        {/* ── Right side controls: mute + fullscreen ── */}
        <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 6 }}>
          {/* Mute button */}
          <button
            onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
            title={muted ? "Unmute sound" : "Mute sound"}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8, color: muted ? "rgba(246,247,255,0.3)" : "rgba(246,247,255,0.7)",
              fontSize: 16, width: 32, height: 32, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            {muted ? "🔇" : "🔊"}
          </button>

          {/* ── NEW: Fullscreen button ── */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
            title={isFullscreen ? "Exit fullscreen" : "Go fullscreen"}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8, color: "rgba(246,247,255,0.7)",
              fontSize: 14, width: 32, height: 32, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            {isFullscreen ? "⛶" : "⛶"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Pause overlay ─────────────────────────────────────────────────────────
  if (paused) {
    return (
      <div className="jp-root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <ScoreStrip />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: "clamp(64px, 12vw, 120px)", lineHeight: 1 }}>⏸</div>
          <div style={{ fontSize: "clamp(32px, 6vw, 64px)", fontWeight: 900, color: "#ffffff", lineHeight: 1.2, maxWidth: 700 }}>
            {pauseMessage || "Stand By"}
          </div>
          <div style={{ fontSize: "clamp(14px, 2vw, 20px)", color: "rgba(246,247,255,0.4)", fontWeight: 700 }}>
            Game paused — host will resume shortly
          </div>
        </div>
      </div>
    );
  }

  // ─── Correct answer reveal overlay ───────────────────────────────────────
  if (revealAnswer) {
    return (
      <div className="jp-root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <ScoreStrip />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: revealAnswer.color, marginBottom: 16, letterSpacing: 1 }}>
            {revealAnswer.emoji} {revealAnswer.name}
            
          </div>
          <div style={{ fontSize: 72, fontWeight: 900, color: "#21c55d", lineHeight: 1 }}>CORRECT!</div>
        </div>
      </div>
    );
  }

  // ─── Daily Double splash ──────────────────────────────────────────────────
  if (phase === "dailyDouble") {
    return (
      <div className="jp-root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <ScoreStrip />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 40, gap: 24 }}>
          <div style={{ fontSize: "clamp(16px, 3vw, 22px)", fontWeight: 700, color: "rgba(246,247,255,0.5)", letterSpacing: 4, textTransform: "uppercase" }}>{clue?.category}</div>
          <div style={{ fontSize: "clamp(64px, 12vw, 140px)", fontWeight: 900, color: "#ffdd75", lineHeight: 1, letterSpacing: -2, textShadow: "0 4px 0 rgba(0,0,0,0.4)" }}>DAILY</div>
          <div style={{ fontSize: "clamp(64px, 12vw, 140px)", fontWeight: 900, color: "#ffdd75", lineHeight: 1, letterSpacing: -2, textShadow: "0 4px 0 rgba(0,0,0,0.4)" }}>DOUBLE</div>
          <div style={{ marginTop: 16, fontSize: 18, color: "rgba(246,247,255,0.45)", fontWeight: 700 }}>Waiting for wager…</div>
        </div>
      </div>
    );
  }

  // ─── Full screen clue view ────────────────────────────────────────────────
  if ((phase === "clue" || phase === "dailyDoubleClue") && clue) {
    const buzzer      = buzz?.locked ? buzz : null;
    const buzzerTeam  = buzzer ? teamById[buzzer.teamId] : null;
    const isMediaClue = !!clue.mediaUrl && clue.mediaType === "image";

    return (
      <div className="jp-root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <ScoreStrip />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: isMediaClue ? "20px 32px" : 40 }}>
          <div style={{ textAlign: "center", marginBottom: isMediaClue ? 16 : 32 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "rgba(246,247,255,0.5)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>{clue.category}</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "#ffdd75" }}>
              {phase === "dailyDoubleClue" ? `Daily Double — $${state.wager?.amount?.toLocaleString() ?? "?"}` : `$${clue.value}`}
            </div>
          </div>

          {isMediaClue ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={clue.mediaUrl} alt="clue"
                style={{ maxWidth: "100%", maxHeight: "clamp(280px, 52vh, 560px)", borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.5)", objectFit: "contain" }} />
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <div style={{ fontSize: "clamp(28px, 5vw, 64px)", fontWeight: 900, lineHeight: 1.3, color: "#ffffff", maxWidth: 900 }}>{clue.question}</div>
            </div>
          )}

          {wrongFlash && (
            <div style={{ textAlign: "center", padding: "16px 24px", borderRadius: 16, background: "rgba(239,68,68,0.20)", border: "1px solid rgba(239,68,68,0.45)", marginBottom: 16, fontSize: 22, fontWeight: 900, color: "#fca5a5" }}>
              {wrongFlash.emoji} {wrongFlash.name} — WRONG
            </div>
          )}
          {buzzer ? (
            <div style={{ textAlign: "center", padding: "20px 32px", borderRadius: 20, background: `${buzzerTeam?.color ?? "#ffdd75"}22`, border: `2px solid ${buzzerTeam?.color ?? "#ffdd75"}`, fontSize: 32, fontWeight: 900, color: buzzerTeam?.color ?? "#ffdd75", letterSpacing: 0.5 }}>
              {buzzer.emoji} {buzzer.name}
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "rgba(246,247,255,0.3)", fontSize: 18, fontWeight: 700, letterSpacing: 1, padding: "16px 0" }}>BUZZ IN…</div>
          )}
        </div>
      </div>
    );
  }

  // ─── Final Jaypardy — Wager phase ────────────────────────────────────────
  if (phase === "finalWager" && state?.finalJaypardy) {
    const fj = state.finalJaypardy;
    const submitted = Object.values(fj.wagers).filter((w) => w !== null).length;
    const total     = Object.keys(fj.wagers).length;
    return (
      <div className="jp-root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <ScoreStrip />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center", gap: 24 }}>
          <div style={{ fontSize: "clamp(48px, 10vw, 96px)", fontWeight: 900, color: "#ffdd75", lineHeight: 1, letterSpacing: -2 }}>FINAL</div>
          <div style={{ fontSize: "clamp(48px, 10vw, 96px)", fontWeight: 900, color: "#ffdd75", lineHeight: 1, letterSpacing: -2 }}>JAYPARDY</div>
          <div style={{ fontSize: "clamp(18px, 3vw, 28px)", fontWeight: 700, color: "#fff", marginTop: 8 }}>
            Category: <span style={{ color: "#ffdd75" }}>{fj.category}</span>
          </div>
          <div style={{ fontSize: 18, color: "rgba(246,247,255,0.5)", fontWeight: 700 }}>{submitted} / {total} wagers submitted</div>
        </div>
      </div>
    );
  }

  // ─── Final Jaypardy — Clue phase ─────────────────────────────────────────
  if (phase === "finalClue" && state?.finalJaypardy) {
    const fj = state.finalJaypardy;
    const submitted = Object.values(fj.answers).filter((a) => a !== null && a !== "").length;
    const total     = Object.keys(fj.answers).length;
    return (
      <div className="jp-root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <ScoreStrip />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 40 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "rgba(246,247,255,0.5)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
              Final Jaypardy — {fj.category}
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <div style={{ fontSize: "clamp(28px, 5vw, 64px)", fontWeight: 900, lineHeight: 1.3, color: "#fff", maxWidth: 900 }}>{fj.question}</div>
          </div>
          <div style={{ textAlign: "center", color: "rgba(246,247,255,0.4)", fontSize: 16, fontWeight: 700, padding: "16px 0" }}>{submitted} / {total} answers submitted</div>
        </div>
      </div>
    );
  }

  // ─── Final Jaypardy — Reveal phase ───────────────────────────────────────
  if (phase === "finalReveal" && state?.finalJaypardy) {
    const fj       = state.finalJaypardy;
    const revealed = fj.revealed ?? [];
    return (
      <div className="jp-root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <ScoreStrip />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 32, gap: 16 }}>
          <div style={{ textAlign: "center", fontSize: 28, fontWeight: 900, color: "#ffdd75", marginBottom: 8 }}>FINAL JAYPARDY — REVEAL</div>
          {revealed.map((pid) => {
            const p      = players.find((x) => x.id === pid);
            const team   = teams.find((t) => t.id === p?.teamId);
            const wager  = fj.wagers[pid];
            const answer = fj.answers[pid];
            return (
              <div key={pid} style={{ padding: "16px 20px", borderRadius: 14, background: `${team?.color ?? "#1a3bd1"}22`, border: `2px solid ${team?.color ?? "#1a3bd1"}`, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 32 }}>{p?.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: 20, color: team?.color ?? "#ffdd75" }}>{p?.name}</div>
                  <div style={{ fontSize: 16, color: "#fff", marginTop: 4, fontStyle: answer ? "normal" : "italic", opacity: answer ? 1 : 0.5 }}>{answer || "No answer"}</div>
                </div>
                <div style={{ background: team?.color ?? "#ffdd75", color: "#fff", fontWeight: 900, fontSize: 18, padding: "6px 14px", borderRadius: 8 }}>
                  Wager: ${wager?.toLocaleString() ?? "?"}
                </div>
              </div>
            );
          })}
          {revealed.length === 0 && (
            <div style={{ textAlign: "center", color: "rgba(246,247,255,0.4)", fontSize: 16, marginTop: 40 }}>Host will reveal players one by one…</div>
          )}
        </div>
      </div>
    );
  }

  // ─── Game Over ────────────────────────────────────────────────────────────
  if (phase === "gameOver") {
    const sorted = [...teams].filter((t) => players.some((p) => p.teamId === t.id)).sort((a, b) => b.score - a.score);
    return (
      <div className="jp-root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <ScoreStrip />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 20, textAlign: "center" }}>
          <div style={{ fontSize: "clamp(48px, 8vw, 80px)", fontWeight: 900, color: "#ffdd75", lineHeight: 1 }}>GAME OVER</div>
          {sorted.map((t, i) => {
            const teamPlayers = players.filter((p) => p.teamId === t.id);
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 28px", borderRadius: 16, background: i === 0 ? "rgba(255,221,117,0.15)" : "rgba(255,255,255,0.04)", border: i === 0 ? "2px solid rgba(255,221,117,0.5)" : "1px solid rgba(255,255,255,0.10)", width: "100%", maxWidth: 500 }}>
                <div style={{ fontSize: 32, width: 48 }}>{i === 0 ? "🏆" : `${i+1}.`}</div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontWeight: 900, color: i === 0 ? "#ffdd75" : "#f6f7ff", fontSize: "clamp(18px,3vw,26px)" }}>{teamPlayers.map((p) => p.name).join(", ")}</div>
                </div>
                <div style={{ background: t.color, color: "#fff", fontWeight: 900, fontSize: 22, padding: "6px 16px", borderRadius: 10 }}>${t.score.toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Introducing categories ──────────────────────────────────────────────
  if (phase === "introducing" && board) {
    const totalCats = board.columns.length;
    // allRevealed = true only AFTER all 6 have been shown (index goes past the last)
    // When index === totalCats-1 we still show the last category full screen
    const allRevealed = introIndex >= totalCats;
    const currentCat = introIndex >= 0 && introIndex < totalCats ? board.columns[introIndex] : null;

    // Before any category is revealed — show a "get ready" screen
    if (introIndex < 0) {
      return (
        <div className="jp-root" style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
          <ScoreStrip />
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", gap:24, padding:40 }}>
            <div style={{ fontSize:"clamp(48px,10vw,96px)", fontWeight:900, color:"#ffdd75", lineHeight:1, letterSpacing:-2 }}>JAYPARDY</div>
            <div style={{ fontSize:"clamp(16px,3vw,24px)", color:"rgba(246,247,255,0.5)", fontWeight:700 }}>Get ready — categories coming up</div>
          </div>
        </div>
      );
    }

    // All revealed — show full board
    if (allRevealed) {
      return (
        <div className="jp-root" style={{ minHeight:"100vh" }}>
          <ScoreStrip />
          <div style={{ padding:12 }}>
            <div className="jp-boardGrid">
              {board.columns.map((col, colIndex) => (
                <div className="jp-col" key={colIndex}>
                  <div className="jp-cat">{col.title}</div>
                  {col.clues.map((c, rowIndex) => (
                    <div key={`${colIndex}-${rowIndex}`} className="jp-cell"
                      style={{ opacity:1, cursor:"default", fontWeight:900 }}>
                      ${c.value}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // A category is being revealed — show it FULL SCREEN
    return (
      <div className="jp-root" style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
        <ScoreStrip />
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"40px 32px", gap:20 }}>

          {/* Category number */}
          <div style={{ fontSize:"clamp(14px,2vw,18px)", fontWeight:700, color:"rgba(246,247,255,0.4)", letterSpacing:3, textTransform:"uppercase" }}>
            Category {introIndex + 1} of {totalCats}
          </div>

          {/* Big category name */}
          <div style={{
            fontSize:"clamp(48px,9vw,100px)",
            fontWeight:900,
            color:"#ffdd75",
            lineHeight:1.1,
            letterSpacing:-1,
            textShadow:"0 4px 0 rgba(0,0,0,0.4)",
            maxWidth:900,
          }}>
            {currentCat.title}
          </div>

          {/* Dots showing progress */}
          <div style={{ display:"flex", gap:10, marginTop:16 }}>
            {board.columns.map((_, i) => (
              <div key={i} style={{
                width: i === introIndex ? 28 : 10,
                height:10,
                borderRadius:5,
                background: i < introIndex ? "rgba(255,221,117,0.6)" : i === introIndex ? "#ffdd75" : "rgba(255,255,255,0.12)",
                transition:"all 0.3s ease",
              }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Board view ───────────────────────────────────────────────────────────
  return (
    <div className="jp-root" style={{ minHeight: "100vh" }}>
      <ScoreStrip />
      <div style={{ padding: 12 }}>
        {!board ? (
          <div style={{ textAlign: "center", color: "rgba(246,247,255,0.4)", fontSize: 18, marginTop: 60 }}>
            Waiting for host to start the game…
          </div>
        ) : (
          <div className="jp-boardGrid">
            {board.columns.map((col, colIndex) => (
              <div className="jp-col" key={colIndex}>
                <div className="jp-cat">{col.title}</div>
                {col.clues.map((c, rowIndex) => (
                  <div key={`${colIndex}-${rowIndex}`} className="jp-cell"
                    style={{ opacity: c.used ? 0.2 : 1, cursor: "default", fontWeight: 900 }}>
                    {!c.used ? `$${c.value}` : ""}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}