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
  const values = round === 2 ? ROUND2_VALUES : ROUND1_VALUES;
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
        id: `c${colIndex}r${rowIndex}`,
        value: values[rowIndex],
        question: cl.q,
        answer: cl.a,
        used: false,
        isDD: false,
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
    locked: false,
    playerId: null,
    teamId: null,
    name: null,
    emoji: null,
    timestamp: null,
  };
}

function freshState() {
  return {
    phase: "lobby",
    players: [],
    teams: TEAMS.map((t) => ({ ...t, score: 0 })),
    controlTeamId: null,
    board: null,
    currentClue: null,
    buzz: freshBuzz(),
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

  socket.on("player:join", ({ name, emoji }) => {
    if (state.players.length >= MAX_PLAYERS) return;

    const safeName = (name || "").trim().slice(0, MAX_NAME_LENGTH);
    if (!safeName) return;

    const safeEmoji = VALID_EMOJIS.has(emoji) ? emoji : "😀";
    const existing = state.players.find((p) => p.id === socket.id);
    const teamId = existing?.teamId ?? null;

    state = {
      ...state,
      players: [
        ...state.players.filter((p) => p.id !== socket.id),
        { id: socket.id, name: safeName, emoji: safeEmoji, teamId },
      ],
    };

    emitState();
  });

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

  socket.on("host:startJaypardy", () => {
    if (state.phase !== "lobby") return;

    const board = buildBoard(1);
    if (!board) return;

    state = {
      ...state,
      board,
      phase: "board",
      currentClue: null,
      buzz: freshBuzz(),
    };

    emitState();
  });

  socket.on("host:newBoard", () => {
    const round = state.board?.round ?? 1;
    const board = buildBoard(round);
    if (!board) return;

    state = {
      ...state,
      board,
      phase: "board",
      currentClue: null,
      buzz: freshBuzz(),
    };

    emitState();
  });

  socket.on("host:selectClue", ({ colIndex, rowIndex }) => {
    if (state.phase !== "board" || !state.board) return;

    const col = state.board.columns[colIndex];
    if (!col) return;

    const clue = col.clues[rowIndex];
    if (!clue || clue.used) return;

    state = {
      ...state,
      phase: "clue",
      currentClue: {
        colIndex,
        rowIndex,
        clueId: clue.id,
        category: col.title,
        question: clue.question,
        answer: clue.answer,
        value: clue.value,
        isDD: clue.isDD,
      },
      buzz: freshBuzz(),
    };

    emitState();
  });

  socket.on("player:buzz", () => {
    if (state.phase !== "clue") return;
    if (state.buzz.locked) return;

    const p = state.players.find((x) => x.id === socket.id);
    if (!p || !p.teamId) return;

    state = {
      ...state,
      buzz: {
        locked: true,
        playerId: p.id,
        teamId: p.teamId,
        name: p.name,
        emoji: p.emoji,
        timestamp: Date.now(),
      },
    };

    emitState();
  });

  socket.on("host:resetBuzz", () => {
    state = { ...state, buzz: freshBuzz() };
    emitState();
  });

  socket.on("host:mark", ({ result }) => {
    if (!state.currentClue) return;

    if (result === "correct" && state.buzz.locked && state.buzz.teamId) {
      const { colIndex, rowIndex } = state.currentClue;
      state = {
        ...state,
        controlTeamId: state.buzz.teamId,
        teams: state.teams.map((t) =>
          t.id === state.buzz.teamId
            ? { ...t, score: t.score + state.currentClue.value }
            : t
        ),
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
        phase: "board",
        buzz: freshBuzz(),
      };
    } else if (result === "wrong" && state.buzz.locked && state.buzz.teamId) {
      // Deduct points, unlock buzz — clue stays active for others to answer
      state = {
        ...state,
        teams: state.teams.map((t) =>
          t.id === state.buzz.teamId
            ? { ...t, score: t.score - state.currentClue.value }
            : t
        ),
        buzz: freshBuzz(),
      };
    } else {
      // skip, or wrong with nobody buzzed — mark used, back to board
      const { colIndex, rowIndex } = state.currentClue;
      state = {
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
        phase: "board",
        buzz: freshBuzz(),
      };
    }

    emitState();
  });

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

  socket.on("host:resetGame", () => {
    state = freshState();
    emitState();
  });

  socket.on("disconnect", () => {
    console.log(`[-] ${socket.id}`);
    const wasBuzzer = state.buzz.playerId === socket.id;

    state = {
      ...state,
      players: state.players.filter((p) => p.id !== socket.id),
      buzz: wasBuzzer ? freshBuzz() : state.buzz,
    };

    emitState();
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Jaypardy server running on http://localhost:${PORT}`)
);

