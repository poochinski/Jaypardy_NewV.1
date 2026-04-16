import { useMemo, useState } from "react";
import { socket } from "../socket";
import "./jaypardyTheme.css";

export default function HostScreen({ state }) {
  const [confirmReset, setConfirmReset] = useState(false);

  const players      = state?.players ?? [];
  const teams        = state?.teams ?? [];
  const buzz         = state?.buzz ?? { locked: false };
  const board        = state?.board ?? null;
  const clue         = state?.currentClue ?? null;
  const phase        = state?.phase ?? "lobby";
  const controlTeam  = state?.controlTeamId ?? null;

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

    // DD wager waiting screen
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
          padding:       24,
          gap:           16,
        }}>

          {/* Clue header */}
          <div style={{
            display:     "flex",
            alignItems:  "baseline",
            gap:         12,
            paddingBottom: 12,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{ fontWeight: 900, color: "#ffdd75", fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>
              {clue.category}
            </div>
            <div style={{ fontWeight: 900, color: "#ffdd75", fontSize: 20 }}>
              {phase === "dailyDoubleClue"
                ? `Daily Double — $${state?.wager?.amount?.toLocaleString() ?? "?"}`
                : `$${clue.value}`
              }
            </div>
            {clue.isDD && (
              <div style={{
                marginLeft:   "auto",
                fontSize:     11,
                fontWeight:   900,
                color:        "#000",
                background:   "#ffdd75",
                padding:      "3px 8px",
                borderRadius: 999,
              }}>
                DAILY DOUBLE
              </div>
            )}
          </div>

          {/* Question */}
          <div style={{
            flex:       1,
            display:    "flex",
            alignItems: "center",
          }}>
            <div style={{
              fontSize:   "clamp(20px, 3vw, 32px)",
              fontWeight: 900,
              color:      "#ffffff",
              lineHeight: 1.35,
            }}>
              {clue.question}
            </div>
          </div>

          {/* Answer */}
          <div style={{
            padding:      "12px 16px",
            borderRadius: 10,
            background:   "rgba(255,221,117,0.10)",
            border:       "1px solid rgba(255,221,117,0.25)",
          }}>
            <div style={{ fontSize: 11, color: "rgba(246,247,255,0.45)", marginBottom: 4, fontWeight: 700, letterSpacing: 0.5 }}>
              ANSWER
            </div>
            <div style={{ fontWeight: 900, color: "#ffdd75", fontSize: 18 }}>
              {clue.answer}
            </div>
          </div>

          {/* Buzz banner */}
          {buzz.locked ? (
            <div style={{
              padding:      "14px 18px",
              borderRadius: 12,
              background:   `${buzzerTeam?.color ?? "#ffdd75"}22`,
              border:       `2px solid ${buzzerTeam?.color ?? "#ffdd75"}`,
              display:      "flex",
              alignItems:   "center",
              gap:          12,
            }}>
              <div style={{ fontSize: 28 }}>{buzz.emoji}</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16, color: buzzerTeam?.color ?? "#ffdd75" }}>
                  {buzz.name}
                </div>
                <div style={{ fontSize: 12, color: "rgba(246,247,255,0.55)" }}>
                  {buzzerTeam?.name ?? ""} buzzed in
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              padding:      "12px 16px",
              borderRadius: 10,
              background:   "rgba(255,255,255,0.04)",
              border:       "1px solid rgba(255,255,255,0.08)",
              color:        "rgba(246,247,255,0.35)",
              fontSize:     14,
              fontWeight:   700,
              textAlign:    "center",
            }}>
              Waiting for buzz…
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <button
              className="jp-btn jp-btnGood"
              onClick={() => socket.emit("host:mark", { result: "correct" })}
              disabled={!buzz.locked}
              title={!buzz.locked ? "Nobody has buzzed yet" : ""}
            >
              Correct ✓
            </button>
            <button
              className="jp-btn jp-btnBad"
              onClick={() => socket.emit("host:mark", { result: "wrong" })}
              disabled={!buzz.locked}
              title={!buzz.locked ? "Nobody has buzzed yet" : ""}
            >
              Wrong ✗
            </button>
            <button
              className="jp-btn"
              onClick={() => socket.emit("host:mark", { result: "skip" })}
            >
              Skip
            </button>
          </div>

          {/* Reset buzz */}
          <button
            className="jp-btn"
            style={{ fontSize: 12, opacity: 0.7 }}
            onClick={() => socket.emit("host:resetBuzz")}
          >
            Reset Buzzers
          </button>

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
          <div style={{ fontWeight: 900, color: "#ffdd75", fontSize: 13, letterSpacing: 0.5 }}>
            Board
          </div>
          <div style={{ fontSize: 12, color: "rgba(246,247,255,0.45)" }}>
            {board ? "Click a square to select a clue" : "Press Start Game to generate the board"}
          </div>
        </div>

        {!board ? (
          <div style={{ color: "rgba(246,247,255,0.4)", fontSize: 14, padding: 16 }}>
            No board yet.
          </div>
        ) : (
          <div className="jp-boardGrid">
            {board.columns.map((col, colIndex) => (
              <div key={col.id} className="jp-col">
                <div className="jp-cat">{col.title}</div>
                {col.clues.map((c, rowIndex) => (
                  <button
                    key={c.id}
                    className="jp-cell"
                    disabled={c.used}
                    onClick={() => socket.emit("host:selectClue", { colIndex, rowIndex })}
                    style={{
                      opacity: c.used ? 0.3 : 1,
                      cursor:  c.used ? "not-allowed" : "pointer",
                      outline: c.isDD ? "3px solid rgba(255,215,79,0.9)" : "none",
                    }}
                    title={c.isDD ? "Daily Double" : ""}
                  >
                    ${c.value}
                    {c.isDD && <span className="jp-dd">DD</span>}
                  </button>
                ))}
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
                title={!canStartRound2 ? "Available when all clues are used" : "Start Round 2"}
              >
                Round 2
              </button>
              {confirmReset ? (
                <button
                  className="jp-btn jp-btnBad"
                  onClick={() => { socket.emit("host:resetGame"); setConfirmReset(false); }}
                >
                  Confirm Reset
                </button>
              ) : (
                <button
                  className="jp-btn"
                  style={{ background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.28)", color: "#fca5a5" }}
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

        </aside>
      </div>
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
