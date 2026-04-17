const express = require("express");
const http    = require("http");
const cors    = require("cors");
const path    = require("path");
const { Server } = require("socket.io");
const { Pool }   = require("pg");
const { QUESTION_BANK } = require("./data/questions");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ─── Postgres ─────────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS themes (
      name        TEXT PRIMARY KEY,
      categories  TEXT[] NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("[db] themes table ready");
}

async function getAllThemes() {
  const { rows } = await pool.query("SELECT name, categories FROM themes ORDER BY created_at ASC");
  const out = {};
  rows.forEach((r) => { out[r.name] = r.categories; });
  return out;
}

async function upsertTheme(name, categories) {
  await pool.query(
    `INSERT INTO themes (name, categories)
     VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET categories = $2`,
    [name, categories]
  );
}

async function removeTheme(name) {
  await pool.query("DELETE FROM themes WHERE name = $1", [name]);
}

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
    phase:         "lobby",
    players:       [],
    teams:         TEAMS.map((t) => ({ ...t, score: 0 })),
    controlTeamId: null,
    board:         null,
    currentClue:   null,
    wager:         null,
    finalJaypardy: null,
    pickingDD:     false,
    ddPicked:      0,
    gameLog:       [],
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

  // Send themes on connect
  getAllThemes().then((themes) => socket.emit("themes:update", themes)).catch(() => {});

  // Host requests themes
  socket.on("host:getThemes", async () => {
    try {
      const themes = await getAllThemes();
      socket.emit("themes:update", themes);
    } catch (e) {
      console.error("[themes] getThemes error:", e.message);
    }
  });

  // Host saves a theme
  socket.on("host:saveTheme", async ({ name, categories }) => {
    if (!name || !Array.isArray(categories) || categories.length !== 6) return;
    const safeName = name.trim().slice(0, 50);
    if (!safeName) return;
    try {
      await upsertTheme(safeName, categories);
      const themes = await getAllThemes();
      socket.emit("themes:update", themes);
    } catch (e) {
      console.error("[themes] saveTheme error:", e.message);
    }
  });

  // Host deletes a theme
  socket.on("host:deleteTheme", async ({ name }) => {
    try {
      await removeTheme(name);
      const themes = await getAllThemes();
      socket.emit("themes:update", themes);
    } catch (e) {
      console.error("[themes] deleteTheme error:", e.message);
    }
  });

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

  // Host swaps one category on the board for a different one
  socket.on("host:swapCategory", ({ colIndex, newCategory }) => {
    if (!state.board) return;
    if (colIndex < 0 || colIndex >= state.board.columns.length) return;

    // Find the requested category in the bank
    const cat = QUESTION_BANK.find((c) => c.category === newCategory);
    if (!cat) return;

    // Make sure it's not already on the board
    const alreadyOnBoard = state.board.columns.some(
      (col, ci) => ci !== colIndex && col.title === newCategory
    );
    if (alreadyOnBoard) return;

    const values  = state.board.round === 2 ? ROUND2_VALUES : ROUND1_VALUES;
    const chosen  = pickRandom(cat.clues, 5);
    const newCol  = {
      id:    `c${colIndex}`,
      title: cat.category,
      clues: chosen.map((cl, rowIndex) => ({
        id:       `c${colIndex}r${rowIndex}`,
        value:    values[rowIndex],
        question: cl.q,
        answer:   cl.a,
        used:     false,
        isDD:     false,
      })),
    };

    // Re-place a DD in this column if needed
    // Only add DD if the original column had one
    const originalCol = state.board.columns[colIndex];
    if (originalCol.clues.some((c) => c.isDD)) {
      const ddRow = 1 + Math.floor(Math.random() * 4);
      newCol.clues[ddRow].isDD = true;
    }

    state = {
      ...state,
      board: {
        ...state.board,
        columns: state.board.columns.map((col, ci) =>
          ci === colIndex ? newCol : col
        ),
      },
    };

    emitState();
  });

  // Host starts round 2
  socket.on("host:startRound2", () => {
    if (state.phase !== "board") return;
    if (state.board?.round !== 1) return;

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

  // Host skips the current round and jumps to the next
  socket.on("host:skipRound", () => {
    if (!state.board) return;
    if (state.phase !== "board" && state.phase !== "clue") return;

    if (state.board.round === 1) {
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
    } else {
      // Round 2 — skip to Final Jaypardy setup (just go to board phase, host triggers final manually)
      state = {
        ...state,
        phase:       "board",
        currentClue: null,
        wager:       null,
        buzz:        freshBuzz(),
        board: {
          ...state.board,
          columns: state.board.columns.map((col) => ({
            ...col,
            clues: col.clues.map((c) => ({ ...c, used: true })),
          })),
        },
      };
    }

    emitState();
  });

  // Host clears all DDs and enters pick-DD mode
  socket.on("host:clearDDs", () => {
    if (!state.board || state.phase !== "board") return;

    state = {
      ...state,
      board: {
        ...state.board,
        columns: state.board.columns.map((col) => ({
          ...col,
          clues: col.clues.map((c) => ({ ...c, isDD: false })),
        })),
      },
      pickingDD: true,
      ddPicked:  0,
    };

    emitState();
  });

  // Host picks a clue to be the new Daily Double
  socket.on("host:pickDD", ({ colIndex, rowIndex }) => {
    if (!state.board || !state.pickingDD) return;

    const col  = state.board.columns[colIndex];
    if (!col) return;
    const clue = col.clues[rowIndex];
    if (!clue || clue.used || clue.isDD) return;

    // Only rows 1-4 (index 1-4, the $400+ rows)
    if (rowIndex < 1) return;

    const ddNeeded = state.board.round === 2 ? 2 : 1;

    const newDdPicked = (state.ddPicked ?? 0) + 1;
    const donePicking = newDdPicked >= ddNeeded;

    state = {
      ...state,
      board: {
        ...state.board,
        columns: state.board.columns.map((col, ci) =>
          ci === colIndex
            ? {
                ...col,
                clues: col.clues.map((c, ri) =>
                  ri === rowIndex ? { ...c, isDD: true } : c
                ),
              }
            : col
        ),
      },
      pickingDD: !donePicking,
      ddPicked:  donePicking ? 0 : newDdPicked,
    };

    emitState();
  });

  // Host cancels DD picking mode
  socket.on("host:cancelPickDD", () => {
    state = { ...state, pickingDD: false, ddPicked: 0 };
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
    const ts          = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const clueQ       = state.currentClue.question;
    const clueA       = state.currentClue.answer;
    const cat         = state.currentClue.category;
    const val         = state.currentClue.value;
    const buzzer      = state.buzz.locked ? state.players.find((p) => p.id === state.buzz.playerId) : null;
    const buzzerTeam  = buzzer ? state.teams.find((t) => t.id === state.buzz.teamId) : null;

    let logEntry = null;

    if (result === "correct" && state.buzz.locked && state.buzz.teamId) {
      logEntry = {
        ts, result: "correct",
        category: cat, value: val,
        question: clueQ, answer: clueA,
        player: buzzer?.name ?? "?",
        team: buzzerTeam?.name ?? "?",
        teamColor: buzzerTeam?.color ?? "#21c55d",
        scoreDelta: `+$${scoreChange.toLocaleString()}`,
      };
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
        gameLog: [...(state.gameLog ?? []), logEntry],
      };
      io.emit("sound:cue", "correct");
    } else if (result === "wrong" && state.buzz.locked && state.buzz.teamId) {
      logEntry = {
        ts, result: "wrong",
        category: cat, value: val,
        question: clueQ, answer: clueA,
        player: buzzer?.name ?? "?",
        team: buzzerTeam?.name ?? "?",
        teamColor: buzzerTeam?.color ?? "#ef4444",
        scoreDelta: `-$${scoreChange.toLocaleString()}`,
      };
      const deducted = {
        ...state,
        teams: state.teams.map((t) =>
          t.id === state.buzz.teamId
            ? { ...t, score: t.score - scoreChange }
            : t
        ),
        buzz: freshBuzz(),
        gameLog: [...(state.gameLog ?? []), logEntry],
      };
      state = isDD ? markClueUsed(deducted) : deducted;
      io.emit("sound:cue", "wrong");
    } else {
      logEntry = {
        ts, result: "skip",
        category: cat, value: val,
        question: clueQ, answer: clueA,
        player: null, team: null, teamColor: null, scoreDelta: null,
      };
      state = {
        ...markClueUsed(state),
        gameLog: [...(state.gameLog ?? []), logEntry],
      };
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

  // ─── Final Jaypardy ───────────────────────────────────────────────────────

  socket.on("host:startFinal", ({ category }) => {
    if (state.phase !== "board") return;
    const cat = QUESTION_BANK.find((c) => c.category === category);
    if (!cat) return;
    const clue = pickRandom(cat.clues, 1)[0];
    const eligiblePlayers = state.players.filter((p) => p.teamId);
    const wagers  = {};
    const answers = {};
    eligiblePlayers.forEach((p) => { wagers[p.id] = null; answers[p.id] = null; });
    state = {
      ...state,
      phase: "finalWager",
      finalJaypardy: {
        category: cat.category,
        question: clue.q,
        answer:   clue.a,
        wagers,
        answers,
        revealed: [],
      },
    };
    emitState();
  });

  socket.on("player:submitFinalWager", ({ amount }) => {
    if (state.phase !== "finalWager" || !state.finalJaypardy) return;
    const p = state.players.find((x) => x.id === socket.id);
    if (!p || !p.teamId) return;
    if (!(socket.id in state.finalJaypardy.wagers)) return;
    const team     = state.teams.find((t) => t.id === p.teamId);
    const maxWager = Math.max(team?.score ?? 0, 0);
    const parsed   = parseInt(amount, 10);
    if (!isFinite(parsed) || parsed < 0) return;
    const safe = Math.min(Math.max(parsed, 0), maxWager);
    state = {
      ...state,
      finalJaypardy: {
        ...state.finalJaypardy,
        wagers: { ...state.finalJaypardy.wagers, [socket.id]: safe },
      },
    };
    emitState();
  });

  socket.on("host:revealFinalClue", () => {
    if (state.phase !== "finalWager") return;
    state = { ...state, phase: "finalClue" };
    emitState();
  });

  socket.on("player:submitFinalAnswer", ({ answer }) => {
    if (state.phase !== "finalClue" || !state.finalJaypardy) return;
    const p = state.players.find((x) => x.id === socket.id);
    if (!p) return;
    if (!(socket.id in state.finalJaypardy.answers)) return;
    const safe = (answer || "").trim().slice(0, 200);
    state = {
      ...state,
      finalJaypardy: {
        ...state.finalJaypardy,
        answers: { ...state.finalJaypardy.answers, [socket.id]: safe },
      },
    };
    emitState();
  });

  socket.on("host:startFinalReveal", () => {
    if (state.phase !== "finalClue") return;
    state = { ...state, phase: "finalReveal" };
    emitState();
  });

  socket.on("host:revealFinalAnswer", ({ playerId }) => {
    if (state.phase !== "finalReveal" || !state.finalJaypardy) return;
    if (state.finalJaypardy.revealed.includes(playerId)) return;
    state = {
      ...state,
      finalJaypardy: {
        ...state.finalJaypardy,
        revealed: [...state.finalJaypardy.revealed, playerId],
      },
    };
    emitState();
  });

  socket.on("host:markFinal", ({ playerId, correct }) => {
    if (state.phase !== "finalReveal" || !state.finalJaypardy) return;
    const p = state.players.find((x) => x.id === playerId);
    if (!p) return;
    const wager = state.finalJaypardy.wagers[playerId] ?? 0;
    const delta = correct ? wager : -wager;
    state = {
      ...state,
      teams: state.teams.map((t) =>
        t.id === p.teamId ? { ...t, score: t.score + delta } : t
      ),
    };
    emitState();
  });

  socket.on("host:endGame", () => {
    state = { ...state, phase: "gameOver" };
    emitState();
  });

  // Host loads a saved theme — rebuilds board with specific categories
  socket.on("host:loadTheme", ({ categories }) => {
    if (!Array.isArray(categories) || categories.length !== 6) return;

    const round  = state.board?.round ?? 1;
    const values = round === 2 ? ROUND2_VALUES : ROUND1_VALUES;
    const ddCount = round === 2 ? 2 : 1;

    const columns = categories.map((catName, colIndex) => {
      const cat = QUESTION_BANK.find((c) => c.category === catName);
      if (!cat) {
        // Category not found — pick a random one as fallback
        const fallback = QUESTION_BANK[colIndex % QUESTION_BANK.length];
        const chosen = pickRandom(fallback.clues, 5);
        return {
          id: `c${colIndex}`, title: fallback.category,
          clues: chosen.map((cl, ri) => ({ id:`c${colIndex}r${ri}`, value:values[ri], question:cl.q, answer:cl.a, used:false, isDD:false })),
        };
      }
      const chosen = pickRandom(cat.clues, 5);
      return {
        id:    `c${colIndex}`,
        title: cat.category,
        clues: chosen.map((cl, rowIndex) => ({
          id:`c${colIndex}r${rowIndex}`, value:values[rowIndex],
          question:cl.q, answer:cl.a, used:false, isDD:false,
        })),
      };
    });

    // Place daily doubles
    const ddPlaced = new Set();
    let attempts = 0;
    while (ddPlaced.size < ddCount && attempts < 50) {
      attempts++;
      const col = Math.floor(Math.random() * 6);
      const row = 1 + Math.floor(Math.random() * 4);
      const key = `${col}-${row}`;
      if (!ddPlaced.has(key)) { columns[col].clues[row].isDD = true; ddPlaced.add(key); }
    }

    state = {
      ...state,
      board:       { round, columns },
      phase:       "board",
      currentClue: null,
      wager:       null,
      buzz:        freshBuzz(),
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

// ─── Serve React client in production ────────────────────────────────────────

const clientBuild = path.join(__dirname, "../client/dist");

app.use(express.static(clientBuild));

// All non-API routes serve the React app — handles /host, /player, /display
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(clientBuild, "index.html"));
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;

initDb()
  .then(() => {
    server.listen(PORT, () =>
      console.log(`Jaypardy server running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("[db] Failed to initialize database:", err.message);
    // Start anyway so the game still works even if themes DB fails
    server.listen(PORT, () =>
      console.log(`Jaypardy server running on http://localhost:${PORT} (no db)`)
    );
  });