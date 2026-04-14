export const PHASES = {
  LOBBY: "lobby",
  BOARD: "board",
  CLUE: "clue",
  DAILY_DOUBLE_WAGER: "dailyDoubleWager",
  DAILY_DOUBLE_WAGER_REVEAL: "dailyDoubleWagerReveal",
  DAILY_DOUBLE_CLUE: "dailyDoubleClue",
  ROUND_COMPLETE: "roundComplete",
  GAME_OVER: "gameOver",
};

export function makeInitialState(rules) {
  return {
    phase: PHASES.LOBBY,
    round: 1,
    players: [],
    teams: [
      { id: "red", name: "Red", color: "#e53935", score: 0 },
      { id: "blue", name: "Blue", color: "#1e88e5", score: 0 },
      { id: "green", name: "Green", color: "#43a047", score: 0 },
      { id: "yellow", name: "Yellow", color: "#fdd835", score: 0 },
      { id: "purple", name: "Purple", color: "#8e24aa", score: 0 },
      { id: "orange", name: "Orange", color: "#fb8c00", score: 0 }
    ],
    board: null,
    activeClue: null,
    dailyDouble: null,
    buzz: {
      locked: false,
      playerId: null,
      teamId: null,
      name: null,
      emoji: null,
      timestamp: null
    }
  };
}
