import { useEffect, useState } from "react";

export function useGameState(socket) {
  const [gameState, setGameState] = useState(null);
  const [lastUpdateAt, setLastUpdateAt] = useState(null);

  useEffect(() => {
    if (!socket) return;

    const onStateUpdate = (state) => {
      setGameState(state);
      setLastUpdateAt(Date.now());
    };

    socket.on("state:update", onStateUpdate);
    return () => socket.off("state:update", onStateUpdate);
  }, [socket]);

  return { gameState, lastUpdateAt };
}
