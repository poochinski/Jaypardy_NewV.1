import { useMemo } from "react";
import { socket } from "../socket";
import "./jaypardyTheme.css";

export default function HostScreen({ state }) {
  const players = state?.players ?? [];
  const teams = state?.teams ?? [];
  const buzz = state?.buzz ?? { locked: false };
  const board = state?.board ?? null;
  const clue = state?.currentClue ?? null;

  const teamById = useMemo(() => {
    const m = new Map();
    teams.forEach((t) => m.set(t.id, t));
    return m;
  }, [teams]);

  const hasPlayersByTeam = useMemo(() => {
    const set = new Set();
    players.forEach((p) => p.teamId && set.add(p.teamId));
    return set;
  }, [players]);

  const canStart = state?.phase === "lobby" || state?.phase === "board";

  return (
    <div className="jp-root">
      <header className="jp-topbar">
        <div className="jp-title">JAYPARDY — HOST</div>
        <div className="jp-chip">
          Phase: <b>{state?.phase ?? "—"}</b>
        </div>
        <div className="jp-chip">
          Round: <b>{board?.round ?? "—"}</b>
        </div>
        <div className="jp-chip">
          Socket: <b>{socket.connected ? "Connected ✅" : "Disconnected ❌"}</b>
        </div>
      </header>

      <div className="jp-layout">
        {/* ZONE 1: Board */}
        <section className="jp-boardZone">
          <div className="jp-boardHeader">
            <div className="jp-boardHeaderTitle">Board</div>
            <div className="jp-boardHeaderHint">
              {board ? "Click a square to reveal the clue." : "Press Start Game to generate the board."}
            </div>
          </div>

          {!board ? (
            <div className="jp-muted" style={{ padding: 16 }}>
              No board yet. Click <b>Start Game</b>.
            </div>
          ) : (
            <div className="jp-boardGrid">
              {board.columns.map((col, colIndex) => (
                <div key={col.id} className="jp-col">
                  <div className="jp-cat">{col.title}</div>

                  {col.clues.map((c, rowIndex) => {
                    const isUsed = c.used;
                    const isDD = c.isDD;

                    return (
                      <button
                        key={c.id}
                        className="jp-cell"
                        disabled={isUsed}
                        onClick={() => socket.emit("host:selectClue", { colIndex, rowIndex })}
                        style={{
                          opacity: isUsed ? 0.35 : 1,
                          cursor: isUsed ? "not-allowed" : "pointer",
                          outline: isDD ? "3px solid rgba(255,215,79,0.9)" : "none",
                        }}
                        title={isDD ? "Daily Double (Host only)" : ""}
                      >
                        ${c.value}
                        {isDD && <span className="jp-dd">DD</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sidebar */}
        <aside className="jp-sideZone">
          {/* ZONE 2: Teams & Players */}
          <div className="jp-panel">
            <div className="jp-panelTitle">Teams & Players</div>

            <div className="jp-teamList">
              {teams
                .filter((t) => hasPlayersByTeam.has(t.id))
                .map((t) => (
                  <div
                    key={t.id}
                    className="jp-teamCard"
                    style={{
                      borderColor:
                        state?.controlTeamId === t.id ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.12)",
                      outline:
                        state?.controlTeamId === t.id ? "2px solid rgba(255,255,255,0.9)" : "none",
                    }}
                  >
                    <div className="jp-teamHeader">
                      <div className="jp-teamName">{t.name}</div>
                      <div className="jp-teamScore">{t.score}</div>
                    </div>

                    <div className="jp-playerList">
                      {players
                        .filter((p) => p.teamId === t.id)
                        .map((p) => (
                          <div key={p.id} className="jp-playerRow">
                            <div className="jp-playerLeft">
                              <span className="jp-emoji">{p.emoji}</span>
                              <span className="jp-playerName">{p.name}</span>
                              {buzz.locked && buzz.playerId === p.id ? <span className="jp-bell">🔔</span> : null}
                            </div>

                            <select
                              className="jp-teamSelect"
                              value={p.teamId ?? ""}
                              onChange={(e) =>
                                socket.emit("host:assignTeam", {
                                  playerId: p.id,
                                  teamId: e.target.value,
                                })
                              }
                            >
                              {teams.map((tt) => (
                                <option key={tt.id} value={tt.id}>
                                  {tt.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>

            <div className="jp-subTitle">Unassigned</div>
            {players.filter((p) => !p.teamId).length === 0 ? (
              <div className="jp-muted">No unassigned players.</div>
            ) : (
              <div className="jp-playerList">
                {players
                  .filter((p) => !p.teamId)
                  .map((p) => (
                    <div key={p.id} className="jp-playerRow">
                      <div className="jp-playerLeft">
                        <span className="jp-emoji">{p.emoji}</span>
                        <span className="jp-playerName">{p.name}</span>
                      </div>

                      <select
                        className="jp-teamSelect"
                        defaultValue=""
                        onChange={(e) =>
                          socket.emit("host:assignTeam", {
                            playerId: p.id,
                            teamId: e.target.value,
                          })
                        }
                      >
                        <option value="" disabled>
                          Assign team…
                        </option>
                        {teams.map((tt) => (
                          <option key={tt.id} value={tt.id}>
                            {tt.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* ZONE 3: Current Clue */}
          <div className="jp-panel">
            <div className="jp-panelTitle">Current Clue</div>

            {!clue ? (
              <div className="jp-muted">No clue selected.</div>
            ) : (
              <div className="jp-clueBox">
                <div className="jp-clueQ">
                  ${clue.value} — {clue.question}
                </div>
                <div className="jp-clueA">{clue.answer}</div>

                <div className="jp-clueControls">
                  <button
                    className="jp-btn jp-btnGood"
                    onClick={() => socket.emit("host:mark", { result: "correct" })}
                    disabled={!buzz.locked}
                    title={!buzz.locked ? "No one has buzzed yet." : ""}
                  >
                    Correct
                  </button>
                  <button
                    className="jp-btn jp-btnBad"
                    onClick={() => socket.emit("host:mark", { result: "wrong" })}
                    disabled={!buzz.locked}
                    title={!buzz.locked ? "No one has buzzed yet." : ""}
                  >
                    Wrong
                  </button>
                  <button className="jp-btn" onClick={() => socket.emit("host:mark", { result: "skip" })}>
                    Skip
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ZONE 4: Host Controls */}
          <div className="jp-panel">
            <div className="jp-panelTitle">Host Controls</div>

            <div className="jp-controlsGrid">
              <button className="jp-btn" onClick={() => socket.emit("host:startJaypardy")} disabled={!canStart}>
                Start Game
              </button>

              <button className="jp-btn" onClick={() => socket.emit("host:resetBuzz")}>
                Reset Buzzers
              </button>

              <button className="jp-btn" onClick={() => socket.emit("host:resetGame")}>
                Reset Game
              </button>

              <button className="jp-btn" disabled>
                Round 2 (next)
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
