import { useEffect, useState } from "react";

export function useGameState(socket) {
  const [gameState, setGameState] = useState(null);
  const [lastUpdateAt, setLastUpdateAt] = useState(null);

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      console.log("✅ socket connected:", socket.id);

      // Ask for the latest state as a backup in case the first one was missed
      socket.emit("client:requestState");
    };

    const onConnectError = (err) => {
      console.log("❌ socket connect_error:", err.message);
    };

    const onDisconnect = (reason) => {
      console.log("❌ socket disconnected:", reason);
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

    // IMPORTANT:
    // attach listeners FIRST, then connect
    if (!socket.connected) {
      socket.connect();
    } else {
      // If already connected somehow, request state immediately
      socket.emit("client:requestState");
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("disconnect", onDisconnect);
      socket.off("state:update", onStateUpdate);
    };
  }, [socket]);

  return { gameState, lastUpdateAt };
}