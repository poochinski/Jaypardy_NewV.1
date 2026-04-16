import { useState, useEffect, useRef } from "react";
import "./jaypardyTheme.css";

// ─── Daily Double chime using Web Audio API ───────────────────────────────────
function playDDChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type      = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.18);

      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + i * 0.18 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.5);

      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.55);
    });
  } catch (e) {
    // Audio not supported — fail silently
  }
}

export default function DisplayScreen({ state }) {
  const phase   = state?.phase;
  const board   = state?.board;
  const clue    = state?.currentClue;
  const buzz    = state?.buzz;
  const teams   = state?.teams ?? [];
  const players = state?.players ?? [];

  const [revealAnswer, setRevealAnswer] = useState(null);
  const [wrongFlash,   setWrongFlash]   = useState(null);
  const prevPhaseRef   = useRef(null);
  const prevBuzzRef    = useRef(null);
  const revealTimer    = useRef(null);
  const wrongTimer     = useRef(null);
  const ddChimeFired   = useRef(false);

  const visibleTeams = teams.filter((t) =>
    players.some((p) => p.teamId === t.id)
  );

  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));

  // Play DD chime exactly once when phase becomes dailyDouble
  useEffect(() => {
    if (phase === "dailyDouble" && !ddChimeFired.current) {
      ddChimeFired.current = true;
      playDDChime();
    }
    if (phase !== "dailyDouble") {
      ddChimeFired.current = false;
    }
  }, [phase]);

  // Detect correct answer (clue → board with a buzz locked)
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    const prevBuzz  = prevBuzzRef.current;

    if (
      (prevPhase === "clue" || prevPhase === "dailyDoubleClue") &&
      phase === "board" &&
      prevBuzz?.locked &&
      prevBuzz?.teamId
    ) {
      const team = teamById[prevBuzz.teamId];
      setRevealAnswer({
        teamName: team?.name ?? "",
        color:    team?.color ?? "#21c55d",
        name:     prevBuzz.name,
        emoji:    prevBuzz.emoji,
      });
      clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(() => setRevealAnswer(null), 2500);
    }

    prevPhaseRef.current = phase;
    prevBuzzRef.current  = buzz;
  }, [phase, buzz]);

  // Detect wrong answer — buzz resets but clue stays active
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

  // ─── Score strip (shared across all views) ────────────────────────────────
  const ScoreStrip = () => (
    <div style={{
      display:        "flex",
      gap:            10,
      padding:        "10px 16px",
      borderBottom:   "1px solid rgba(255,255,255,0.08)",
      background:     "rgba(0,0,0,0.18)",
      flexWrap:       "wrap",
      justifyContent: "center",
    }}>
      {visibleTeams.length === 0 ? (
        <div style={{ color: "rgba(246,247,255,0.4)", fontSize: 14 }}>
          No teams yet
        </div>
      ) : (
        visibleTeams.map((t) => {
          const teamPlayers = players.filter((p) => p.teamId === t.id);
          const names       = teamPlayers.map((p) => p.name).join(", ");
          return (
            <div key={t.id} style={{
              display:        "flex",
              alignItems:     "center",
              gap:            10,
              padding:        "8px 16px",
              borderRadius:   12,
              background:     "rgba(0,0,0,0.25)",
              border:         `1px solid ${t.color}44`,
              minWidth:       140,
              justifyContent: "center",
            }}>
              {/* Color dot */}
              <div style={{
                width:        12,
                height:       12,
                borderRadius: "50%",
                background:   t.color,
                flexShrink:   0,
              }} />
              {/* Player names */}
              <div style={{
                fontWeight: 700,
                fontSize:   15,
                color:      "#f6f7ff",
              }}>
                {names || t.name}
              </div>
              {/* Score box */}
              <div style={{
                background:   t.color,
                color:        "#fff",
                fontWeight:   900,
                fontSize:     16,
                padding:      "3px 10px",
                borderRadius: 8,
                minWidth:     52,
                textAlign:    "center",
              }}>
                ${t.score.toLocaleString()}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  // ─── Correct answer reveal overlay ───────────────────────────────────────
  if (revealAnswer) {
    return (
      <div className="jp-root" style={{
        minHeight:      "100vh",
        display:        "flex",
        flexDirection:  "column",
      }}>
        <ScoreStrip />
        <div style={{
          flex:           1,
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          textAlign:      "center",
          padding:        40,
        }}>
          <div style={{
            fontSize:     32,
            fontWeight:   900,
            color:        revealAnswer.color,
            marginBottom: 16,
            letterSpacing: 1,
          }}>
            {revealAnswer.emoji} {revealAnswer.name}
            {revealAnswer.teamName && (
              <span style={{ opacity: 0.7, marginLeft: 10, fontSize: 22 }}>
                — {revealAnswer.teamName}
              </span>
            )}
          </div>
          <div style={{
            fontSize:   72,
            fontWeight: 900,
            color:      "#21c55d",
            lineHeight: 1,
          }}>
            CORRECT!
          </div>
        </div>
      </div>
    );
  }

  // ─── Daily Double splash ──────────────────────────────────────────────────
  if (phase === "dailyDouble") {
    return (
      <div className="jp-root" style={{
        minHeight:      "100vh",
        display:        "flex",
        flexDirection:  "column",
      }}>
        <ScoreStrip />
        <div style={{
          flex:           1,
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          textAlign:      "center",
          padding:        40,
          gap:            24,
        }}>
          <div style={{
            fontSize:      "clamp(16px, 3vw, 22px)",
            fontWeight:    700,
            color:         "rgba(246,247,255,0.5)",
            letterSpacing: 4,
            textTransform: "uppercase",
          }}>
            {clue?.category}
          </div>
          <div style={{
            fontSize:      "clamp(64px, 12vw, 140px)",
            fontWeight:    900,
            color:         "#ffdd75",
            lineHeight:    1,
            letterSpacing: -2,
            textShadow:    "0 4px 0 rgba(0,0,0,0.4)",
          }}>
            DAILY
          </div>
          <div style={{
            fontSize:      "clamp(64px, 12vw, 140px)",
            fontWeight:    900,
            color:         "#ffdd75",
            lineHeight:    1,
            letterSpacing: -2,
            textShadow:    "0 4px 0 rgba(0,0,0,0.4)",
          }}>
            DOUBLE
          </div>
          <div style={{
            marginTop:  16,
            fontSize:   18,
            color:      "rgba(246,247,255,0.45)",
            fontWeight: 700,
          }}>
            Waiting for wager…
          </div>
        </div>
      </div>
    );
  }

  // ─── Full screen clue view ────────────────────────────────────────────────
  if ((phase === "clue" || phase === "dailyDoubleClue") && clue) {
    const buzzer     = buzz?.locked ? buzz : null;
    const buzzerTeam = buzzer ? teamById[buzzer.teamId] : null;

    return (
      <div className="jp-root" style={{
        minHeight:     "100vh",
        display:       "flex",
        flexDirection: "column",
      }}>
        <ScoreStrip />

        <div style={{
          flex:          1,
          display:       "flex",
          flexDirection: "column",
          padding:       40,
        }}>
          {/* Category + value */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{
              fontSize:      18,
              fontWeight:    700,
              color:         "rgba(246,247,255,0.5)",
              textTransform: "uppercase",
              letterSpacing: 2,
              marginBottom:  8,
            }}>
              {clue.category}
            </div>
            <div style={{
              fontSize:   36,
              fontWeight: 900,
              color:      "#ffdd75",
            }}>
              {phase === "dailyDoubleClue"
                ? `Daily Double — $${state.wager?.amount?.toLocaleString() ?? "?"}`
                : `$${clue.value}`
              }
            </div>
          </div>

          {/* Clue question */}
          <div style={{
            flex:           1,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            textAlign:      "center",
          }}>
            <div style={{
              fontSize:   "clamp(28px, 5vw, 64px)",
              fontWeight: 900,
              lineHeight: 1.3,
              color:      "#ffffff",
              maxWidth:   900,
            }}>
              {clue.question}
            </div>
          </div>

          {/* Wrong flash */}
          {wrongFlash && (
            <div style={{
              textAlign:    "center",
              padding:      "16px 24px",
              borderRadius: 16,
              background:   "rgba(239,68,68,0.20)",
              border:       "1px solid rgba(239,68,68,0.45)",
              marginBottom: 16,
              fontSize:     22,
              fontWeight:   900,
              color:        "#fca5a5",
            }}>
              {wrongFlash.emoji} {wrongFlash.name} — WRONG
            </div>
          )}

          {/* Buzz banner */}
          {buzzer ? (
            <div style={{
              textAlign:    "center",
              padding:      "20px 32px",
              borderRadius: 20,
              background:   `${buzzerTeam?.color ?? "#ffdd75"}22`,
              border:       `2px solid ${buzzerTeam?.color ?? "#ffdd75"}`,
              fontSize:     32,
              fontWeight:   900,
              color:        buzzerTeam?.color ?? "#ffdd75",
              letterSpacing: 0.5,
            }}>
              {buzzer.emoji} {buzzer.name}
              {buzzerTeam && (
                <span style={{ fontSize: 20, opacity: 0.8, marginLeft: 12 }}>
                  — {buzzerTeam.name}
                </span>
              )}
            </div>
          ) : (
            <div style={{
              textAlign:    "center",
              color:        "rgba(246,247,255,0.3)",
              fontSize:     18,
              fontWeight:   700,
              letterSpacing: 1,
              padding:      "16px 0",
            }}>
              BUZZ IN…
            </div>
          )}
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
          <div style={{
            textAlign:  "center",
            color:      "rgba(246,247,255,0.4)",
            fontSize:   18,
            marginTop:  60,
          }}>
            Waiting for host to start the game…
          </div>
        ) : (
          <div className="jp-boardGrid">
            {board.columns.map((col, colIndex) => (
              <div className="jp-col" key={colIndex}>
                <div className="jp-cat">{col.title}</div>
                {col.clues.map((c, rowIndex) => (
                  <div
                    key={`${colIndex}-${rowIndex}`}
                    className="jp-cell"
                    style={{
                      opacity: c.used ? 0.2 : 1,
                      cursor:  "default",
                      fontWeight: 900,
                      // No DD indicator — players never see it
                    }}
                  >
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
