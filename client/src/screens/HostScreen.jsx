import { useMemo, useState, useEffect } from "react";
import { socket } from "../socket";
import "./jaypardyTheme.css";
import { playBuzz, playCorrect, playWrong, playDDChime, volumes, setVolume } from "../sounds";

const ALL_CATEGORIES = [
  "90s Disney Princess","The Office (US)","iCarly","3rd Grade US Geography",
  "General Knowledge","Famous Scientists","Food & Cooking","Sports Records",
  "Pop Music 2010s","TikTok Gen Pop","Pop Culture 2000s","Pop Culture 2010s",
  "Internet & Memes","Drinks","Fast Food","NBA Basketball","NFL Football",
  "MLB Baseball","Music: 90s Hits","Music: 2000s Hits","Music: 2010s Hits",
  "90s Movies","2000s Movies","Reality TV","Iconic TV Shows","Social Media",
  "Video Games",
];

export default function HostScreen({ state }) {
  const [confirmReset,  setConfirmReset]  = useState(false);
  const [confirmSkip,   setConfirmSkip]   = useState(false);
  const [swapMenu,      setSwapMenu]      = useState(null);
  const [showFinalSetup,   setShowFinalSetup]   = useState(false);
  const [finalCategory,    setFinalCategory]    = useState(ALL_CATEGORIES[0]);
  const [finalSearch,      setFinalSearch]      = useState("");
  const [swapSearch,       setSwapSearch]       = useState("");
  const [showHistory,      setShowHistory]      = useState(false);
  const [showSounds,       setShowSounds]       = useState(false);
  const [soundVols,        setSoundVols]        = useState({ ...volumes });

  const handleVolChange = (key, val) => {
    const num = parseFloat(val);
    setVolume(key, num);
    setSoundVols((prev) => ({ ...prev, [key]: num }));
  };

  // ─── Theme state ──────────────────────────────────────────────────────────
  const [showSaveTheme,  setShowSaveTheme]  = useState(false);
  const [showLoadTheme,  setShowLoadTheme]  = useState(false);
  const [themeName,      setThemeName]      = useState("");
  const [themeSearch,    setThemeSearch]    = useState("");
  const [savedThemes,    setSavedThemes]    = useState({});

  // Listen for themes from server
  useEffect(() => {
    const onThemes = (themes) => setSavedThemes(themes);
    socket.on("themes:update", onThemes);
    socket.emit("host:getThemes");
    return () => socket.off("themes:update", onThemes);
  }, []);

  const saveTheme = () => {
    if (!themeName.trim() || !board) return;
    const cats = board.columns.map((c) => c.title);
    socket.emit("host:saveTheme", { name: themeName.trim(), categories: cats });
    setThemeName("");
    setShowSaveTheme(false);
  };

  const loadTheme = (name) => {
    const cats = savedThemes[name];
    if (!cats) return;
    socket.emit("host:loadTheme", { categories: cats });
    setShowLoadTheme(false);
    setThemeSearch("");
  };

  const deleteTheme = (name) => {
    socket.emit("host:deleteTheme", { name });
  };

  const players      = state?.players ?? [];
  const teams        = state?.teams ?? [];
  const buzz         = state?.buzz ?? { locked: false };
  const board        = state?.board ?? null;
  const clue         = state?.currentClue ?? null;
  const phase        = state?.phase ?? "lobby";

  // All category names currently on the board
  const boardCategories = useMemo(() =>
    board?.columns.map((c) => c.title) ?? [],
  [board]);

  const availableCategories = ALL_CATEGORIES.filter(
    (cat) => !boardCategories.includes(cat)
  );

  const handleCatRightClick = (e, colIndex) => {
    if (!board || phase !== "board") return;
    e.preventDefault();
    setSwapMenu({ colIndex });
  };

  const doSwap = (newCategory) => {
    if (!swapMenu) return;
    socket.emit("host:swapCategory", { colIndex: swapMenu.colIndex, newCategory });
    setSwapMenu(null);
  };

  const teamById = useMemo(() => {
    const m = {};
    teams.forEach((t) => { m[t.id] = t; });
    return m;
  }, [teams]);

  const assignedPlayers   = players.filter((p) => p.teamId);
  const unassignedPlayers = players.filter((p) => !p.teamId);

  const visibleTeams = teams.filter((t) =>
    players.some((p) => p.teamId === t.id)
  );

  const buzzerTeam = buzz.locked ? teamById[buzz.teamId] : null;

  const isClueActive = phase === "clue" || phase === "dailyDoubleClue";
  const isDDWager    = phase === "dailyDouble";

  // Round 2 only available when every clue on the board is used
  const boardComplete = useMemo(() => {
    if (!board) return false;
    return board.columns.every((col) => col.clues.every((c) => c.used));
  }, [board]);

  // Only show Round 2 if we're in round 1 and board is done
  const canStartRound2 = boardComplete && board?.round === 1 && phase === "board";

  // Final Jaypardy
  const finalJaypardy = state?.finalJaypardy ?? null;
  const isFinal = ["finalWager","finalClue","finalReveal","gameOver"].includes(phase);

  const canStartFinal = boardComplete && board?.round === 2 && phase === "board";

  // DD picking mode
  const pickingDD  = state?.pickingDD ?? false;
  const ddPicked   = state?.ddPicked ?? 0;
  const ddNeeded   = board?.round === 2 ? 2 : 1;
  const canPickDD  = phase === "board" && !!board;

  // Game log
  const gameLog = state?.gameLog ?? [];

  // Count submitted wagers
  const wagerCount = finalJaypardy
    ? Object.values(finalJaypardy.wagers).filter((w) => w !== null).length
    : 0;
  const totalWagers = finalJaypardy
    ? Object.keys(finalJaypardy.wagers).length
    : 0;

  // Count submitted answers
  const answerCount = finalJaypardy
    ? Object.values(finalJaypardy.answers).filter((a) => a !== null && a !== "").length
    : 0;

  // ─── Score strip ──────────────────────────────────────────────────────────
  const ScoreStrip = () => (
    <div style={{
      display:      "flex",
      gap:          8,
      padding:      "10px 14px",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      background:   "rgba(0,0,0,0.18)",
      flexWrap:     "wrap",
    }}>
      {visibleTeams.length === 0 ? (
        <div style={{ color: "rgba(246,247,255,0.4)", fontSize: 13 }}>
          No teams yet — players will appear after joining
        </div>
      ) : (
        visibleTeams.map((t) => {
          const teamPlayers = players.filter((p) => p.teamId === t.id);
          const names       = teamPlayers.map((p) => p.name).join(", ");
          return (
            <div key={t.id} style={{
              display:      "flex",
              alignItems:   "center",
              gap:          8,
              padding:      "6px 12px",
              borderRadius: 10,
              background:   "rgba(0,0,0,0.22)",
              border:       `1px solid ${t.color}44`,
              flex:         1,
              minWidth:     120,
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: t.color, flexShrink: 0,
              }} />
              <div style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>
                {names || t.name}
              </div>
              <div style={{
                background:   t.color,
                color:        "#fff",
                fontWeight:   900,
                fontSize:     14,
                padding:      "2px 8px",
                borderRadius: 6,
              }}>
                ${t.score.toLocaleString()}
              </div>
              <button
                onClick={() => socket.emit("host:adjustScore", { teamId: t.id, delta: 100 })}
                style={{ ...adjBtn }}
              >+</button>
              <button
                onClick={() => socket.emit("host:adjustScore", { teamId: t.id, delta: -100 })}
                style={{ ...adjBtn }}
              >−</button>
            </div>
          );
        })
      )}
    </div>
  );

  // ─── Main area: Board or Clue ─────────────────────────────────────────────
  const MainArea = () => {

    // ── Final Jaypardy — Wager phase ──
    if (phase === "finalWager" && finalJaypardy) {
      return (
        <div style={{ flex:1, display:"flex", flexDirection:"column", padding:24, gap:16 }}>
          <div style={{ fontSize:28, fontWeight:900, color:"#ffdd75", textAlign:"center", letterSpacing:1 }}>
            FINAL JAYPARDY
          </div>
          <div style={{ textAlign:"center", fontSize:20, fontWeight:700, color:"#fff" }}>
            Category: <span style={{ color:"#ffdd75" }}>{finalJaypardy.category}</span>
          </div>
          <div style={{
            padding:"12px 16px", borderRadius:10,
            background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
            textAlign:"center", color:"rgba(246,247,255,0.5)", fontSize:14,
          }}>
            Players are entering their wagers privately on their phones
          </div>
          <div style={{ textAlign:"center", fontSize:18, fontWeight:700, color:"#21c55d" }}>
            {wagerCount} / {totalWagers} wagers submitted
          </div>
          <button
            className="jp-btn"
            style={{ background:"rgba(255,221,117,0.15)", borderColor:"rgba(255,221,117,0.4)", color:"#ffdd75", fontSize:16, padding:16 }}
            onClick={() => socket.emit("host:revealFinalClue")}
          >
            Reveal Clue →
          </button>
        </div>
      );
    }

    // ── Final Jaypardy — Clue phase ──
    if (phase === "finalClue" && finalJaypardy) {
      return (
        <div style={{ flex:1, display:"flex", flexDirection:"column", padding:24, gap:16 }}>
          <div style={{ fontSize:22, fontWeight:900, color:"#ffdd75", textAlign:"center" }}>
            FINAL JAYPARDY — {finalJaypardy.category}
          </div>
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", textAlign:"center" }}>
            <div style={{ fontSize:"clamp(20px, 3vw, 32px)", fontWeight:900, color:"#fff", lineHeight:1.35 }}>
              {finalJaypardy.question}
            </div>
          </div>
          <div style={{ padding:"12px 16px", borderRadius:10, background:"rgba(255,221,117,0.10)", border:"1px solid rgba(255,221,117,0.25)" }}>
            <div style={{ fontSize:11, color:"rgba(246,247,255,0.45)", marginBottom:4, fontWeight:700, letterSpacing:0.5 }}>ANSWER</div>
            <div style={{ fontWeight:900, color:"#ffdd75", fontSize:18 }}>{finalJaypardy.answer}</div>
          </div>
          <div style={{ textAlign:"center", fontSize:16, fontWeight:700, color:"#21c55d" }}>
            {answerCount} / {totalWagers} answers submitted
          </div>
          <button
            className="jp-btn"
            style={{ background:"rgba(255,221,117,0.15)", borderColor:"rgba(255,221,117,0.4)", color:"#ffdd75", fontSize:16, padding:16 }}
            onClick={() => socket.emit("host:startFinalReveal")}
          >
            Start Reveal →
          </button>
        </div>
      );
    }

    // ── Final Jaypardy — Reveal phase ──
    if (phase === "finalReveal" && finalJaypardy) {
      const eligibleIds = Object.keys(finalJaypardy.wagers);
      return (
        <div style={{ flex:1, display:"flex", flexDirection:"column", padding:24, gap:12 }}>
          <div style={{ fontSize:22, fontWeight:900, color:"#ffdd75", textAlign:"center", marginBottom:8 }}>
            FINAL JAYPARDY — REVEAL
          </div>
          {eligibleIds.map((pid) => {
            const p        = players.find((x) => x.id === pid);
            const team     = p ? teamById[p.teamId] : null;
            const wager    = finalJaypardy.wagers[pid];
            const answer   = finalJaypardy.answers[pid];
            const revealed = finalJaypardy.revealed.includes(pid);
            return (
              <div key={pid} style={{
                padding:"12px 16px", borderRadius:12,
                background: revealed ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                border: revealed
                  ? `1px solid ${team?.color ?? "rgba(255,255,255,0.2)"}`
                  : "1px solid rgba(255,255,255,0.08)",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: revealed ? 8 : 0 }}>
                  {team && <div style={{ width:8, height:8, borderRadius:"50%", background:team.color, flexShrink:0 }} />}
                  <span style={{ fontSize:16 }}>{p?.emoji}</span>
                  <span style={{ fontWeight:900, fontSize:15, flex:1 }}>{p?.name ?? pid}</span>
                  {revealed && (
                    <span style={{ fontSize:13, fontWeight:700, color:"#ffdd75" }}>
                      Wager: ${wager?.toLocaleString() ?? "?"}
                    </span>
                  )}
                  {!revealed && (
                    <button
                      className="jp-btn"
                      style={{ fontSize:12, padding:"6px 12px" }}
                      onClick={() => socket.emit("host:revealFinalAnswer", { playerId: pid })}
                    >
                      Reveal
                    </button>
                  )}
                </div>
                {revealed && (
                  <>
                    <div style={{ fontSize:15, color:"#fff", marginBottom:8, fontStyle: answer ? "normal" : "italic", opacity: answer ? 1 : 0.4 }}>
                      {answer || "No answer submitted"}
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button
                        className="jp-btn jp-btnGood"
                        style={{ flex:1, fontSize:13 }}
                        onClick={() => socket.emit("host:markFinal", { playerId: pid, correct: true })}
                      >
                        Correct +${wager?.toLocaleString()}
                      </button>
                      <button
                        className="jp-btn jp-btnBad"
                        style={{ flex:1, fontSize:13 }}
                        onClick={() => socket.emit("host:markFinal", { playerId: pid, correct: false })}
                      >
                        Wrong −${wager?.toLocaleString()}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          <button
            className="jp-btn"
            style={{ background:"rgba(239,68,68,0.12)", borderColor:"rgba(239,68,68,0.28)", color:"#fca5a5", marginTop:8 }}
            onClick={() => socket.emit("host:endGame")}
          >
            End Game
          </button>
        </div>
      );
    }

    // ── Game Over ──
    if (phase === "gameOver") {
      const sorted = [...teams]
        .filter((t) => players.some((p) => p.teamId === t.id))
        .sort((a, b) => b.score - a.score);
      return (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:40, gap:20, textAlign:"center" }}>
          <div style={{ fontSize:48, fontWeight:900, color:"#ffdd75" }}>GAME OVER</div>
          {sorted.map((t, i) => {
            const teamPlayers = players.filter((p) => p.teamId === t.id);
            return (
              <div key={t.id} style={{
                display:"flex", alignItems:"center", gap:14,
                padding:"12px 24px", borderRadius:14,
                background: i === 0 ? "rgba(255,221,117,0.15)" : "rgba(255,255,255,0.04)",
                border: i === 0 ? "2px solid rgba(255,221,117,0.5)" : "1px solid rgba(255,255,255,0.10)",
                width:"100%", maxWidth:400,
              }}>
                <div style={{ fontSize:24, fontWeight:900, color:"rgba(246,247,255,0.4)", width:32 }}>
                  {i === 0 ? "🏆" : `${i+1}.`}
                </div>
                <div style={{ flex:1, textAlign:"left" }}>
                  <div style={{ fontWeight:900, color: i === 0 ? "#ffdd75" : "#f6f7ff", fontSize:18 }}>
                    {teamPlayers.map((p) => p.name).join(", ")}
                  </div>
                  <div style={{ fontSize:12, color:"rgba(246,247,255,0.5)", marginTop:2 }}>{t.name}</div>
                </div>
                <div style={{
                  background: t.color, color:"#fff", fontWeight:900,
                  fontSize:20, padding:"4px 14px", borderRadius:8,
                }}>
                  ${t.score.toLocaleString()}
                </div>
              </div>
            );
          })}
          <button
            className="jp-btn"
            style={{ marginTop:16, background:"rgba(239,68,68,0.12)", borderColor:"rgba(239,68,68,0.28)", color:"#fca5a5" }}
            onClick={() => socket.emit("host:resetGame")}
          >
            Play Again
          </button>
        </div>
      );
    }
    if (isDDWager) {
      return (
        <div style={{
          flex:           1,
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          gap:            16,
          padding:        40,
          textAlign:      "center",
        }}>
          <div style={{ fontSize: 52, fontWeight: 900, color: "#ffdd75", letterSpacing: -1 }}>
            DAILY DOUBLE
          </div>
          <div style={{ fontSize: 18, color: "rgba(246,247,255,0.55)" }}>
            {clue?.category} — ${clue?.value}
          </div>
          <div style={{ fontSize: 15, color: "rgba(246,247,255,0.4)", marginTop: 8 }}>
            Waiting for player to submit wager…
          </div>
          <button
            className="jp-btn"
            style={{ marginTop: 16 }}
            onClick={() => socket.emit("host:mark", { result: "skip" })}
          >
            Skip Daily Double
          </button>
        </div>
      );
    }

    // Clue view
    if (isClueActive && clue) {
      return (
        <div style={{
          flex:          1,
          display:       "flex",
          flexDirection: "column",
          padding:       "20px 28px",
          gap:           14,
        }}>

          {/* Category + value centered pills */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, flexShrink:0 }}>
            <div style={{
              padding:       "5px 16px",
              borderRadius:  999,
              background:    "rgba(255,255,255,0.07)",
              border:        "1px solid rgba(255,255,255,0.18)",
              fontSize:      11,
              fontWeight:    700,
              color:         "rgba(246,247,255,0.8)",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}>
              {clue.category}
            </div>
            <div style={{
              padding:      "5px 16px",
              borderRadius: 999,
              background:   "rgba(255,221,117,0.18)",
              border:       "1px solid rgba(255,221,117,0.45)",
              fontSize:     14,
              fontWeight:   900,
              color:        "#ffdd75",
            }}>
              {phase === "dailyDoubleClue"
                ? `Daily Double — $${state?.wager?.amount?.toLocaleString() ?? "?"}`
                : `$${clue.value}`
              }
            </div>
            {clue.isDD && phase !== "dailyDoubleClue" && (
              <div style={{ fontSize:11, fontWeight:900, color:"#000", background:"#ffdd75", padding:"3px 8px", borderRadius:999 }}>
                DAILY DOUBLE
              </div>
            )}
          </div>

          {/* Question — centered, fills space */}
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", textAlign:"center" }}>
            <div style={{ fontSize:"clamp(22px, 3vw, 36px)", fontWeight:900, color:"#ffffff", lineHeight:1.3 }}>
              {clue.question}
            </div>
          </div>

          {/* Answer */}
          <div style={{
            display:      "flex",
            alignItems:   "center",
            gap:          10,
            padding:      "10px 14px",
            borderRadius: 10,
            background:   "rgba(255,221,117,0.07)",
            border:       "1px solid rgba(255,221,117,0.25)",
            flexShrink:   0,
          }}>
            <div style={{ fontSize:10, fontWeight:900, color:"rgba(255,221,117,0.55)", textTransform:"uppercase", letterSpacing:1, flexShrink:0 }}>
              Answer
            </div>
            <div style={{ fontWeight:900, color:"#ffdd75", fontSize:15 }}>
              {clue.answer}
            </div>
          </div>

          {/* Buzz banner */}
          {buzz.locked ? (
            <div style={{
              display:      "flex",
              alignItems:   "center",
              gap:          12,
              padding:      "12px 16px",
              borderRadius: 12,
              background:   `${buzzerTeam?.color ?? "#ffdd75"}18`,
              border:       `2px solid ${buzzerTeam?.color ?? "#ffdd75"}`,
              flexShrink:   0,
            }}>
              <div style={{ fontSize:24, width:40, height:40, borderRadius:"50%", background:"rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {buzz.emoji}
              </div>
              <div>
                <div style={{ fontWeight:900, fontSize:16, color:buzzerTeam?.color ?? "#ffdd75" }}>
                  {buzz.name} — {buzzerTeam?.name ?? ""}
                </div>
                <div style={{ fontSize:12, color:"rgba(246,247,255,0.5)", marginTop:1 }}>buzzed in</div>
              </div>
            </div>
          ) : (
            <div style={{
              padding:      "10px 16px",
              borderRadius: 10,
              background:   "rgba(255,255,255,0.03)",
              border:       "1px solid rgba(255,255,255,0.08)",
              color:        "rgba(246,247,255,0.3)",
              fontSize:     13,
              fontWeight:   700,
              textAlign:    "center",
              flexShrink:   0,
            }}>
              Waiting for buzz…
            </div>
          )}

          {/* Correct / Wrong — big solid buttons */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, flexShrink:0 }}>
            <button
              onClick={() => { socket.emit("host:mark", { result: "correct" }); }}
              disabled={!buzz.locked}
              style={{
                padding:      "16px",
                borderRadius: 12,
                border:       "none",
                background:   buzz.locked ? "#16a34a" : "rgba(22,163,74,0.25)",
                color:        buzz.locked ? "#fff" : "rgba(255,255,255,0.3)",
                fontSize:     17,
                fontWeight:   900,
                cursor:       buzz.locked ? "pointer" : "not-allowed",
                transition:   "background 0.15s",
              }}
            >
              Correct ✓
            </button>
            <button
              onClick={() => { socket.emit("host:mark", { result: "wrong" }); }}
              disabled={!buzz.locked}
              style={{
                padding:      "16px",
                borderRadius: 12,
                border:       "none",
                background:   buzz.locked ? "#dc2626" : "rgba(220,38,38,0.25)",
                color:        buzz.locked ? "#fff" : "rgba(255,255,255,0.3)",
                fontSize:     17,
                fontWeight:   900,
                cursor:       buzz.locked ? "pointer" : "not-allowed",
                transition:   "background 0.15s",
              }}
            >
              Wrong ✗
            </button>
          </div>

          {/* Skip + Reset Buzzers */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, flexShrink:0 }}>
            <button
              onClick={() => socket.emit("host:mark", { result: "skip" })}
              style={{
                padding:      "10px",
                borderRadius: 8,
                border:       "1px solid rgba(255,255,255,0.28)",
                background:   "rgba(255,255,255,0.09)",
                color:        "#f6f7ff",
                fontSize:     13,
                fontWeight:   800,
                cursor:       "pointer",
              }}
            >
              Skip
            </button>
            <button
              onClick={() => socket.emit("host:resetBuzz")}
              style={{
                padding:      "10px",
                borderRadius: 8,
                border:       "1px solid rgba(255,255,255,0.10)",
                background:   "transparent",
                color:        "rgba(246,247,255,0.35)",
                fontSize:     11,
                fontWeight:   700,
                cursor:       "pointer",
              }}
            >
              Reset Buzzers
            </button>
          </div>

        </div>
      );
    }

    // Board view
    return (
      <div style={{ padding: 12 }}>
        <div style={{
          display:        "flex",
          alignItems:     "baseline",
          justifyContent: "space-between",
          padding:        "10px 4px 10px",
        }}>
          <div style={{ fontWeight: 900, color: pickingDD ? "#ffdd75" : "#ffdd75", fontSize: 13, letterSpacing: 0.5 }}>
            Board
          </div>
          <div style={{ fontSize: 12, color: "rgba(246,247,255,0.45)" }}>
            {pickingDD
              ? `Pick Daily Double ${ddPicked + 1} of ${ddNeeded} — tap a dashed cell ($400 or higher)`
              : board ? "Click a square to select a clue" : "Press Start Game to generate the board"
            }
          </div>
        </div>

        {/* Picking DD mode banner */}
        {pickingDD && (
          <div style={{
            display:      "flex",
            alignItems:   "center",
            justifyContent: "space-between",
            padding:      "8px 12px",
            background:   "rgba(255,221,117,0.12)",
            border:       "1px solid rgba(255,221,117,0.35)",
            borderRadius: 8,
            margin:       "0 4px 8px",
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#ffdd75" }}>
              Picking DD {ddPicked + 1} of {ddNeeded} — tap any dashed cell
            </div>
            <button
              onClick={() => socket.emit("host:cancelPickDD")}
              style={{ fontSize: 11, fontWeight: 700, color: "rgba(246,247,255,0.5)", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        )}

        {!board ? (
          <div style={{ color: "rgba(246,247,255,0.4)", fontSize: 14, padding: 16 }}>
            No board yet.
          </div>
        ) : (
          <div className="jp-boardGrid">
            {board.columns.map((col, colIndex) => (
              <div key={col.id} className="jp-col">
                <div
                  className="jp-cat"
                  onContextMenu={(e) => handleCatRightClick(e, colIndex)}
                  title="Right-click to swap this category"
                  style={{ cursor: "context-menu" }}
                >
                  {col.title}
                </div>
                {col.clues.map((c, rowIndex) => {
                  const isEligibleDD = pickingDD && !c.used && !c.isDD && rowIndex >= 1;
                  const handleClick = pickingDD
                    ? () => isEligibleDD && socket.emit("host:pickDD", { colIndex, rowIndex })
                    : () => socket.emit("host:selectClue", { colIndex, rowIndex });

                  return (
                    <button
                      key={c.id}
                      className="jp-cell"
                      disabled={c.used || (pickingDD && !isEligibleDD)}
                      onClick={handleClick}
                      style={{
                        opacity: c.used ? 0.3 : 1,
                        cursor:  c.used ? "not-allowed" : pickingDD && !isEligibleDD ? "not-allowed" : "pointer",
                        outline: c.isDD
                          ? "3px solid rgba(255,215,79,0.9)"
                          : isEligibleDD
                          ? "2px dashed rgba(255,215,79,0.6)"
                          : "none",
                      }}
                      title={c.isDD ? "Daily Double" : isEligibleDD ? "Click to make this the Daily Double" : ""}
                    >
                      ${c.value}
                      {c.isDD && <span className="jp-dd">DD</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="jp-root">

      {/* Top bar */}
      <header className="jp-topbar">
        <div className="jp-title">JAYPARDY — HOST</div>
        <div className="jp-chip">Phase: <b>{phase}</b></div>
        <div className="jp-chip">Round: <b>{board?.round ?? "—"}</b></div>
        <div className="jp-chip">
          Socket: <b>{socket.connected ? "Connected ✅" : "Disconnected ❌"}</b>
        </div>
      </header>

      {/* Score strip */}
      <ScoreStrip />

      {/* Main layout */}
      <div className="jp-layout">

        {/* Left — board or clue */}
        <section className="jp-boardZone" style={{ display: "flex", flexDirection: "column" }}>
          <MainArea />
        </section>

        {/* Right sidebar */}
        <aside className="jp-sideZone">

          {/* Players */}
          <div className="jp-panel">
            <div className="jp-panelTitle">Players</div>

            {/* Unassigned — red accent */}
            {unassignedPlayers.length > 0 && (
              <>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: "#ef4444",
                  textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6,
                }}>
                  Needs a team
                </div>
                {unassignedPlayers.map((p) => (
                  <div key={p.id} style={{
                    display:      "flex",
                    alignItems:   "center",
                    gap:          8,
                    padding:      "7px 8px",
                    borderRadius: 9,
                    border:       "1px solid rgba(239,68,68,0.3)",
                    background:   "rgba(239,68,68,0.07)",
                    marginBottom: 5,
                  }}>
                    <span style={{ fontSize: 16 }}>{p.emoji}</span>
                    <span style={{ fontWeight: 700, fontSize: 12, flex: 1 }}>{p.name}</span>
                    <select
                      className="jp-teamSelect"
                      value=""
                      onChange={(e) => socket.emit("host:assignTeam", {
                        playerId: p.id, teamId: e.target.value,
                      })}
                    >
                      <option value="" disabled>Assign…</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
                {assignedPlayers.length > 0 && (
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: "rgba(246,247,255,0.4)",
                    textTransform: "uppercase", letterSpacing: 0.6,
                    margin: "10px 0 6px",
                  }}>
                    Assigned
                  </div>
                )}
              </>
            )}

            {/* Assigned players */}
            {assignedPlayers.length === 0 && unassignedPlayers.length === 0 && (
              <div className="jp-muted">No players yet.</div>
            )}

            {assignedPlayers.map((p) => {
              const t = teamById[p.teamId];
              return (
                <div key={p.id} style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          8,
                  padding:      "7px 8px",
                  borderRadius: 9,
                  border:       `1px solid ${t?.color ?? "rgba(255,255,255,0.08)"}33`,
                  background:   "rgba(255,255,255,0.04)",
                  marginBottom: 5,
                }}>
                  {t && (
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: t.color, flexShrink: 0,
                    }} />
                  )}
                  <span style={{ fontSize: 16 }}>{p.emoji}</span>
                  <span style={{ fontWeight: 700, fontSize: 12, flex: 1 }}>{p.name}</span>
                  {buzz.locked && buzz.playerId === p.id && (
                    <span style={{
                      fontSize: 10, fontWeight: 900, color: "#ffdd75",
                      background: "rgba(255,221,117,0.15)",
                      border: "1px solid rgba(255,221,117,0.3)",
                      padding: "2px 6px", borderRadius: 999,
                    }}>
                      BUZZED
                    </span>
                  )}
                  <select
                    className="jp-teamSelect"
                    value={p.teamId ?? ""}
                    onChange={(e) => socket.emit("host:assignTeam", {
                      playerId: p.id, teamId: e.target.value,
                    })}
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          {/* Host controls */}
          <div className="jp-panel">
            <div className="jp-panelTitle">Controls</div>
            <div className="jp-controlsGrid">
              <button
                className="jp-btn"
                onClick={() => socket.emit("host:startJaypardy")}
                disabled={phase !== "lobby"}
              >
                Start Game
              </button>
              <button
                className="jp-btn"
                onClick={() => socket.emit("host:newBoard")}
                disabled={phase === "lobby"}
              >
                New Board
              </button>
              <button
                className="jp-btn"
                disabled={!canStartRound2}
                onClick={() => socket.emit("host:startRound2")}
                style={canStartRound2 ? {
                  background:  "rgba(255,221,117,0.15)",
                  borderColor: "rgba(255,221,117,0.4)",
                  color:       "#ffdd75",
                } : {}}
                title={!canStartRound2 ? "Available when Round 1 board is complete" : "Start Round 2"}
              >
                Round 2
              </button>
              <button
                className="jp-btn"
                disabled={!canStartFinal && !isFinal}
                onClick={() => setShowFinalSetup(true)}
                style={canStartFinal ? {
                  background:  "rgba(255,221,117,0.25)",
                  borderColor: "rgba(255,221,117,0.6)",
                  color:       "#ffdd75",
                  fontWeight:  900,
                } : {}}
                title={!canStartFinal ? "Available when Round 2 board is complete" : ""}
              >
                Final Jaypardy
              </button>

              {/* Skip Round */}
              {confirmSkip ? (
                <button
                  className="jp-btn"
                  style={{ background:"rgba(255,150,0,0.18)", borderColor:"rgba(255,150,0,0.4)", color:"#fbbf24", gridColumn:"span 2" }}
                  onClick={() => { socket.emit("host:skipRound"); setConfirmSkip(false); }}
                >
                  Confirm Skip Round
                </button>
              ) : (
                <button
                  className="jp-btn"
                  style={{ background:"rgba(255,150,0,0.08)", borderColor:"rgba(255,150,0,0.25)", color:"#fbbf24" }}
                  disabled={phase === "lobby" || !board}
                  onClick={() => setConfirmSkip(true)}
                >
                  Skip Round
                </button>
              )}

              {/* Change Daily Double */}
              {pickingDD ? (
                <button
                  className="jp-btn"
                  style={{ background:"rgba(255,221,117,0.18)", borderColor:"rgba(255,221,117,0.5)", color:"#ffdd75" }}
                  onClick={() => socket.emit("host:cancelPickDD")}
                >
                  Cancel DD Pick
                </button>
              ) : (
                <button
                  className="jp-btn"
                  disabled={phase !== "board" || !board}
                  onClick={() => socket.emit("host:clearDDs")}
                >
                  Change Daily Double
                </button>
              )}

              {confirmSkip && (
                <div style={{ fontSize:11, color:"rgba(246,247,255,0.4)", gridColumn:"span 2", textAlign:"center", marginTop:-4 }}>
                  Skips to next round without completing this one
                  <span style={{ marginLeft:8, color:"#ffdd75", cursor:"pointer" }} onClick={() => setConfirmSkip(false)}>
                    Cancel
                  </span>
                </div>
              )}

              {/* Save / Load Theme */}
              <button
                className="jp-btn"
                disabled={!board || phase !== "board"}
                onClick={() => { setThemeName(""); setShowSaveTheme(true); }}
                style={{ background:"rgba(99,179,237,0.12)", borderColor:"rgba(99,179,237,0.35)", color:"#90cdf4" }}
              >
                Save Theme
              </button>
              <button
                className="jp-btn"
                onClick={() => { setThemeSearch(""); setShowLoadTheme(true); }}
                style={{ background:"rgba(99,179,237,0.12)", borderColor:"rgba(99,179,237,0.35)", color:"#90cdf4" }}
              >
                Load Theme
              </button>

              {/* Game History + Sound Levels */}
              <button
                className="jp-btn"
                style={{ background:"rgba(160,120,255,0.10)", borderColor:"rgba(160,120,255,0.3)", color:"#c4b5fd" }}
                onClick={() => setShowHistory(true)}
              >
                Game History
              </button>
              <button
                className="jp-btn"
                style={{ background:"rgba(34,197,94,0.10)", borderColor:"rgba(34,197,94,0.3)", color:"#86efac" }}
                onClick={() => setShowSounds(true)}
              >
                Sound Levels
              </button>

              {confirmReset ? (
                <button
                  className="jp-btn jp-btnBad"
                  style={{ gridColumn: "span 2" }}
                  onClick={() => { socket.emit("host:resetGame"); setConfirmReset(false); }}
                >
                  Confirm Reset
                </button>
              ) : (
                <button
                  className="jp-btn"
                  style={{ background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.28)", color: "#fca5a5", gridColumn: "span 2" }}
                  onClick={() => setConfirmReset(true)}
                >
                  Reset Game
                </button>
              )}
            </div>
            {confirmReset && (
              <div style={{ fontSize: 11, color: "rgba(246,247,255,0.4)", marginTop: 8, textAlign: "center" }}>
                Tap Confirm Reset to wipe all scores and players
                <span
                  style={{ marginLeft: 8, color: "#ffdd75", cursor: "pointer" }}
                  onClick={() => setConfirmReset(false)}
                >
                  Cancel
                </span>
              </div>
            )}
          </div>

          {/* Final Jaypardy setup modal */}
          {showFinalSetup && (
            <div style={{
              position:"fixed", inset:0, zIndex:999,
              background:"rgba(0,0,0,0.75)",
              display:"flex", alignItems:"center", justifyContent:"center",
              padding:24,
            }}>
              <div style={{
                background:"#090f3a", border:"1px solid rgba(255,255,255,0.15)",
                borderRadius:20, padding:24, width:"100%", maxWidth:420,
              }}>
                <div style={{ fontSize:22, fontWeight:900, color:"#ffdd75", marginBottom:16, textAlign:"center" }}>
                  Final Jaypardy
                </div>

                <input
                  autoFocus
                  value={finalSearch}
                  onChange={(e) => setFinalSearch(e.target.value)}
                  placeholder="Search categories…"
                  style={{
                    width:"100%", padding:"11px 14px", fontSize:14,
                    borderRadius:10, border:"1px solid rgba(255,255,255,0.2)",
                    background:"rgba(255,255,255,0.08)", color:"#f6f7ff",
                    outline:"none", marginBottom:10, boxSizing:"border-box",
                  }}
                />

                <div style={{
                  height:220, overflowY:"auto",
                  border:"1px solid rgba(255,255,255,0.10)",
                  borderRadius:10, background:"rgba(0,0,0,0.2)",
                  marginBottom:10,
                }}>
                  {ALL_CATEGORIES
                    .filter((c) => c.toLowerCase().includes(finalSearch.toLowerCase()))
                    .map((cat) => (
                      <div
                        key={cat}
                        onClick={() => setFinalCategory(cat)}
                        style={{
                          padding:     "10px 14px",
                          fontSize:    13,
                          fontWeight:  finalCategory === cat ? 900 : 600,
                          color:       finalCategory === cat ? "#ffdd75" : "#f6f7ff",
                          background:  finalCategory === cat ? "rgba(255,221,117,0.15)" : "transparent",
                          borderBottom:"1px solid rgba(255,255,255,0.05)",
                          cursor:      "pointer",
                        }}
                        onMouseEnter={(e) => { if (finalCategory !== cat) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                        onMouseLeave={(e) => { if (finalCategory !== cat) e.currentTarget.style.background = "transparent"; }}
                      >
                        {cat}
                      </div>
                    ))
                  }
                </div>

                <div style={{ fontSize:12, color:"rgba(246,247,255,0.45)", textAlign:"center", marginBottom:14 }}>
                  Selected: <span style={{ color:"#ffdd75", fontWeight:700 }}>{finalCategory}</span>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <button
                    className="jp-btn"
                    onClick={() => { setShowFinalSetup(false); setFinalSearch(""); }}
                  >
                    Cancel
                  </button>
                  <button
                    className="jp-btn"
                    style={{ background:"rgba(255,221,117,0.2)", borderColor:"rgba(255,221,117,0.5)", color:"#ffdd75", fontWeight:900 }}
                    onClick={() => {
                      socket.emit("host:startFinal", { category: finalCategory });
                      setShowFinalSetup(false);
                      setFinalSearch("");
                    }}
                  >
                    Start Final
                  </button>
                </div>
              </div>
            </div>
          )}

        </aside>
      </div>

      {/* Game History modal */}
      {showHistory && (
        <div style={{ position:"fixed", inset:0, zIndex:999, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:"#090f3a", border:"1px solid rgba(255,255,255,0.15)", borderRadius:20, padding:24, width:"100%", maxWidth:560, maxHeight:"80vh", display:"flex", flexDirection:"column" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <div style={{ fontSize:20, fontWeight:900, color:"#c4b5fd" }}>Game History</div>
              <button className="jp-btn" style={{ fontSize:12, padding:"4px 12px" }} onClick={() => setShowHistory(false)}>Close</button>
            </div>

            <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:6 }}>
              {gameLog.length === 0 ? (
                <div style={{ textAlign:"center", color:"rgba(246,247,255,0.35)", fontSize:14, padding:24 }}>
                  No events yet — history starts when clues are marked.
                </div>
              ) : (
                [...gameLog].reverse().map((entry, i) => (
                  <div key={i} style={{
                    padding:"10px 14px", borderRadius:10,
                    background: entry.result === "correct"
                      ? `${entry.teamColor}18`
                      : entry.result === "wrong"
                      ? "rgba(239,68,68,0.10)"
                      : "rgba(255,255,255,0.04)",
                    border: `1px solid ${
                      entry.result === "correct" ? entry.teamColor + "44"
                      : entry.result === "wrong" ? "rgba(239,68,68,0.25)"
                      : "rgba(255,255,255,0.07)"}`,
                  }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{
                          fontSize:11, fontWeight:900, padding:"2px 7px", borderRadius:999,
                          background: entry.result === "correct" ? "#21c55d33"
                            : entry.result === "wrong" ? "#ef444433" : "rgba(255,255,255,0.08)",
                          color: entry.result === "correct" ? "#21c55d"
                            : entry.result === "wrong" ? "#fca5a5" : "rgba(246,247,255,0.5)",
                        }}>
                          {entry.result.toUpperCase()}
                        </span>
                        <span style={{ fontSize:12, fontWeight:700, color:"rgba(246,247,255,0.5)" }}>
                          {entry.category} — ${entry.value}
                        </span>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        {entry.scoreDelta && (
                          <span style={{ fontSize:13, fontWeight:900, color: entry.result === "correct" ? "#21c55d" : "#fca5a5" }}>
                            {entry.scoreDelta}
                          </span>
                        )}
                        <span style={{ fontSize:11, color:"rgba(246,247,255,0.3)" }}>{entry.ts}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:13, color:"#f6f7ff", marginBottom:2 }}>{entry.question}</div>
                    <div style={{ fontSize:12, color:"#ffdd75", fontStyle:"italic" }}>{entry.answer}</div>
                    {entry.player && (
                      <div style={{ fontSize:11, color: entry.teamColor ?? "rgba(246,247,255,0.45)", marginTop:4, fontWeight:700 }}>
                        {entry.player} — {entry.team}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save Theme modal */}
      {showSaveTheme && (
        <div style={{ position:"fixed", inset:0, zIndex:999, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:"#090f3a", border:"1px solid rgba(255,255,255,0.15)", borderRadius:20, padding:24, width:"100%", maxWidth:400 }}>
            <div style={{ fontSize:20, fontWeight:900, color:"#90cdf4", marginBottom:6, textAlign:"center" }}>Save Theme</div>
            <div style={{ fontSize:12, color:"rgba(246,247,255,0.45)", textAlign:"center", marginBottom:16 }}>
              Saving: {board?.columns.map((c) => c.title).join(", ")}
            </div>
            <input
              autoFocus
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveTheme()}
              placeholder="e.g. TV Theme Night"
              maxLength={40}
              style={{
                width:"100%", padding:"12px 14px", fontSize:15, borderRadius:10,
                border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.08)",
                color:"#f6f7ff", outline:"none", marginBottom:14, boxSizing:"border-box",
              }}
            />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <button className="jp-btn" onClick={() => setShowSaveTheme(false)}>Cancel</button>
              <button
                className="jp-btn"
                disabled={!themeName.trim()}
                style={{ background:"rgba(99,179,237,0.2)", borderColor:"rgba(99,179,237,0.5)", color:"#90cdf4", fontWeight:900 }}
                onClick={saveTheme}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Theme modal */}
      {showLoadTheme && (
        <div style={{ position:"fixed", inset:0, zIndex:999, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:"#090f3a", border:"1px solid rgba(255,255,255,0.15)", borderRadius:20, padding:24, width:"100%", maxWidth:420 }}>
            <div style={{ fontSize:20, fontWeight:900, color:"#90cdf4", marginBottom:16, textAlign:"center" }}>Load Theme</div>

            <input
              autoFocus
              value={themeSearch}
              onChange={(e) => setThemeSearch(e.target.value)}
              placeholder="Search themes…"
              style={{
                width:"100%", padding:"11px 14px", fontSize:14, borderRadius:10,
                border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.08)",
                color:"#f6f7ff", outline:"none", marginBottom:10, boxSizing:"border-box",
              }}
            />

            <div style={{ height:260, overflowY:"auto", border:"1px solid rgba(255,255,255,0.10)", borderRadius:10, background:"rgba(0,0,0,0.2)", marginBottom:14 }}>
              {Object.keys(savedThemes).length === 0 ? (
                <div style={{ padding:20, textAlign:"center", color:"rgba(246,247,255,0.4)", fontSize:13 }}>
                  No saved themes yet. Arrange your board and click Save Theme.
                </div>
              ) : (
                Object.keys(savedThemes)
                  .filter((name) => name.toLowerCase().includes(themeSearch.toLowerCase()))
                  .map((name) => (
                    <div key={name} style={{
                      display:"flex", alignItems:"center", gap:10,
                      padding:"10px 14px", borderBottom:"1px solid rgba(255,255,255,0.05)",
                    }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:900, fontSize:14, color:"#f6f7ff", marginBottom:3 }}>{name}</div>
                        <div style={{ fontSize:11, color:"rgba(246,247,255,0.4)", lineHeight:1.4 }}>
                          {savedThemes[name].join(" · ")}
                        </div>
                      </div>
                      <button
                        onClick={() => loadTheme(name)}
                        style={{
                          padding:"6px 14px", borderRadius:8, border:"1px solid rgba(99,179,237,0.4)",
                          background:"rgba(99,179,237,0.15)", color:"#90cdf4", fontWeight:900,
                          fontSize:12, cursor:"pointer", flexShrink:0,
                        }}
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deleteTheme(name)}
                        style={{
                          padding:"6px 10px", borderRadius:8, border:"1px solid rgba(239,68,68,0.3)",
                          background:"rgba(239,68,68,0.10)", color:"#fca5a5", fontWeight:900,
                          fontSize:12, cursor:"pointer", flexShrink:0,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))
              )}
            </div>

            <button className="jp-btn" style={{ width:"100%" }} onClick={() => { setShowLoadTheme(false); setThemeSearch(""); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sound Levels modal */}
      {showSounds && (
        <div style={{ position:"fixed", inset:0, zIndex:999, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:"#090f3a", border:"1px solid rgba(255,255,255,0.15)", borderRadius:20, padding:24, width:"100%", maxWidth:400 }}>
            <div style={{ fontSize:20, fontWeight:900, color:"#86efac", marginBottom:20, textAlign:"center" }}>
              Sound Levels
            </div>

            {[
              { key:"buzz",        label:"Buzz In",      fn: playBuzz     },
              { key:"correct",     label:"Correct",      fn: playCorrect  },
              { key:"wrong",       label:"Wrong",        fn: playWrong    },
              { key:"dailydouble", label:"Daily Double", fn: playDDChime  },
            ].map(({ key, label, fn }) => (
              <div key={key} style={{ marginBottom:18 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:"#f6f7ff" }}>{label}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:12, color:"rgba(246,247,255,0.5)", minWidth:32, textAlign:"right" }}>
                      {Math.round(soundVols[key] * 100)}%
                    </span>
                    <button
                      onClick={fn}
                      style={{
                        padding:"4px 10px", borderRadius:6, fontSize:11, fontWeight:700,
                        border:"1px solid rgba(134,239,172,0.3)", background:"rgba(34,197,94,0.1)",
                        color:"#86efac", cursor:"pointer",
                      }}
                    >
                      Test
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundVols[key]}
                  onChange={(e) => handleVolChange(key, e.target.value)}
                  style={{ width:"100%", accentColor:"#86efac", cursor:"pointer" }}
                />
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"rgba(246,247,255,0.25)", marginTop:2 }}>
                  <span>Off</span>
                  <span>Max</span>
                </div>
              </div>
            ))}

            <button
              className="jp-btn"
              style={{ width:"100%", marginTop:4 }}
              onClick={() => setShowSounds(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {swapMenu && (
        <div style={{
          position:"fixed", inset:0, zIndex:9999,
          background:"rgba(0,0,0,0.75)",
          display:"flex", alignItems:"center", justifyContent:"center",
          padding:24,
        }}>
          <div style={{
            background:"#090f3a", border:"1px solid rgba(255,255,255,0.15)",
            borderRadius:20, padding:24, width:"100%", maxWidth:420,
          }}>
            <div style={{ fontSize:18, fontWeight:900, color:"#ffdd75", marginBottom:4, textAlign:"center" }}>
              Swap Category
            </div>
            <div style={{ fontSize:12, color:"rgba(246,247,255,0.45)", textAlign:"center", marginBottom:14 }}>
              Replacing: <span style={{ color:"#fff", fontWeight:700 }}>{board?.columns[swapMenu.colIndex]?.title}</span>
            </div>

            <input
              autoFocus
              value={swapSearch}
              onChange={(e) => setSwapSearch(e.target.value)}
              placeholder="Search categories…"
              style={{
                width:"100%", padding:"11px 14px", fontSize:14,
                borderRadius:10, border:"1px solid rgba(255,255,255,0.2)",
                background:"rgba(255,255,255,0.08)", color:"#f6f7ff",
                outline:"none", marginBottom:10, boxSizing:"border-box",
              }}
            />

            <div style={{
              height:240, overflowY:"auto",
              border:"1px solid rgba(255,255,255,0.10)",
              borderRadius:10, background:"rgba(0,0,0,0.2)",
              marginBottom:14,
            }}>
              {availableCategories
                .filter((c) => c.toLowerCase().includes(swapSearch.toLowerCase()))
                .length === 0 ? (
                  <div style={{ padding:"16px", textAlign:"center", color:"rgba(246,247,255,0.4)", fontSize:13 }}>
                    No matches
                  </div>
                ) : (
                  availableCategories
                    .filter((c) => c.toLowerCase().includes(swapSearch.toLowerCase()))
                    .map((cat) => (
                      <div
                        key={cat}
                        onClick={() => { doSwap(cat); setSwapSearch(""); }}
                        style={{
                          padding:     "10px 14px",
                          fontSize:    13,
                          fontWeight:  600,
                          color:       "#f6f7ff",
                          background:  "transparent",
                          borderBottom:"1px solid rgba(255,255,255,0.05)",
                          cursor:      "pointer",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        {cat}
                      </div>
                    ))
                )
              }
            </div>

            <button
              className="jp-btn"
              style={{ width:"100%" }}
              onClick={() => { setSwapMenu(null); setSwapSearch(""); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const adjBtn = {
  background:   "rgba(255,255,255,0.08)",
  border:       "1px solid rgba(255,255,255,0.12)",
  color:        "#f6f7ff",
  borderRadius: 4,
  width:        20,
  height:       20,
  fontSize:     13,
  fontWeight:   900,
  cursor:       "pointer",
  display:      "flex",
  alignItems:   "center",
  justifyContent: "center",
  lineHeight:   1,
  flexShrink:   0,
};