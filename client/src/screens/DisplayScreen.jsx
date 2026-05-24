import { useState, useEffect, useRef } from "react";
import "./jaypardyTheme.css";
import { playDDChime, playCorrect, playWrong } from "../sounds";
import { socket } from "../socket";

// ─── Simple QR code via Google Charts API ────────────────────────────────────
const GAME_URL = "https://jaypardyv2.up.railway.app/";

function QRCode({ size = 120 }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(GAME_URL)}&bgcolor=050a2a&color=ffdd75&margin=6`;
  return (
    <img src={url} alt="QR code" width={size} height={size}
      style={{ borderRadius: 8, display: "block" }} />
  );
}

export default function DisplayScreen({ state }) {
  const phase        = state?.phase;
  const board        = state?.board;
  const clue         = state?.currentClue;
  const buzz         = state?.buzz;
  const teams        = state?.teams ?? [];
  const players      = state?.players ?? [];
  const paused       = state?.paused ?? false;
  const pauseMessage = state?.pauseMessage ?? "";
  const introIndex   = state?.introIndex ?? -1;

  const [revealAnswer,  setRevealAnswer]  = useState(null);
  const [wrongFlash,    setWrongFlash]    = useState(null);
  const [muted,         setMuted]         = useState(false);
  const [isFullscreen,  setIsFullscreen]  = useState(false);
  const [flashTeams,    setFlashTeams]    = useState({});
  const [videoPlaying,  setVideoPlaying]  = useState(false);
  const [audioPlaying,  setAudioPlaying]  = useState(false);
  const [clueVisible,   setClueVisible]   = useState(false);
  const videoRef        = useRef(null);
  const audioRef        = useRef(null);
  const prevPhaseRef    = useRef(null);
  const prevBuzzRef     = useRef(null);
  const revealTimer     = useRef(null);
  const wrongTimer      = useRef(null);
  const ddChimeFired    = useRef(false);
  const mutedRef        = useRef(false);
  const correctFiredRef = useRef(false);
  const prevScoresRef   = useRef({});

  useEffect(() => { mutedRef.current = muted; }, [muted]);

  // Animate clue in when selected
  useEffect(() => {
    if (phase === "clue" || phase === "dailyDoubleClue") {
      setClueVisible(false);
      const t = setTimeout(() => setClueVisible(true), 80);
      return () => clearTimeout(t);
    }
  }, [clue?.clueId]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      (document.documentElement.requestFullscreen
        ?? document.documentElement.webkitRequestFullscreen
        ?? document.documentElement.mozRequestFullScreen
        ?? document.documentElement.msRequestFullscreen
      )?.call(document.documentElement);
    } else {
      (document.exitFullscreen
        ?? document.webkitExitFullscreen
        ?? document.mozCancelFullScreen
        ?? document.msExitFullscreen
      )?.call(document);
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!(
      document.fullscreenElement || document.webkitFullscreenElement ||
      document.mozFullScreenElement || document.msFullscreenElement
    ));
    ["fullscreenchange","webkitfullscreenchange","mozfullscreenchange","MSFullscreenChange"]
      .forEach((e) => document.addEventListener(e, onFsChange));
    return () => ["fullscreenchange","webkitfullscreenchange","mozfullscreenchange","MSFullscreenChange"]
      .forEach((e) => document.removeEventListener(e, onFsChange));
  }, []);

  const visibleTeams = teams.filter((t) => players.some((p) => p.teamId === t.id));
  const teamById     = Object.fromEntries(teams.map((t) => [t.id, t]));

  useEffect(() => {
    if (phase === "dailyDouble" && !ddChimeFired.current && !mutedRef.current) {
      ddChimeFired.current = true; playDDChime();
    }
    if (phase !== "dailyDouble") ddChimeFired.current = false;
  }, [phase]);

  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    const prevBuzz  = prevBuzzRef.current;
    if (
      (prevPhase === "clue" || prevPhase === "dailyDoubleClue") &&
      phase === "board" && prevBuzz?.locked && prevBuzz?.teamId &&
      correctFiredRef.current
    ) {
      correctFiredRef.current = false;
      const team = teamById[prevBuzz.teamId];
      setRevealAnswer({ color: team?.color ?? "#21c55d", name: prevBuzz.name, emoji: prevBuzz.emoji });
      clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(() => setRevealAnswer(null), 2800);
    } else {
      correctFiredRef.current = false;
    }
    prevPhaseRef.current = phase;
    prevBuzzRef.current  = buzz;
  }, [phase, buzz]);

  useEffect(() => {
    const onCue = (cue) => {
      if (cue === "correct") { correctFiredRef.current = true; if (!mutedRef.current) playCorrect(); }
      if (cue === "wrong"  ) { if (!mutedRef.current) playWrong(); }
    };
    socket.on("sound:cue", onCue);
    return () => socket.off("sound:cue", onCue);
  }, []);

  useEffect(() => {
    const onPlay = () => {
      setVideoPlaying(true);
      if (videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.play(); }
    };
    const onPause  = () => { if (videoRef.current) videoRef.current.pause(); };
    const onReplay = () => {
      setVideoPlaying(true);
      if (videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.play(); }
    };
    const onAudioPlay = () => {
      setAudioPlaying(true);
      if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); }
    };
    const onAudioPause  = () => { if (audioRef.current) audioRef.current.pause(); };
    const onAudioReplay = () => {
      setAudioPlaying(true);
      if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); }
    };
    socket.on("video:play",   onPlay);   socket.on("video:pause",  onPause);  socket.on("video:replay", onReplay);
    socket.on("audio:play",   onAudioPlay); socket.on("audio:pause", onAudioPause); socket.on("audio:replay", onAudioReplay);
    return () => {
      socket.off("video:play", onPlay); socket.off("video:pause", onPause); socket.off("video:replay", onReplay);
      socket.off("audio:play", onAudioPlay); socket.off("audio:pause", onAudioPause); socket.off("audio:replay", onAudioReplay);
    };
  }, []);

  useEffect(() => { setVideoPlaying(false); setAudioPlaying(false); }, [clue?.clueId]);

  useEffect(() => {
    const prevBuzz = prevBuzzRef.current;
    if (
      (phase === "clue" || phase === "dailyDoubleClue") &&
      prevBuzz?.locked && !buzz?.locked && prevBuzz?.playerId
    ) {
      const team = teamById[prevBuzz.teamId];
      setWrongFlash({ name: prevBuzz.name, emoji: prevBuzz.emoji, color: team?.color ?? "#ef4444" });
      clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => setWrongFlash(null), 1600);
    }
  }, [buzz?.locked]);

  useEffect(() => () => { clearTimeout(revealTimer.current); clearTimeout(wrongTimer.current); }, []);

  useEffect(() => {
    const newFlashes = {};
    teams.forEach((t) => {
      const prev = prevScoresRef.current[t.id];
      if (prev !== undefined && prev !== t.score)
        newFlashes[t.id] = t.score > prev ? "pos" : "neg";
      prevScoresRef.current[t.id] = t.score;
    });
    if (Object.keys(newFlashes).length) {
      setFlashTeams(newFlashes);
      setTimeout(() => setFlashTeams({}), 700);
    }
  }, [teams]);

  // ─── Score strip ──────────────────────────────────────────────────────────
  const ScoreStrip = () => (
    <div className="jp-score-strip">
      {visibleTeams.length === 0 ? (
        <div style={{ flex:1, padding:"10px 16px", color:"rgba(246,247,255,0.3)", fontSize:13 }}>Waiting for players…</div>
      ) : visibleTeams.map((t) => {
        const names = players.filter((p) => p.teamId === t.id).map((p) => `${p.emoji} ${p.name}`).join("  ·  ");
        const flash = flashTeams[t.id];
        return (
          <div key={t.id} className={`jp-score-col ${flash === "pos" ? "flash-pos" : flash === "neg" ? "flash-neg" : ""}`}>
            <div className="jp-score-dot" style={{ background: t.color }} />
            <div className="jp-score-names">{names}</div>
            <div className="jp-score-val" style={{ color: t.color, transition:"all 0.3s ease" }}>${t.score.toLocaleString()}</div>
          </div>
        );
      })}
      <div style={{ display:"flex", gap:6, padding:"0 10px", alignItems:"center", flexShrink:0 }}>
        <button onClick={() => setMuted((m) => !m)}
          style={{ width:28, height:28, borderRadius:6, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.06)", cursor:"pointer", fontSize:13, color:"rgba(246,247,255,0.6)" }}>
          {muted ? "🔇" : "🔊"}
        </button>
        <button onClick={toggleFullscreen}
          style={{ width:28, height:28, borderRadius:6, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.06)", cursor:"pointer", fontSize:11, color:"rgba(246,247,255,0.6)" }}>
          {isFullscreen ? "⊠" : "⛶"}
        </button>
      </div>
    </div>
  );

  // ─── Paused ───────────────────────────────────────────────────────────────
  if (paused) {
    return (
      <div className="jp-root" style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
        <ScoreStrip />
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, textAlign:"center", padding:40 }}>
          <div style={{ fontSize:"clamp(40px,7vw,72px)", fontWeight:900, color:"#ffdd75" }}>PAUSED</div>
          {pauseMessage && <div style={{ fontSize:"clamp(16px,2.5vw,24px)", color:"rgba(246,247,255,0.6)", maxWidth:700 }}>{pauseMessage}</div>}
        </div>
      </div>
    );
  }

  // ─── Correct reveal ───────────────────────────────────────────────────────
  if (revealAnswer) {
    return (
      <div className="jp-root" style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
        <ScoreStrip />
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, textAlign:"center", padding:40 }}>
          <div className="jp-correct-pop" style={{ fontSize:"clamp(32px,6vw,64px)", fontWeight:900, color:revealAnswer.color }}>
            {revealAnswer.emoji} {revealAnswer.name}
          </div>
          <div style={{ fontSize:"clamp(18px,3vw,28px)", fontWeight:700, color:"rgba(246,247,255,0.5)", letterSpacing:2, textTransform:"uppercase" }}>Correct!</div>
        </div>
      </div>
    );
  }

  // ─── Daily Double ─────────────────────────────────────────────────────────
  if (phase === "dailyDouble" && clue) {
    const controlPlayer = players.find((p) => p.id === clue.wagerPlayerId);
    return (
      <div className="jp-root" style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
        <ScoreStrip />
        <div className="jp-dd-splash">
          <div className="jp-dd-title">DAILY DOUBLE</div>
          <div className="jp-dd-sub">{clue.category}</div>
          {controlPlayer && (
            <div style={{ marginTop:8, fontSize:"clamp(16px,2.5vw,22px)", color:"rgba(246,247,255,0.55)", fontWeight:700 }}>
              {controlPlayer.emoji} {controlPlayer.name} is wagering…
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Final Jaypardy — Wager ───────────────────────────────────────────────
  if (phase === "finalWager" && state?.finalJaypardy) {
    const fj        = state.finalJaypardy;
    const submitted = Object.keys(fj.wagers ?? {}).length;
    return (
      <div className="jp-root" style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
        <ScoreStrip />
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20, textAlign:"center", padding:40 }}>
          <div style={{ fontSize:"clamp(40px,7vw,80px)", fontWeight:900, color:"#ffdd75", lineHeight:1, letterSpacing:-1 }}>FINAL JAYPARDY</div>
          <div style={{ fontSize:"clamp(18px,3vw,28px)", fontWeight:700, color:"rgba(246,247,255,0.7)" }}>{fj.category}</div>
          <div style={{ fontSize:"clamp(14px,2vw,20px)", color:"rgba(246,247,255,0.4)", marginTop:8 }}>{submitted} / {players.length} wagers placed</div>
        </div>
      </div>
    );
  }

  // ─── Final Jaypardy — Clue ────────────────────────────────────────────────
  if (phase === "finalClue" && state?.finalJaypardy) {
    const fj        = state.finalJaypardy;
    const submitted = Object.keys(fj.answers ?? {}).length;
    return (
      <div className="jp-root" style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
        <ScoreStrip />
        <div style={{ flex:1, display:"flex", flexDirection:"column", padding:40 }}>
          <div style={{ textAlign:"center", marginBottom:32 }}>
            <div style={{ fontSize:18, fontWeight:700, color:"rgba(246,247,255,0.5)", textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>Final Jaypardy — {fj.category}</div>
          </div>
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", textAlign:"center" }}>
            <div className="jp-clue-text">{fj.question}</div>
          </div>
          <div style={{ textAlign:"center", color:"rgba(246,247,255,0.4)", fontSize:16, fontWeight:700, padding:"16px 0" }}>{submitted} / {players.length} answers submitted</div>
        </div>
      </div>
    );
  }

  // ─── Final Jaypardy — Reveal ──────────────────────────────────────────────
  if (phase === "finalReveal" && state?.finalJaypardy) {
    const fj       = state.finalJaypardy;
    const revealed = fj.revealed ?? [];
    return (
      <div className="jp-root" style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
        <ScoreStrip />
        <div style={{ flex:1, display:"flex", flexDirection:"column", padding:32, gap:16 }}>
          <div style={{ textAlign:"center", fontSize:28, fontWeight:900, color:"#ffdd75", marginBottom:8 }}>FINAL JAYPARDY — REVEAL</div>
          {revealed.map((pid) => {
            const p    = players.find((x) => x.persistentId === pid || x.id === pid);
            const team = teams.find((t) => t.id === p?.teamId);
            return (
              <div key={pid} className="jp-fade-in" style={{ padding:"16px 20px", borderRadius:16, background:`${team?.color ?? "#1a3bd1"}20`, border:`2px solid ${team?.color ?? "#1a3bd1"}`, display:"flex", alignItems:"center", gap:16 }}>
                <div style={{ fontSize:32 }}>{p?.emoji}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:900, fontSize:20, color:team?.color ?? "#ffdd75" }}>{p?.name}</div>
                  <div style={{ fontSize:16, color:"#fff", marginTop:4, fontStyle:fj.answers[pid] ? "normal":"italic", opacity:fj.answers[pid] ? 1:0.5 }}>{fj.answers[pid] || "No answer"}</div>
                </div>
                <div style={{ background:team?.color ?? "#ffdd75", color:"#fff", fontWeight:900, fontSize:18, padding:"6px 16px", borderRadius:10 }}>
                  Wager: ${fj.wagers[pid]?.toLocaleString() ?? "?"}
                </div>
              </div>
            );
          })}
          {revealed.length === 0 && (
            <div style={{ textAlign:"center", color:"rgba(246,247,255,0.4)", fontSize:16, marginTop:40 }}>Host will reveal players one by one…</div>
          )}
        </div>
      </div>
    );
  }

  // ─── Game Over ────────────────────────────────────────────────────────────
  if (phase === "gameOver") {
    const sorted = [...teams].filter((t) => players.some((p) => p.teamId === t.id)).sort((a,b) => b.score - a.score);
    return (
      <div className="jp-root" style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
        <ScoreStrip />
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:40, gap:20, textAlign:"center" }}>
          <div className="jp-gameover-title">GAME OVER</div>
          {sorted.map((t, i) => {
            const teamPlayers = players.filter((p) => p.teamId === t.id);
            return (
              <div key={t.id} className={`jp-gameover-row jp-fade-in`}
                style={{ background: i===0 ? "rgba(255,221,117,0.12)":"rgba(255,255,255,0.04)", border: i===0 ? "2px solid rgba(255,221,117,0.5)":"1px solid rgba(255,255,255,0.08)", animationDelay:`${i*0.15}s` }}>
                <div className="jp-gameover-rank">{i===0 ? "🏆" : `${i+1}.`}</div>
                <div className="jp-gameover-names" style={{ color: i===0 ? "#ffdd75":"#f6f7ff" }}>
                  {teamPlayers.map((p) => `${p.emoji} ${p.name}`).join("  ·  ")}
                </div>
                <div className="jp-gameover-score" style={{ background:t.color }}>${t.score.toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Category Introductions ───────────────────────────────────────────────
  if (phase === "introducing" && board) {
    const totalCats   = board.columns.length;
    const allRevealed = introIndex >= totalCats;
    const currentCat  = introIndex >= 0 && introIndex < totalCats ? board.columns[introIndex] : null;

    if (introIndex < 0) {
      return (
        <div className="jp-root" style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
          <ScoreStrip />
          <div className="jp-splash" style={{ flex:1 }}>
            <div className="jp-splash-overlay" />
            <div className="jp-splash-content">
              <div style={{ fontSize:"clamp(14px,2vw,18px)", fontWeight:700, color:"rgba(246,247,255,0.5)", letterSpacing:3, textTransform:"uppercase", marginBottom:8 }}>Get ready</div>
              <div style={{ fontSize:"clamp(13px,1.8vw,16px)", color:"rgba(246,247,255,0.35)" }}>Categories coming up…</div>
            </div>
          </div>
        </div>
      );
    }

    if (allRevealed) {
      return (
        <div className="jp-root" style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
          <ScoreStrip />
          <div className="jp-board-fullheight">
            <div className="jp-boardGrid">
              {board.columns.map((col, ci) => (
                <div className="jp-col" key={ci}>
                  <div className="jp-cat">{col.title}</div>
                  {col.clues.map((c, ri) => (
                    <div key={`${ci}-${ri}`} className="jp-cell" style={{ cursor:"default" }}>${c.value}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="jp-root" style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
        <ScoreStrip />
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"40px 32px", gap:20 }}>
          <div style={{ fontSize:"clamp(14px,2vw,18px)", fontWeight:700, color:"rgba(246,247,255,0.4)", letterSpacing:3, textTransform:"uppercase" }}>
            Category {introIndex + 1} of {totalCats}
          </div>
          <div className="jp-fade-in" style={{ fontSize:"clamp(48px,9vw,100px)", fontWeight:900, color:"#ffdd75", lineHeight:1.1, letterSpacing:-1, textShadow:"0 4px 0 rgba(0,0,0,0.4)", maxWidth:900 }}>
            {currentCat.title}
          </div>
          <div style={{ display:"flex", gap:10, marginTop:16 }}>
            {board.columns.map((_, i) => (
              <div key={i} style={{ width: i===introIndex ? 28:10, height:10, borderRadius:5, background: i<introIndex ? "rgba(255,221,117,0.6)" : i===introIndex ? "#ffdd75":"rgba(255,255,255,0.12)", transition:"all 0.3s ease" }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Clue view ────────────────────────────────────────────────────────────
  if ((phase === "clue" || phase === "dailyDoubleClue") && clue) {
    const buzzer      = buzz?.locked ? buzz : null;
    const buzzerTeam  = buzzer ? teamById[buzzer.teamId] : null;
    const isMediaClue = !!clue.mediaUrl;

    return (
      <div className="jp-root" style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
        <ScoreStrip />
        <div style={{ flex:1, display:"flex", flexDirection:"column", padding: isMediaClue ? "20px 32px":"32px 48px", opacity: clueVisible ? 1:0, transition:"opacity 0.3s ease" }}>

          <div style={{ textAlign:"center", marginBottom: isMediaClue ? 16:28, flexShrink:0 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
              <div style={{ padding:"4px 16px", borderRadius:999, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.14)", fontSize:14, fontWeight:700, color:"rgba(246,247,255,0.65)", textTransform:"uppercase", letterSpacing:2 }}>
                {clue.category}
              </div>
              <div style={{ padding:"4px 16px", borderRadius:999, background:"rgba(255,221,117,0.15)", border:"1px solid rgba(255,221,117,0.4)", fontSize:20, fontWeight:900, color:"#ffdd75" }}>
                {phase === "dailyDoubleClue" ? `Daily Double — $${state.wager?.amount?.toLocaleString() ?? "?"}` : `$${clue.value}`}
              </div>
            </div>
          </div>

          {isMediaClue ? (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
              {clue.mediaType === "video" ? (
                videoPlaying ? (
                  <video ref={videoRef} src={clue.mediaUrl} autoPlay
                    style={{ maxWidth:"100%", maxHeight:"clamp(280px,55vh,600px)", borderRadius:16, boxShadow:"0 8px 40px rgba(0,0,0,0.5)", outline:"none" }}
                    onEnded={() => setVideoPlaying(false)} />
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>
                    <div style={{ fontSize:"clamp(64px,12vw,120px)", lineHeight:1 }}>🎬</div>
                    <div style={{ fontSize:"clamp(16px,2.5vw,24px)", fontWeight:700, color:"rgba(246,247,255,0.5)" }}>Waiting for host to play…</div>
                  </div>
                )
              ) : clue.mediaType === "audio" ? (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:24 }}>
                  <audio ref={audioRef} src={clue.mediaUrl} onEnded={() => setAudioPlaying(false)} />
                  <div style={{ fontSize:"clamp(80px,14vw,140px)", lineHeight:1 }}>{audioPlaying ? "🔊" : "🎵"}</div>
                  <div style={{ fontSize:"clamp(16px,2.5vw,24px)", fontWeight:700, color:"rgba(246,247,255,0.5)" }}>
                    {audioPlaying ? "Playing…" : "Waiting for host to play…"}
                  </div>
                </div>
              ) : (
                <img src={clue.mediaUrl} alt="clue"
                  style={{ maxWidth:"100%", maxHeight:"clamp(280px,52vh,560px)", borderRadius:16, boxShadow:"0 8px 40px rgba(0,0,0,0.5)", objectFit:"contain" }} />
              )}
            </div>
          ) : (
            <div className="jp-clue-card">
              <div className="jp-clue-text">{clue.question}</div>
            </div>
          )}

          {wrongFlash && (
            <div style={{ textAlign:"center", padding:"14px 24px", borderRadius:14, background:"rgba(239,68,68,0.18)", border:"1px solid rgba(239,68,68,0.45)", marginBottom:12, fontSize:20, fontWeight:900, color:"#fca5a5", flexShrink:0 }}>
              {wrongFlash.emoji} {wrongFlash.name} — WRONG
            </div>
          )}

          {buzzer ? (
            <div className="jp-buzz-panel jp-buzz-in-anim" style={{ background:`${buzzerTeam?.color ?? "#ffdd75"}18`, borderColor: buzzerTeam?.color ?? "#ffdd75" }}>
              <div className="jp-buzz-panel-emoji">{buzzer.emoji}</div>
              <div className="jp-buzz-panel-name" style={{ color: buzzerTeam?.color ?? "#ffdd75" }}>{buzzer.name}</div>
              <div className="jp-buzz-badge" style={{ background: buzzerTeam?.color ?? "#ffdd75" }}>BUZZED</div>
            </div>
          ) : (
            <div style={{ textAlign:"center", color:"rgba(246,247,255,0.25)", fontSize:16, fontWeight:700, letterSpacing:2, padding:"14px 0", textTransform:"uppercase", flexShrink:0 }}>
              Buzz in…
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Board view ───────────────────────────────────────────────────────────
  return (
    <div className="jp-root" style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
      {board && (
        <div style={{ display:"flex", alignItems:"center", padding:"6px 14px", background:"rgba(0,0,0,0.4)", borderBottom:"1px solid rgba(255,255,255,0.07)", gap:10 }}>
          <div style={{ fontSize:13, fontWeight:900, color:"#ffdd75", letterSpacing:1.5, marginRight:"auto" }}>JAYPARDY</div>
          <div style={{ fontSize:11, padding:"2px 10px", borderRadius:999, border:"1px solid rgba(255,255,255,0.1)", color:"rgba(246,247,255,0.4)" }}>Round {board.round}</div>
        </div>
      )}
      <ScoreStrip />

      {!board ? (
        // ── Splash / lobby screen ─────────────────────────────────────────
        <div className="jp-splash" style={{ flex:1 }}>
          <div className="jp-splash-overlay" />
          <div className="jp-splash-content">
            <div className="jp-splash-sub">
              {players.length > 0
                ? `${players.length} player${players.length !== 1 ? "s":""} connected`
                : "Waiting for players…"}
            </div>
            <div style={{ height:16 }} />
            <div className="jp-qr-wrap">
              <div className="jp-qr-label">Scan to join</div>
              <QRCode size={140} />
              <div className="jp-qr-url">{GAME_URL}</div>
            </div>
          </div>
        </div>
      ) : (
        // ── Full-height board ─────────────────────────────────────────────
        <div className="jp-board-fullheight">
          <div className="jp-boardGrid">
            {board.columns.map((col, ci) => (
              <div className="jp-col" key={ci}>
                <div className="jp-cat">{col.title}</div>
                {col.clues.map((c, ri) => (
                  <div key={`${ci}-${ri}`}
                    className={`jp-cell${c.used ? " jp-cell-used" : ""}`}
                    style={{ cursor:"default" }}>
                    {!c.used && `$${c.value}`}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}