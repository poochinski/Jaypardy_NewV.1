const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { QUESTION_BANK } = require("./data/questions");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_PLAYERS = 60;
const MAX_NAME_LENGTH = 32;

const TEAMS = [
  { id: "red",    name: "Red",    color: "#e53935" },
  { id: "blue",   name: "Blue",   color: "#1e88e5" },
  { id: "green",  name: "Green",  color: "#43a047" },
  { id: "yellow", name: "Yellow", color: "#fdd835" },
  { id: "purple", name: "Purple", color: "#8e24aa" },
  { id: "orange", name: "Orange", color: "#fb8c00" },
];

const ROUND1_VALUES = [200, 400, 600, 800, 1000];
const ROUND2_VALUES = [400, 800, 1200, 1600, 2000];

const VALID_EMOJIS = new Set([
  "😀","😎","🔥","🐝","🧠","🎯","⚡","🍕","👑","🤖",
  "🦊","🐸","🎸","🚀","🌊","🎲","🦁","🐯","🍀","💎",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom(arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function buildBoard(round = 1) {
  const values  = round === 2 ? ROUND2_VALUES : ROUND1_VALUES;
  const ddCount = round === 2 ? 2 : 1;

  if (QUESTION_BANK.length < 6) {
    console.error(`[board] Not enough categories (need 6, have ${QUESTION_BANK.length})`);
    return null;
  }

  const cats = pickRandom(QUESTION_BANK, 6);

  const columns = cats.map((c, colIndex) => {
    const chosen = pickRandom(c.clues, 5);
    return {
      id: `c${colIndex}`,
      title: c.category,
      clues: chosen.map((cl, rowIndex) => ({
        id:       `c${colIndex}r${rowIndex}`,
        value:    values[rowIndex],
        question: cl.q,
        answer:   cl.a,
        used:     false,
        isDD:     false,
      })),
    };
  });

  // Daily doubles — rows 1-4 only (never the cheapest clue)
  const ddPlaced = new Set();
  let attempts = 0;
  while (ddPlaced.size < ddCount && attempts < 50) {
    attempts++;
    const col = Math.floor(Math.random() * 6);
    const row = 1 + Math.floor(Math.random() * 4);
    const key = `${col}-${row}`;
    if (!ddPlaced.has(key)) {
      columns[col].clues[row].isDD = true;
      ddPlaced.add(key);
    }
  }

  return { round, columns };
}

function freshBuzz() {
  return {
    locked:    false,
    playerId:  null,
    teamId:    null,
    name:      null,
    emoji:     null,
    timestamp: null,
  };
}

function freshState() {
  return {
    phase:         "lobby", // lobby | board | clue | dailyDouble | dailyDoubleClue
    players:       [],
    teams:         TEAMS.map((t) => ({ ...t, score: 0 })),
    controlTeamId: null,
    board:         null,
    currentClue:   null,
    wager:         null,  // { teamId, amount } set after DD wager submitted
    buzz:          freshBuzz(),
  };
}

// ─── Helpers for mark logic ───────────────────────────────────────────────────

function markClueUsed(state) {
  const { colIndex, rowIndex } = state.currentClue;
  return {
    ...state,
    board: {
      ...state.board,
      columns: state.board.columns.map((col, ci) =>
        ci === colIndex
          ? {
              ...col,
              clues: col.clues.map((clue, ri) =>
                ri === rowIndex ? { ...clue, used: true } : clue
              ),
            }
          : col
      ),
    },
    currentClue: null,
    phase:       "board",
    wager:       null,
    buzz:        freshBuzz(),
  };
}

// ─── State ────────────────────────────────────────────────────────────────────

let state = freshState();

function emitState() {
  io.emit("state:update", state);
}

// ─── Socket Handlers ──────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[+] ${socket.id}`);
  socket.emit("state:update", state);

  // Player joins
  socket.on("player:join", ({ name, emoji }) => {
    if (state.players.length >= MAX_PLAYERS) return;

    const safeName = (name || "").trim().slice(0, MAX_NAME_LENGTH);
    if (!safeName) return;

    const safeEmoji = VALID_EMOJIS.has(emoji) ? emoji : "😀";
    const existing  = state.players.find((p) => p.id === socket.id);
    const teamId    = existing?.teamId ?? null;

    state = {
      ...state,
      players: [
        ...state.players.filter((p) => p.id !== socket.id),
        { id: socket.id, name: safeName, emoji: safeEmoji, teamId },
      ],
    };

    emitState();
  });

  // Host assigns team
  socket.on("host:assignTeam", ({ playerId, teamId }) => {
    const validTeam = teamId ? state.teams.some((t) => t.id === teamId) : true;
    if (!validTeam) return;

    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, teamId: teamId || null } : p
      ),
    };

    emitState();
  });

  // Host starts game — lobby only
  socket.on("host:startJaypardy", () => {
    if (state.phase !== "lobby") return;

    const board = buildBoard(1);
    if (!board) return;

    state = {
      ...state,
      board,
      phase:       "board",
      currentClue: null,
      buzz:        freshBuzz(),
    };

    emitState();
  });

  // Host starts round 2
  socket.on("host:startRound2", () => {
    if (state.phase !== "board") return;
    if (state.board?.round !== 1) return;

    // Check all clues are used
    const allUsed = state.board?.columns.every((col) =>
      col.clues.every((c) => c.used)
    );
    if (!allUsed) return;

    const newBoard = buildBoard(2);
    if (!newBoard) return;

    state = {
      ...state,
      board:       newBoard,
      phase:       "board",
      currentClue: null,
      wager:       null,
      buzz:        freshBuzz(),
    };

    emitState();
  });

  // Host generates a new board without resetting scores
  socket.on("host:newBoard", () => {
    const round = state.board?.round ?? 1;
    const board = buildBoard(round);
    if (!board) return;

    state = {
      ...state,
      board,
      phase:       "board",
      currentClue: null,
      buzz:        freshBuzz(),
    };

    emitState();
  });

  // Host selects a clue
  socket.on("host:selectClue", ({ colIndex, rowIndex }) => {
    if (state.phase !== "board" || !state.board) return;

    const col  = state.board.columns[colIndex];
    if (!col) return;

    const clue = col.clues[rowIndex];
    if (!clue || clue.used) return;

    // Work out who should submit the wager for a DD
    // First player on the control team, or first player overall
    const wagerTeamId = state.controlTeamId
      ?? state.players.find((p) => p.teamId)?.teamId
      ?? null;

    const wagerPlayerId = state.players.find(
      (p) => p.teamId === wagerTeamId
    )?.id ?? null;

    state = {
      ...state,
      phase: clue.isDD ? "dailyDouble" : "clue",
      currentClue: {
        colIndex,
        rowIndex,
        clueId:   clue.id,
        category: col.title,
        question: clue.question,
        answer:   clue.answer,
        value:    clue.value,
        isDD:     clue.isDD,
        // Who should enter the wager (DD only)
        wagerTeamId,
        wagerPlayerId,
      },
      wager: null,
      buzz:  freshBuzz(),
    };

    emitState();
  });

  // Player submits Daily Double wager
  socket.on("player:submitWager", ({ amount }) => {
    if (state.phase !== "dailyDouble") return;
    if (state.currentClue?.wagerPlayerId !== socket.id) return;

    const parsed = parseInt(amount, 10);
    if (!isFinite(parsed) || parsed < 1) return;

    // Wager can't exceed team's current score (min 1000 if score is less)
    const team      = state.teams.find((t) => t.id === state.currentClue.wagerTeamId);
    const maxWager  = Math.max(team?.score ?? 0, 1000);
    const safeWager = Math.min(parsed, maxWager);

    state = {
      ...state,
      phase:  "dailyDoubleClue",
      wager:  { teamId: state.currentClue.wagerTeamId, amount: safeWager },
    };

    emitState();
  });

  // Player buzzes in
  socket.on("player:buzz", ({ clientTimestamp } = {}) => {
    if (state.phase !== "clue" && state.phase !== "dailyDoubleClue") return;
    if (state.buzz.locked) return;

    const p = state.players.find((x) => x.id === socket.id);
    if (!p || !p.teamId) return;

    // For DD clue only the wager player can buzz
    if (state.phase === "dailyDoubleClue" &&
        p.id !== state.currentClue?.wagerPlayerId) return;

    state = {
      ...state,
      buzz: {
        locked:          true,
        playerId:        p.id,
        teamId:          p.teamId,
        name:            p.name,
        emoji:           p.emoji,
        timestamp:       Date.now(),
        clientTimestamp: clientTimestamp ?? null,
      },
    };

    emitState();
  });

  // Host resets buzzers
  socket.on("host:resetBuzz", () => {
    state = { ...state, buzz: freshBuzz() };
    emitState();
  });

  // Host marks answer
  socket.on("host:mark", ({ result }) => {
    if (!state.currentClue) return;

    const isDD        = state.phase === "dailyDoubleClue";
    const scoreChange = isDD ? (state.wager?.amount ?? 0) : state.currentClue.value;

    if (result === "correct" && state.buzz.locked && state.buzz.teamId) {
      state = {
        ...markClueUsed({
          ...state,
          controlTeamId: state.buzz.teamId,
          teams: state.teams.map((t) =>
            t.id === state.buzz.teamId
              ? { ...t, score: t.score + scoreChange }
              : t
          ),
        }),
      };
    } else if (result === "wrong" && state.buzz.locked && state.buzz.teamId) {
      // Deduct and unlock — for DD this ends the clue (only one chance)
      const deducted = {
        ...state,
        teams: state.teams.map((t) =>
          t.id === state.buzz.teamId
            ? { ...t, score: t.score - scoreChange }
            : t
        ),
        buzz: freshBuzz(),
      };

      // DD only gets one shot — close clue on wrong
      state = isDD ? markClueUsed(deducted) : deducted;
    } else {
      // skip or wrong with no buzz — mark used, back to board
      state = markClueUsed(state);
    }

    emitState();
  });

  // Host manually adjusts score
  socket.on("host:adjustScore", ({ teamId, delta }) => {
    if (typeof delta !== "number" || !isFinite(delta)) return;
    const clampedDelta = Math.max(-10000, Math.min(10000, Math.round(delta)));

    state = {
      ...state,
      teams: state.teams.map((t) =>
        t.id === teamId ? { ...t, score: t.score + clampedDelta } : t
      ),
    };

    emitState();
  });

  // Host fully resets
  socket.on("host:resetGame", () => {
    state = freshState();
    emitState();
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log(`[-] ${socket.id}`);
    const wasBuzzer = state.buzz.playerId === socket.id;

    state = {
      ...state,
      players: state.players.filter((p) => p.id !== socket.id),
      buzz:    wasBuzzer ? freshBuzz() : state.buzz,
    };

    emitState();
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Jaypardy server running on http://localhost:${PORT}`)
);
