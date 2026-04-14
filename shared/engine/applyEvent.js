import { PHASES } from "../types";

/**
 * applyEvent(state, event, rules)
 * Pure reducer: no sockets, no DOM, no timers.
 * Returns a NEW state object.
 */
export function applyEvent(state, event, rules) {
  switch (event.type) {
    case "PLAYER_JOIN": {
      const { player } = event;
      // prevent duplicates
      if (state.players.some((p) => p.id === player.id)) return state;
      return { ...state, players: [...state.players, player] };
    }

    case "PLAYER_LEAVE": {
      const { playerId } = event;
      const players = state.players.filter((p) => p.id !== playerId);
      return { ...state, players };
    }

    case "HOST_ASSIGN_TEAM": {
      const { playerId, teamId } = event;
      const players = state.players.map((p) =>
        p.id === playerId ? { ...p, teamId } : p
      );
      return { ...state, players };
    }

    case "HOST_START_GAME": {
      // TODO: generate board (we’ll port your current generator next)
      return { ...state, phase: PHASES.BOARD, round: 1 };
    }

    case "HOST_SELECT_CLUE": {
      // TODO: set activeClue + phase
      return state;
    }

    case "PLAYER_BUZZ": {
      if (state.buzz.locked) return state;
      const p = state.players.find((x) => x.id === event.playerId);
      if (!p || !p.teamId) return state;

      return {
        ...state,
        buzz: {
          locked: true,
          playerId: p.id,
          teamId: p.teamId,
          name: p.name,
          emoji: p.emoji,
          timestamp: Date.now()
        }
      };
    }

    case "HOST_RESET_BUZZ": {
      return {
        ...state,
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

    // TODO: HOST_MARK_CORRECT, HOST_MARK_WRONG, HOST_SKIP_CLUE
    // TODO: Daily Double wager flow

    default:
      return state;
  }
}
