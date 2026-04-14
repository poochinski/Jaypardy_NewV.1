// client/src/components/DebugPanel.jsx
import React from "react";

export default function DebugPanel({ socket, gameState, lastUpdateAt }) {
  // Turn on via ?debug=1
  const debugEnabled = new URLSearchParams(window.location.search).get("debug") === "1";
  if (!debugEnabled) return null;

  const connected = socket?.connected ?? false;
  const id = socket?.id ?? "—";

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        right: 8,
        zIndex: 9999,
        width: 380,
        maxHeight: "80vh",
        overflow: "auto",
        background: "rgba(0,0,0,0.85)",
        color: "white",
        fontSize: 12,
        padding: 10,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.2)",
      }}
    >
      <div style={{ marginBottom: 8, fontWeight: 700 }}>DEBUG</div>
      <div>Connected: {String(connected)}</div>
      <div>Socket ID: {id}</div>
      <div>
        Last state:update:{" "}
        {lastUpdateAt ? new Date(lastUpdateAt).toLocaleTimeString() : "—"}
      </div>
      <div>Phase: {gameState?.phase ?? "—"}</div>
      <div>Round: {gameState?.round ?? "—"}</div>

      <div style={{ marginTop: 8, opacity: 0.85 }}>gameState (partial):</div>
      <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
        {JSON.stringify(
          {
            phase: gameState?.phase,
            round: gameState?.round,
            selectedClue: gameState?.selectedClue?.id ?? null,
            buzz: gameState?.buzz ?? null,
            teams:
              gameState?.teams?.map((t) => ({
                id: t.id,
                name: t.name,
                score: t.score,
              })) ?? null,
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}
