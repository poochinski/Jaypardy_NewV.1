import { useMemo, useState, useEffect, useRef } from "react";
import { socket, persistentPlayerId } from "../socket";
import "./jaypardyTheme.css";
import { playBuzz } from "../sounds";

const EMOJIS = ["😀","😎","🔥","🐝","🧠","🎯","⚡","🍕","👑","🤖",
                 "🦊","🐸","🎸","🚀","🌊","🎲","🦁","🐯","🍀","💎"];

const BASE = {
  minHeight: "100vh",
  paddingTop: "env(safe-area-inset-top, 0px)",
  background: "#050a2a",
  color: "#f6f7ff",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
};

export default function PlayerScreen({ state }) {
  const [name,         setName]         = useState("");
  const [emoji,        setEmoji]        = useState(EMOJIS[0]);
  const [step,         setStep]         = useState("name"); // "name" | "team"
  const [buzzState,    setBuzzState]    = useState("idle");
  const [wagerInput,   setWagerInput]   = useState("");
  const [finalWager,   setFinalWager]   = useState("");
  const [finalAnswer,  setFinalAnswer]  = useState("");
  const [wagerLocked,  setWagerLocked]  = useState(false);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [buzzFlash,    setBuzzFlash]    = useState(false);
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

  const phase         = state?.phase;
  const buzz          = state?.buzz;
  const paused        = state?.paused ?? false;
  const pauseMessage  = state?.pauseMessage ?? "";
  const finalJaypardy = state?.finalJaypardy ?? null;
  const allTeams      = state?.teams ?? [];
  const allPlayers    = state?.players ?? [];

  const joined = !!me;

  const inFinal       = finalJaypardy && (socket.id in (finalJaypardy.wagers ?? {}));
  const myFinalWager  = finalJaypardy?.wagers?.[socket.id] ?? null;
  const maxFinalWager = myTeam?.score ?? 0;
  const isWagerPlayer = state?.currentClue?.wagerPlayerId === socket.id;
  const maxWager      = Math.max(myTeam?.score ?? 0, 1000);

  const visibleTeams = allTeams.filter((t) =>
    allPlayers.some((p) => p.teamId === t.id)
  );

  // ─── Buzz state ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "clue" && phase !== "dailyDoubleClue") {
      clearTimeout(lostTimer.current); setBuzzState("idle"); return;
    }
    if (!buzz?.locked) { setBuzzState("ready"); return; }
    if (buzz.playerId === socket.id) {
      clearTimeout(lostTimer.current); setBuzzState("won"); playBuzz();
      setBuzzFlash(true); clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setBuzzFlash(false), 600);
    } else {
      setBuzzState("lost"); clearTimeout(lostTimer.current);
      lostTimer.current = setTimeout(() => setBuzzState((prev) => prev === "lost" ? "ready" : prev), 1200);
    }
  }, [phase, buzz?.locked, buzz?.playerId]);

  useEffect(() => () => { clearTimeout(lostTimer.current); clearTimeout(flashTimer.current); }, []);

  const doBuzz = () => {
    if (buzzState !== "ready") return;
    socket.emit("player:buzz", { clientTimestamp: Date.now() });
  };

  const doWager = () => {
    const amount = parseInt(wagerInput, 10);
    if (!isFinite(amount) || amount < 1) return;
    socket.emit("player:submitWager", { amount }); setWagerInput("");
  };

  const doFinalWager = () => {
    const amount = parseInt(finalWager, 10);
    if (!isFinite(amount) || amount < 0) return;
    socket.emit("player:submitFinalWager", { amount }); setWagerLocked(true);
  };

  const doFinalAnswer = () => {
    if (!finalAnswer.trim()) return;
    socket.emit("player:submitFinalAnswer", { answer: finalAnswer.trim() }); setAnswerLocked(true);
  };

  // Join — just registers name/emoji, no team yet
  const join = () => {
    if (!name.trim()) return;
    socket.emit("player:join", { name: name.trim(), emoji, playerId: persistentPlayerId });
  };

  // Pick a team in the lobby
  const pickTeam = (teamId) => {
    socket.emit("player:selectTeam", { teamId });
  };

  // ── When phase changes to lobby and player is already joined but has no team,
  // go back to team selection step
  useEffect(() => {
    if (phase === "lobby" && joined && !me?.teamId) {
      setStep("team");
    }
  }, [phase, joined, me?.teamId]);

  // ─── Pregame — lobby not open yet ────────────────────────────────────────
  if (phase === "pregame") {
    if (!joined) {
      // Show join form — they can get their name/emoji ready
      return (
        <div style={{ ...BASE, display: "flex", flexDirection: "column", padding: "24px 20px" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 2, color: "#ffdd75" }}>JAYPARDY</div>
            <div style={{ fontSize: 13, color: "rgba(246,247,255,0.4)", marginTop: 4 }}>Get ready — lobby opening soon</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(246,247,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Your Name</div>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && join()} placeholder="Type your name…" maxLength={32}
              style={{ width: "100%", padding: "16px", fontSize: 18, fontWeight: 700, borderRadius: 14, border: "2px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.07)", color: "#f6f7ff", boxSizing: "border-box", outline: "none" }}
              onFocus={(e) => e.target.style.borderColor = "rgba(255,221,117,0.5)"}
              onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.15)"} />
          </div>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(246,247,255,0.5)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Pick Your Emoji</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => setEmoji(e)} style={{ fontSize: 28, height: 56, borderRadius: 14, border: emoji === e ? "2px solid #ffdd75" : "2px solid rgba(255,255,255,0.08)", background: emoji === e ? "rgba(255,221,117,0.15)" : "rgba(255,255,255,0.04)", cursor: "pointer", transform: emoji === e ? "scale(1.1)" : "scale(1)", transition: "transform 0.1s" }}>{e}</button>
              ))}
            </div>
          </div>
          <button onClick={join} disabled={!name.trim()} style={{ width: "100%", padding: 18, fontSize: 20, fontWeight: 900, borderRadius: 16, border: "none", background: name.trim() ? "#ffdd75" : "rgba(255,255,255,0.08)", color: name.trim() ? "#000" : "rgba(255,255,255,0.3)", cursor: name.trim() ? "pointer" : "not-allowed" }}>
            Get Ready
          </button>
        </div>
      );
    }

    // Already submitted name — waiting for lobby
    return (
      <div style={{ ...BASE, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>{me.emoji}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#ffdd75" }}>{me.name}</div>
        <div style={{ width: 48, height: 48, border: "3px solid rgba(255,221,117,0.3)", borderTopColor: "#ffdd75", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(246,247,255,0.6)" }}>Waiting for host to open the lobby…</div>
        <div style={{ fontSize: 13, color: "rgba(246,247,255,0.3)" }}>You'll be able to pick your team shortly</div>
      </div>
    );
  }

  // ─── Lobby — pick a team ──────────────────────────────────────────────────
  if (phase === "lobby") {

    // Not joined yet — show name/emoji form
    if (!joined) {
      return (
        <div style={{ ...BASE, display: "flex", flexDirection: "column", padding: "24px 20px" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 2, color: "#ffdd75" }}>JAYPARDY</div>
            <div style={{ fontSize: 13, color: "rgba(246,247,255,0.4)", marginTop: 4 }}>Enter your name to join</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(246,247,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Your Name</div>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && join()} placeholder="Type your name…" maxLength={32}
              style={{ width: "100%", padding: "16px", fontSize: 18, fontWeight: 700, borderRadius: 14, border: "2px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.07)", color: "#f6f7ff", boxSizing: "border-box", outline: "none" }}
              onFocus={(e) => e.target.style.borderColor = "rgba(255,221,117,0.5)"}
              onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.15)"} />
          </div>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(246,247,255,0.5)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Pick Your Emoji</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => setEmoji(e)} style={{ fontSize: 28, height: 56, borderRadius: 14, border: emoji === e ? "2px solid #ffdd75" : "2px solid rgba(255,255,255,0.08)", background: emoji === e ? "rgba(255,221,117,0.15)" : "rgba(255,255,255,0.04)", cursor: "pointer", transform: emoji === e ? "scale(1.1)" : "scale(1)", transition: "transform 0.1s" }}>{e}</button>
              ))}
            </div>
          </div>
          <button onClick={join} disabled={!name.trim()} style={{ width: "100%", padding: 18, fontSize: 20, fontWeight: 900, borderRadius: 16, border: "none", background: name.trim() ? "#ffdd75" : "rgba(255,255,255,0.08)", color: name.trim() ? "#000" : "rgba(255,255,255,0.3)", cursor: name.trim() ? "pointer" : "not-allowed" }}>
            Join Game
          </button>
        </div>
      );
    }

    // Joined — show team picker
    return (
      <div style={{ ...BASE, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 26 }}>{me.emoji}</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{me.name}</div>
            {myTeam
              ? <div style={{ fontSize: 12, color: myTeam.color, fontWeight: 700 }}>Team {myTeam.name}</div>
              : <div style={{ fontSize: 12, color: "rgba(246,247,255,0.4)" }}>Pick your team below</div>
            }
          </div>
          {myTeam && (
            <div style={{ marginLeft: "auto", background: myTeam.color, color: "#fff", fontWeight: 900, fontSize: 13, padding: "4px 10px", borderRadius: 8 }}>
              Joined!
            </div>
          )}
        </div>

        {/* Team picker */}
        <div style={{ flex: 1, padding: "20px 20px", overflowY: "auto" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(246,247,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16, textAlign: "center" }}>
            {myTeam ? "Tap a different team to switch" : "Choose your team"}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {allTeams.map((team) => {
              const members = allPlayers.filter((p) => p.teamId === team.id);
              const isMyTeam = me?.teamId === team.id;
              return (
                <button
                  key={team.id}
                  onClick={() => pickTeam(team.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "16px 20px", borderRadius: 16,
                    border: isMyTeam ? `2px solid ${team.color}` : `1px solid ${team.color}55`,
                    background: isMyTeam ? `${team.color}22` : `${team.color}0a`,
                    cursor: "pointer", textAlign: "left",
                    transform: isMyTeam ? "scale(1.02)" : "scale(1)",
                    transition: "transform 0.1s, border 0.1s",
                  }}
                >
                  {/* Color dot */}
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: team.color, flexShrink: 0, border: isMyTeam ? "2px solid #fff" : "none" }} />

                  {/* Team info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 18, color: isMyTeam ? team.color : "#f6f7ff" }}>
                      {team.name}
                      {isMyTeam && <span style={{ fontSize: 13, fontWeight: 700, marginLeft: 8, opacity: 0.8 }}>← You</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(246,247,255,0.5)", marginTop: 3 }}>
                      {members.length === 0
                        ? "No one yet"
                        : members.map((p) => `${p.emoji} ${p.name}`).join("  ·  ")
                      }
                    </div>
                  </div>

                  {/* Member count badge */}
                  <div style={{ background: isMyTeam ? team.color : "rgba(255,255,255,0.1)", color: isMyTeam ? "#fff" : "rgba(246,247,255,0.5)", fontWeight: 900, fontSize: 14, width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {members.length}
                  </div>
                </button>
              );
            })}
          </div>

          {myTeam && (
            <div style={{ textAlign: "center", marginTop: 24, padding: "16px", borderRadius: 14, background: "rgba(33,197,93,0.08)", border: "1px solid rgba(33,197,93,0.25)" }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#21c55d", marginBottom: 4 }}>You're on Team {myTeam.name}!</div>
              <div style={{ fontSize: 13, color: "rgba(246,247,255,0.4)" }}>Waiting for host to start the game…</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Pause overlay ────────────────────────────────────────────────────────
  if (paused) {
    return (
      <div style={{ ...BASE, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 72, lineHeight: 1 }}>⏸</div>
        <div style={{ fontSize: "clamp(24px, 6vw, 36px)", fontWeight: 900, color: "#ffdd75", lineHeight: 1.2 }}>{pauseMessage || "Stand By"}</div>
        <div style={{ fontSize: 14, color: "rgba(246,247,255,0.4)", fontWeight: 700 }}>Game paused — host will resume shortly</div>
      </div>
    );
  }

  // ─── Not joined yet during active game ───────────────────────────────────
  if (!joined) {
    return (
      <div style={{ ...BASE, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: "#ffdd75" }}>JAYPARDY</div>
        <div style={{ fontSize: 15, color: "rgba(246,247,255,0.5)" }}>Game is in progress</div>
        <div style={{ fontSize: 13, color: "rgba(246,247,255,0.3)" }}>Ask the host to reset if you need to join</div>
      </div>
    );
  }

  // ─── Buzz screen ──────────────────────────────────────────────────────────
  if (phase === "clue" || phase === "dailyDoubleClue") {
    const clue = state?.currentClue;
    const buzzColors = {
      idle:  { bg: "#0d1117", border: "rgba(255,255,255,0.08)", text: "rgba(255,255,255,0.2)" },
      ready: { bg: "#1a3bd1", border: "rgba(100,140,255,0.6)",  text: "#ffdd75" },
      won:   { bg: "#15803d", border: "rgba(74,222,128,0.8)",   text: "#ffffff" },
      lost:  { bg: "#991b1b", border: "rgba(252,165,165,0.6)",  text: "#ffffff" },
    };
    const bc = buzzColors[buzzState] ?? buzzColors.idle;
    const buzzLabels = { idle: "BUZZ", ready: "BUZZ IN", won: "YOU GOT IT!", lost: "TOO SLOW" };

    return (
      <div style={{ ...BASE, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "calc(env(safe-area-inset-top, 0px) + 14px) 18px 14px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 22 }}>{me.emoji}</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15 }}>{me.name}</div>
              {myTeam && <div style={{ fontSize: 12, color: myTeam.color, fontWeight: 700 }}>{myTeam.name}</div>}
            </div>
          </div>
          {myTeam && <div style={{ background: myTeam.color, color: "#fff", fontWeight: 900, fontSize: 18, padding: "6px 14px", borderRadius: 10 }}>${myTeam.score.toLocaleString()}</div>}
        </div>
        {clue && (
          <div style={{ padding: "16px 18px 0", textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(246,247,255,0.4)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{clue.category}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#ffdd75" }}>
              {phase === "dailyDoubleClue" ? `Daily Double — $${state?.wager?.amount?.toLocaleString() ?? "?"}` : `$${clue.value}`}
            </div>
          </div>
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 20px 32px" }}>
          <button onClick={doBuzz} style={{ width: "100%", flex: 1, maxHeight: 320, fontSize: buzzState === "won" || buzzState === "lost" ? 32 : 56, fontWeight: 900, borderRadius: 28, letterSpacing: 2, border: `3px solid ${bc.border}`, background: bc.bg, color: bc.text, cursor: buzzState === "ready" ? "pointer" : "not-allowed", transition: "background 0.1s ease, transform 0.08s ease", transform: buzzFlash ? "scale(0.97)" : "scale(1)", boxShadow: buzzState === "ready" ? "0 0 40px rgba(26,59,209,0.4)" : buzzState === "won" ? "0 0 40px rgba(21,128,61,0.5)" : "none" }}>
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

  // ─── Daily Double wager ───────────────────────────────────────────────────
  if (phase === "dailyDouble") {
    return (
      <div style={{ ...BASE, display: "flex", flexDirection: "column", padding: "24px 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(246,247,255,0.4)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{state?.currentClue?.category}</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: "#ffdd75", letterSpacing: -1 }}>Daily Double</div>
        </div>
        {isWagerPlayer ? (
          <>
            <div style={{ fontSize: 14, color: "rgba(246,247,255,0.6)", marginBottom: 8 }}>Your wager — max <span style={{ color: "#ffdd75", fontWeight: 900 }}>${maxWager.toLocaleString()}</span></div>
            <input autoFocus type="number" value={wagerInput} onChange={(e) => setWagerInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doWager()} placeholder="Enter amount…" min={1} max={maxWager}
              style={{ width: "100%", padding: "18px", fontSize: 28, fontWeight: 900, borderRadius: 14, border: "2px solid rgba(255,221,117,0.4)", background: "rgba(255,221,117,0.07)", color: "#ffdd75", textAlign: "center", boxSizing: "border-box", marginBottom: 16, outline: "none" }} />
            <button onClick={doWager} disabled={!wagerInput} style={{ width: "100%", padding: 18, fontSize: 18, fontWeight: 900, borderRadius: 14, border: "none", background: wagerInput ? "#ffdd75" : "rgba(255,255,255,0.08)", color: wagerInput ? "#000" : "rgba(255,255,255,0.3)", cursor: wagerInput ? "pointer" : "not-allowed" }}>Lock In Wager</button>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(246,247,255,0.4)", fontSize: 15, textAlign: "center" }}>Another player is entering their wager…</div>
        )}
      </div>
    );
  }

  // ─── Default layout ───────────────────────────────────────────────────────
  const renderPhaseContent = () => {
    if (phase === "board") {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px" }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(246,247,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Scores</div>
            {visibleTeams.map((t) => {
              const isMyTeam = t.id === me?.teamId;
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, marginBottom: 8, background: isMyTeam ? `${t.color}18` : "rgba(255,255,255,0.03)", border: isMyTeam ? `1px solid ${t.color}55` : "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontWeight: isMyTeam ? 900 : 600, fontSize: 14, color: isMyTeam ? t.color : "#f6f7ff" }}>{t.name} {isMyTeam && "(You)"}</div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: isMyTeam ? t.color : "#f6f7ff" }}>${t.score.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
          <div style={{ textAlign: "center", color: "rgba(246,247,255,0.3)", fontSize: 13 }}>Host is picking the next clue…</div>
        </div>
      );
    }

    if (phase === "finalWager" && inFinal) {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#ffdd75", marginBottom: 6 }}>FINAL JAYPARDY</div>
            <div style={{ fontSize: 15, color: "rgba(246,247,255,0.7)" }}>Category: <span style={{ color: "#fff", fontWeight: 700 }}>{finalJaypardy?.category}</span></div>
          </div>
          {wagerLocked || myFinalWager !== null ? (
            <div style={{ textAlign: "center", padding: 24, background: "rgba(33,197,93,0.08)", borderRadius: 16, border: "1px solid rgba(33,197,93,0.3)" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#21c55d", marginBottom: 8 }}>Wager locked in!</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#ffdd75" }}>${(myFinalWager ?? parseInt(finalWager)).toLocaleString()}</div>
              <div style={{ fontSize: 13, color: "rgba(246,247,255,0.4)", marginTop: 10 }}>Waiting for the clue…</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 14, color: "rgba(246,247,255,0.6)", marginBottom: 8 }}>Your wager — max <span style={{ color: "#ffdd75", fontWeight: 900 }}>${maxFinalWager.toLocaleString()}</span></div>
              <input autoFocus type="number" value={finalWager} onChange={(e) => setFinalWager(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doFinalWager()} placeholder="Enter amount…" min={0} max={maxFinalWager}
                style={{ width: "100%", padding: "18px", fontSize: 28, fontWeight: 900, borderRadius: 14, border: "2px solid rgba(255,221,117,0.4)", background: "rgba(255,221,117,0.07)", color: "#ffdd75", textAlign: "center", boxSizing: "border-box", marginBottom: 16, outline: "none" }} />
              <button onClick={doFinalWager} disabled={finalWager === ""} style={{ width: "100%", padding: 18, fontSize: 18, fontWeight: 900, borderRadius: 14, border: "none", background: finalWager !== "" ? "#ffdd75" : "rgba(255,255,255,0.08)", color: finalWager !== "" ? "#000" : "rgba(255,255,255,0.3)", cursor: finalWager !== "" ? "pointer" : "not-allowed" }}>Lock In Wager</button>
            </>
          )}
        </div>
      );
    }

    if (phase === "finalWager" && !inFinal) {
      return <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center", padding: "20px" }}><div style={{ fontSize: 28, fontWeight: 900, color: "#ffdd75" }}>FINAL JAYPARDY</div><div style={{ fontSize: 14, color: "rgba(246,247,255,0.4)" }}>Players are placing their wagers…</div></div>;
    }

    if (phase === "finalClue" && inFinal) {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#ffdd75", textAlign: "center", marginBottom: 16 }}>FINAL JAYPARDY</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", lineHeight: 1.5, marginBottom: 20, textAlign: "center", padding: "16px", background: "rgba(255,255,255,0.04)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)" }}>{finalJaypardy?.question}</div>
          {answerLocked ? (
            <div style={{ textAlign: "center", padding: 20, background: "rgba(33,197,93,0.08)", borderRadius: 16, border: "1px solid rgba(33,197,93,0.3)" }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#21c55d", marginBottom: 8 }}>Answer submitted!</div>
              <div style={{ fontSize: 15, color: "rgba(246,247,255,0.7)", fontStyle: "italic" }}>"{finalAnswer}"</div>
              <div style={{ fontSize: 12, color: "rgba(246,247,255,0.4)", marginTop: 8 }}>Waiting for the reveal…</div>
            </div>
          ) : (
            <>
              <input value={finalAnswer} onChange={(e) => setFinalAnswer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doFinalAnswer()} placeholder="Who is… / What is…" maxLength={200}
                style={{ width: "100%", padding: "16px", fontSize: 16, fontWeight: 700, borderRadius: 14, border: "2px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.07)", color: "#fff", boxSizing: "border-box", marginBottom: 14, outline: "none" }} />
              <button onClick={doFinalAnswer} disabled={!finalAnswer.trim()} style={{ width: "100%", padding: 18, fontSize: 18, fontWeight: 900, borderRadius: 14, border: "none", background: finalAnswer.trim() ? "#1a3bd1" : "rgba(255,255,255,0.08)", color: finalAnswer.trim() ? "#ffdd75" : "rgba(255,255,255,0.3)", cursor: finalAnswer.trim() ? "pointer" : "not-allowed" }}>Submit Answer</button>
            </>
          )}
        </div>
      );
    }

    if (phase === "finalClue" && !inFinal) {
      return <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center", padding: "20px" }}><div style={{ fontSize: 24, fontWeight: 900, color: "#ffdd75" }}>FINAL JAYPARDY</div><div style={{ fontSize: 14, color: "rgba(246,247,255,0.4)" }}>Players are writing their answers…</div></div>;
    }

    if (phase === "finalReveal") {
      return <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center", padding: "20px" }}><div style={{ fontSize: 24, fontWeight: 900, color: "#ffdd75" }}>FINAL JAYPARDY</div><div style={{ fontSize: 14, color: "rgba(246,247,255,0.4)" }}>Host is revealing answers…</div></div>;
    }

    if (phase === "gameOver") {
      const sorted = [...allTeams].filter((t) => allPlayers.some((p) => p.teamId === t.id)).sort((a, b) => b.score - a.score);
      const myRank = sorted.findIndex((t) => t.id === me?.teamId);
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "20px", textAlign: "center" }}>
          <div style={{ fontSize: 40, fontWeight: 900, color: "#ffdd75" }}>GAME OVER</div>
          {myRank === 0 && <div style={{ fontSize: 48 }}>🏆</div>}
          {myTeam && (
            <div style={{ padding: "16px 24px", borderRadius: 14, background: `${myTeam.color}18`, border: `2px solid ${myTeam.color}55` }}>
              <div style={{ fontSize: 14, color: "rgba(246,247,255,0.5)", marginBottom: 4 }}>
                {myRank === 0 ? "Winner!" : `${myRank + 1}${myRank === 1 ? "nd" : myRank === 2 ? "rd" : "th"} place`}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: myTeam.color }}>${myTeam.score.toLocaleString()}</div>
            </div>
          )}
          <div style={{ fontSize: 14, color: "rgba(246,247,255,0.4)", marginTop: 8 }}>Thanks for playing!</div>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ ...BASE, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "calc(env(safe-area-inset-top, 0px) + 14px) 18px 14px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22 }}>{me.emoji}</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15 }}>{me.name}</div>
            {myTeam ? <div style={{ fontSize: 12, color: myTeam.color, fontWeight: 700 }}>{myTeam.name}</div> : <div style={{ fontSize: 12, color: "rgba(255,100,100,0.8)" }}>No team yet</div>}
          </div>
        </div>
        {myTeam && <div style={{ background: myTeam.color, color: "#fff", fontWeight: 900, fontSize: 18, padding: "6px 14px", borderRadius: 10 }}>${myTeam.score.toLocaleString()}</div>}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
        {renderPhaseContent()}
      </div>
    </div>
  );
}