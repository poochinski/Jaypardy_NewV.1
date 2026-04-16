import { useState, useEffect, useRef } from "react";
import "./jaypardyTheme.css";

export default function DisplayScreen({ state }) {
  const phase   = state?.phase;
  const board   = state?.board;
  const clue    = state?.currentClue;
  const buzz    = state?.buzz;
  const teams   = state?.teams ?? [];
  const players = state?.players ?? [];

  // Track previous buzz to detect correct answer reveal
  const [revealAnswer, setRevealAnswer] = useState(null); // { answer, teamName, color }
  const [wrongFlash, setWrongFlash]     = useState(null); // { name, emoji, color }
  const prevBuzzRef  = useRef(null);
  const prevPhaseRef = useRef(null);
  const revealTimer  = useRef(null);
  const wrongTimer   = useRef(null);

  const visibleTeams = teams.filter((t) =>
    players.some((p) => p.teamId === t.id)
  );

  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));

  // Detect phase transitions to trigger answer reveal or wrong flash
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    const prevBuzz  = prevBuzzRef.current;

    // Clue just closed (phase went from clue → board)
    // If there was a buzz locked when it closed, that means correct was marked
    if (prevPhase === "clue" && phase === "board" && prevBuzz?.locked && prevBuzz?.teamId) {
      const team = teamById[prevBuzz.teamId];
      setRevealAnswer({
        answer:   state?.board ? null : null, // answer not in state on board phase
        teamName: team?.name ?? "",
        color:    team?.color ?? "#ffdd75",
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
      phase === "clue" &&
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

  // ─── Answer reveal overlay ────────────────────────────────────────────────
  if (revealAnswer) {
    return (
      <div className="jp-root" style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        textAlign: "center",
      }}>
        <div style={{
          fontSize: 28,
          fontWeight: 900,
          color: revealAnswer.color,
          marginBottom: 16,
          letterSpacing: 1,
        }}>
          {revealAnswer.emoji} {revealAnswer.name} — {revealAnswer.teamName}
        </div>
        <div style={{
          fontSize: 52,
          fontWeight: 900,
          color: "#21c55d",
          lineHeight: 1.2,
        }}>
          CORRECT!
        </div>
      </div>
    );
  }

  // ─── Full screen clue view ────────────────────────────────────────────────
  if (phase === "clue" && clue) {
    const buzzer     = buzz?.locked ? buzz : null;
    const buzzerTeam = buzzer ? teamById[buzzer.teamId] : null;

    return (
      <div className="jp-root" style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: 40,
      }}>

        {/* Category + value */}
        <div style={{
          textAlign: "center",
          marginBottom: 32,
        }}>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: "rgba(246,247,255,0.55)",
            textTransform: "uppercase",
            letterSpacing: 2,
            marginBottom: 8,
          }}>
            {clue.category}
          </div>
          <div style={{
            fontSize: 36,
            fontWeight: 900,
            color: "#ffdd75",
          }}>
            ${clue.value}
          </div>
        </div>

        {/* Clue question — fills the screen */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}>
          <div style={{
            fontSize: "clamp(28px, 5vw, 64px)",
            fontWeight: 900,
            lineHeight: 1.3,
            color: "#ffffff",
            maxWidth: 900,
          }}>
            {clue.question}
          </div>
        </div>

        {/* Wrong flash banner */}
        {wrongFlash && (
          <div style={{
            textAlign: "center",
            padding: "16px 24px",
            borderRadius: 16,
            background: "rgba(239,68,68,0.20)",
            border: "1px solid rgba(239,68,68,0.45)",
            marginBottom: 16,
            fontSize: 22,
            fontWeight: 900,
            color: "#fca5a5",
          }}>
            {wrongFlash.emoji} {wrongFlash.name} — WRONG
          </div>
        )}

        {/* Buzz banner */}
        {buzzer ? (
          <div style={{
            textAlign: "center",
            padding: "20px 32px",
            borderRadius: 20,
            background: `${buzzerTeam?.color ?? "#ffdd75"}22`,
            border: `2px solid ${buzzerTeam?.color ?? "#ffdd75"}`,
            fontSize: 32,
            fontWeight: 900,
            color: buzzerTeam?.color ?? "#ffdd75",
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
            textAlign: "center",
            color: "rgba(246,247,255,0.3)",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 1,
            padding: "16px 0",
          }}>
            BUZZ IN…
          </div>
        )}

      </div>
    );
  }

  // ─── Board view ───────────────────────────────────────────────────────────
  return (
    <div className="jp-root" style={{ minHeight: "100vh" }}>

      {/* Score strip */}
      <div style={{
        display: "flex",
        gap: 10,
        padding: "12px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(0,0,0,0.18)",
        flexWrap: "wrap",
        justifyContent: "center",
      }}>
        {visibleTeams.length === 0 ? (
          <div style={{ color: "rgba(246,247,255,0.4)", fontSize: 14 }}>
            No teams yet
          </div>
        ) : (
          visibleTeams.map((t) => (
            <div key={t.id} style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 18px",
              borderRadius: 12,
              background: "rgba(0,0,0,0.25)",
              border: `1px solid ${t.color ?? "rgba(255,255,255,0.12)"}`,
              minWidth: 140,
              justifyContent: "center",
            }}>
              <div style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: t.color ?? "#fff",
                flexShrink: 0,
              }} />
              <div style={{ fontWeight: 900, fontSize: 16 }}>
                {t.name.toUpperCase()}
              </div>
              <div style={{
                fontSize: 24,
                fontWeight: 900,
                color: t.color ?? "#ffdd75",
              }}>
                ${t.score.toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Board */}
      <div style={{ padding: 12 }}>
        {!board ? (
          <div style={{
            textAlign: "center",
            color: "rgba(246,247,255,0.4)",
            fontSize: 18,
            marginTop: 60,
          }}>
            Waiting for host to start the game…
          </div>
        ) : (
          <div className="jp-boardGrid">
            {board.columns.map((col, colIndex) => (
              <div className="jp-col" key={colIndex}>
                {/* Category name — fixed */}
                <div className="jp-cat">{col.title}</div>

                {col.clues.map((c, rowIndex) => (
                  <div
                    key={`${colIndex}-${rowIndex}`}
                    className="jp-cell"
                    style={{
                      opacity: c.used ? 0.2 : 1,
                      cursor: "default",
                      fontWeight: 900,
                      // No DD highlighting — players don't know which is DD
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
