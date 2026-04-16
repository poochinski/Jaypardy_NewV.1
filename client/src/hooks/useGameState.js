import { useEffect, useState } from "react";

export function useGameState(socket) {
  const [gameState, setGameState] = useState(null);
  const [lastUpdateAt, setLastUpdateAt] = useState(null);
  const [socketConnected, setSocketConnected] = useState(socket?.connected ?? false);
  const [socketId, setSocketId] = useState(socket?.id ?? null);
  const [socketError, setSocketError] = useState(null);

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      console.log("✅ socket connected:", socket.id);
      setSocketConnected(true);
      setSocketId(socket.id);
      setSocketError(null);

      socket.emit("client:requestState");
    };

    const onConnectError = (err) => {
      console.log("❌ socket connect_error:", err?.message || err);
      setSocketConnected(false);
      setSocketError(err?.message || String(err));
    };

    const onDisconnect = (reason) => {
      console.log("❌ socket disconnected:", reason);
      setSocketConnected(false);
    };

    const onStateUpdate = (state) => {
      console.log("📦 state:update received:", state);
      setGameState(state);
      setLastUpdateAt(Date.now());
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("disconnect", onDisconnect);
    socket.on("state:update", onStateUpdate);

    if (!socket.connected) {
      socket.connect();
    } else {
      setSocketConnected(true);
      setSocketId(socket.id);
      socket.emit("client:requestState");
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("disconnect", onDisconnect);
      socket.off("state:update", onStateUpdate);
    };
  }, [socket]);

  return {
    gameState,
    lastUpdateAt,
    socketConnected,
    socketId,
    socketError,
  };
}