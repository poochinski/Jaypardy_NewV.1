import "./jaypardyTheme.css";

export default function DisplayScreen({ state }) {
  const phase = state?.phase;
  const board = state?.board;
  const clue = state?.currentClue;
  const buzz = state?.buzz;
  const teams = state?.teams ?? [];
  const players = state?.players ?? [];

  // Only show teams that actually have players (your existing rule)
  const visibleTeams = teams.filter((t) =>
    players.some((p) => p.teamId === t.id)
  );

  const showBuzz = buzz?.locked && buzz?.name;

  return (
    <div className="jp-root">
      <header className="jp-topbar">
        <div className="jp-title">JAYPARDY — DISPLAY</div>

        <div className="jp-chip">
          Phase: <b>{phase ?? "—"}</b>
        </div>

        <div className="jp-chip">
          Round: <b>{board?.round ?? "—"}</b>
        </div>

        {showBuzz ? (
          <div className="jp-chip" style={{ borderColor: "rgba(255,255,255,0.35)" }}>
            🔔 <b>{buzz.emoji}</b> <b>{buzz.name}</b> buzzed in!
          </div>
        ) : (
          <div className="jp-chip" style={{ opacity: 0.8 }}>
            🔕 No buzz yet
          </div>
        )}
      </header>

      <div style={{ padding: 14 }}>
        {/* SCORE STRIP */}
        <div
          className="jp-panel"
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14,
          }}
        >
          {visibleTeams.length === 0 ? (
            <div className="jp-muted">No teams yet — join on /player and assign teams on Host.</div>
          ) : (
            visibleTeams.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  minWidth: 160,
                  textAlign: "center",
                }}
              >
                <div style={{ fontWeight: 900, letterSpacing: 0.4 }}>
                  {t.name.toUpperCase()}
                </div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>
                  {t.score}
                </div>
              </div>
            ))
          )}
        </div>

        {/* MAIN VIEW: BOARD or CLUE */}
        {phase === "clue" && clue ? (
          <div className="jp-panel">
            <div className="jp-panelTitle" style={{ textAlign: "center" }}>
              CLUE — ${clue.value} {clue.isDD ? " • DAILY DOUBLE" : ""}
            </div>

            <div className="jp-clueBox" style={{ marginTop: 12 }}>
              <div className="jp-clueQ" style={{ textAlign: "center" }}>
                {clue.question}
              </div>

              {/* Display normally does NOT show answer (Host has it).
                  If you ever want to show the answer, we can add a "reveal" flag to state later. */}
            </div>

            <div className="jp-muted" style={{ marginTop: 12, textAlign: "center" }}>
              Players buzz in on their phones. Host marks correct/wrong/skip.
            </div>
          </div>
        ) : (
          <div className="jp-panel">
            <div className="jp-boardHeader" style={{ marginBottom: 10 }}>
              <div className="jp-boardHeaderTitle">BOARD</div>
              <div className="jp-boardHeaderHint">
                {board
                  ? "Waiting for Host to pick a clue…"
                  : "No board yet. Host needs to press Start Game."}
              </div>
            </div>

            {!board ? (
              <div className="jp-muted" style={{ padding: 16 }}>
                No board state yet.
              </div>
            ) : (
              <div className="jp-boardGrid">
                {board.columns.map((col, colIndex) => (
                  <div className="jp-col" key={colIndex}>
                    <div className="jp-cat">{col.category}</div>

                    {col.clues.map((c, rowIndex) => {
                      const isUsed = c.used;

                      return (
                        <div
                          key={`${colIndex}-${rowIndex}`}
                          className="jp-cell"
                          style={{
                            opacity: isUsed ? 0.25 : 1,
                            cursor: "default",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 900,
                            position: "relative",
                          }}
                        >
                          {/* Hide used values */}
                          {!isUsed ? `$${c.value}` : ""}

                          {/* Optional tiny DD marker on display (safe + fun). Remove if you want it hidden. */}
                          {!isUsed && c.isDD && (
                            <span className="jp-dd" title="Daily Double">
                              DD
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
