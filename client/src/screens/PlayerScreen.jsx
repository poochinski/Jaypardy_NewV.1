import { useMemo, useState } from "react";
import { socket } from "../socket";

const EMOJIS = ["😀", "😎", "🔥", "🐝", "🧠", "🎯", "⚡", "🍕", "👑", "🤖"];

export default function PlayerScreen({ state }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [joined, setJoined] = useState(false);

  const me = useMemo(
    () => (state?.players ?? []).find((p) => p.id === socket.id),
    [state]
  );

  const myTeam = useMemo(
    () => (state?.teams ?? []).find((t) => t.id === me?.teamId),
    [me, state]
  );

  const join = () => {
    if (!name.trim()) return;
    socket.emit("player:join", { name: name.trim(), emoji });
    setJoined(true);
  };

  const buzzDisabled = !me?.teamId || state?.buzz?.locked;

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ margin: 0 }}>PLAYER</h1>

      {!joined ? (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.08)" }}>
          <div style={{ marginBottom: 10 }}>
            <label>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", padding: 12, fontSize: 16, marginTop: 6, borderRadius: 10, border: "1px solid #ccc" }}
              placeholder="Type your name…"
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label>Emoji</label>
            <select
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              style={{ width: "100%", padding: 12, fontSize: 16, marginTop: 6, borderRadius: 10 }}
            >
              {EMOJIS.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          <button onClick={join} style={{ width: "100%", padding: 14, fontSize: 18, fontWeight: 800, cursor: "pointer" }}>
            Join Game
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.08)" }}>
            {me ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  Joined as {me.emoji} {me.name} ✅
                </div>
                <div style={{ marginTop: 6, opacity: 0.9 }}>
                  Team: {myTeam ? myTeam.name : "Waiting for host…"}
                </div>
              </>
            ) : (
              <div>Connected… waiting to appear in state</div>
            )}
          </div>

          {/* Big buzzer button */}
          <button
            onClick={() => socket.emit("player:buzz")}
            disabled={buzzDisabled}
            style={{
              marginTop: 14,
              width: "100%",
              height: 260,
              fontSize: 36,
              fontWeight: 900,
              borderRadius: 18,
              cursor: buzzDisabled ? "not-allowed" : "pointer",
              opacity: buzzDisabled ? 0.5 : 1
            }}
          >
            BUZZ
          </button>
        </div>
      )}
    </div>
  );
}
