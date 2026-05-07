const express = require("express");
const http    = require("http");
const cors    = require("cors");
const path    = require("path");
const { Server } = require("socket.io");
const { Pool }   = require("pg");
const { QUESTION_BANK } = require("./data/questions");

// ─── Cloudinary + Multer ──────────────────────────────────────────────────────
const cloudinary = require("cloudinary").v2;
const multer     = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          "jaypardy-clues",
    allowed_formats: ["jpg","jpeg","png","gif","webp","mp4","mp3","wav"],
    resource_type:   "auto",
  },
});

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ─── Postgres ─────────────────────────────────────────────────────────────────

console.log("[db] DATABASE_URL present:", !!process.env.DATABASE_URL);
console.log("[db] DATABASE_URL prefix:", (process.env.DATABASE_URL || "").slice(0, 20));

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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      name        TEXT PRIMARY KEY,
      clues       JSONB NOT NULL DEFAULT '[]',
      hint        TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Add hint column if it doesn't exist (migration for existing DBs)
  await pool.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS hint TEXT NOT NULL DEFAULT ''`);
  if (QUESTION_BANK.length > 0) {
    const values = QUESTION_BANK.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(", ");
    const params = QUESTION_BANK.flatMap((cat) => [cat.category, JSON.stringify(cat.clues)]);
    const result = await pool.query(
      `INSERT INTO categories (name, clues) VALUES ${values} ON CONFLICT (name) DO NOTHING`,
      params
    );
    if (result.rowCount > 0) console.log(`[db] seeded ${result.rowCount} new categories`);
  }
  console.log("[db] tables ready");
}

// ─── Category DB helpers ──────────────────────────────────────────────────────

async function getAllCategories() {
  const { rows } = await pool.query("SELECT name, clues, hint FROM categories ORDER BY name ASC");
  return rows.map((r) => ({ category: r.name, clues: r.clues, hint: r.hint || "" }));
}

async function getCategoryClues(name) {
  const { rows } = await pool.query("SELECT clues FROM categories WHERE name = $1", [name]);
  return rows[0]?.clues ?? null;
}

async function upsertCategory(name, clues, hint = "") {
  await pool.query(
    `INSERT INTO categories (name, clues, hint) VALUES ($1, $2, $3)
     ON CONFLICT (name) DO UPDATE SET clues = $2, hint = $3`,
    [name, JSON.stringify(clues), hint || ""]
  );
}

async function renameCategory(oldName, newName) {
  await pool.query(`UPDATE categories SET name = $1 WHERE name = $2`, [newName, oldName]);
}

async function deleteCategory(name) {
  await pool.query("DELETE FROM categories WHERE name = $1", [name]);
}

async function getAllThemes() {
  const { rows } = await pool.query("SELECT name, categories FROM themes ORDER BY created_at ASC");
  const out = {};
  rows.forEach((r) => { out[r.name] = r.categories; });
  return out;
}

async function upsertTheme(name, categories) {
  await pool.query(
    `INSERT INTO themes (name, categories) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET categories = $2`,
    [name, categories]
  );
}

async function removeTheme(name) {
  await pool.query("DELETE FROM themes WHERE name = $1", [name]);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_PLAYERS     = 60;
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

// ─── Latency tracking ─────────────────────────────────────────────────────────
// Maps socket.id → smoothed RTT in ms
const playerLatency = {};
const PING_INTERVAL  = 5000;
const MAX_LATENCY    = 500;
const LOCKOUT_WINDOW = 100;

// ─── Player registry — persists across reconnections ─────────────────────────
// Maps persistent playerId → { name, emoji, teamId }
// This survives socket disconnects so players can rejoin seamlessly
const playerRegistry = {};

// Maps socket.id → persistent playerId (for reverse lookup)
const socketToPlayer = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom(arr, n) {
  const copy = [...arr];
  const out  = [];
  while (out.length < n && copy.length) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function pickClueForRow(clues, rowIndex, usedIndices) {
  const tierMap   = { 0:["easy"], 1:["easy"], 2:["medium"], 3:["medium"], 4:["hard"] };
  const preferred = tierMap[rowIndex] ?? ["medium"];
  const available = clues.filter((_, i) => !usedIndices.has(i));
  const pPool = available.filter((cl) => preferred.includes(cl.d));
  const uPool = available.filter((cl) => !cl.d);
  const pool  = pPool.length > 0 ? pPool : uPool.length > 0 ? uPool : available;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickFiveClues(clues) {
  if (!clues.some((cl) => cl.d)) return pickRandom(clues, 5);
  const chosen = [];
  for (let row = 0; row < 5; row++) {
    const used = new Set(chosen.map((cl) => clues.indexOf(cl)));
    const cl   = pickClueForRow(clues, row, used);
    if (cl) {
      chosen.push(cl);
    } else {
      const rem = clues.filter((c) => !chosen.includes(c));
      if (rem.length > 0) chosen.push(rem[Math.floor(Math.random() * rem.length)]);
    }
  }
  return chosen;
}

let categoryCache = [];

async function refreshCategoryCache() {
  try {
    const cats = await getAllCategories();
    if (cats.length > 0) {
      categoryCache = cats;
      console.log(`[db] category cache refreshed: ${categoryCache.length} categories`);
    } else {
      console.log("[db] no categories in DB yet, using questions.js fallback");
      categoryCache = QUESTION_BANK;
    }
  } catch (e) {
    console.error("[db] cache refresh failed, using questions.js fallback:", e.message);
    categoryCache = QUESTION_BANK;
  }
}

async function buildBoard(round = 1) {
  const values  = round === 2 ? ROUND2_VALUES : ROUND1_VALUES;
  const ddCount = round === 2 ? 2 : 1;
  if (categoryCache.length < 6) {
    console.error(`[board] Not enough categories (need 6, have ${categoryCache.length})`);
    return null;
  }
  const cats    = pickRandom(categoryCache, 6);
  const columns = cats.map((c, ci) => {
    const chosen = pickFiveClues(c.clues);
    return {
      id: `c${ci}`, title: c.category,
      hint:  c.hint || "",
      clues: chosen.map((cl, ri) => ({
        id: `c${ci}r${ri}`, value: values[ri],
        question: cl.q, answer: cl.a, used: false, isDD: false,
      })),
    };
  });
  const placed = new Set();
  let att = 0;
  while (placed.size < ddCount && att < 50) {
    att++;
    const col = Math.floor(Math.random() * 6);
    const row = 1 + Math.floor(Math.random() * 4);
    const key = `${col}-${row}`;
    if (!placed.has(key)) { columns[col].clues[row].isDD = true; placed.add(key); }
  }
  return { round, columns };
}

function freshBuzz() {
  return { locked: false, playerId: null, teamId: null, name: null, emoji: null, timestamp: null };
}

function freshState() {
  return {
    phase:           "lobby",
    paused:          false,
    pauseMessage:    "",
    players:         [],
    teams:           TEAMS.map((t) => ({ ...t, score: 0 })),
    controlTeamId:   null,
    controlPlayerId: null,
    board:           null,
    currentClue:     null,
    wager:           null,
    finalJaypardy:   null,
    pickingDD:       false,
    ddPicked:        0,
    gameLog:         [],
    buzz:            freshBuzz(),
    buzzerType:      "standard",  // "standard" | "puzzle"
    puzzleActive:    false,       // true when puzzle buzzer is live on player screens
    puzzleSeed:      null,        // current puzzle config (shapes, order) — same for all players
    introIndex:      -1,          // -1 = not introducing, 0-5 = which category is spotlighted
  };
}

function markClueUsed(state) {
  const { colIndex, rowIndex } = state.currentClue;
  return {
    ...state,
    board: {
      ...state.board,
      columns: state.board.columns.map((col, ci) =>
        ci === colIndex
          ? { ...col, clues: col.clues.map((clue, ri) => ri === rowIndex ? { ...clue, used: true } : clue) }
          : col
      ),
    },
    currentClue: null,
    phase:       "board",
    wager:       null,
    buzz:        freshBuzz(),
  };
}

function pickRandomControlPlayer(players) {
  const assigned = players.filter((p) => p.teamId);
  if (assigned.length === 0) return { playerId: null, teamId: null };
  const p = assigned[Math.floor(Math.random() * assigned.length)];
  return { playerId: p.id, teamId: p.teamId };
}

function getControlPlayer(state) {
  if (state.controlPlayerId) {
    const p = state.players.find((x) => x.id === state.controlPlayerId);
    if (p) return p;
  }
  if (state.controlTeamId) {
    const p = state.players.find((x) => x.teamId === state.controlTeamId);
    if (p) return p;
  }
  return state.players.find((p) => p.teamId) ?? null;
}

// ─── Latency compensation ─────────────────────────────────────────────────────
function compensatedTapTime(socketId, serverArrivalTime) {
  const latency = playerLatency[socketId] ?? 50;
  const halfRtt = Math.min(latency / 2, MAX_LATENCY);
  return serverArrivalTime - halfRtt;
}

// ─── Pending buzz window (Level 3) ───────────────────────────────────────────
let pendingBuzzes   = [];
let buzzWindowTimer = null;

function clearBuzzWindow() {
  if (buzzWindowTimer) { clearTimeout(buzzWindowTimer); buzzWindowTimer = null; }
  pendingBuzzes = [];
}

function resolveBuzz() {
  if (pendingBuzzes.length === 0) return;
  pendingBuzzes.sort((a, b) => a.tapTime - b.tapTime);
  const winner = pendingBuzzes[0];
  pendingBuzzes = [];
  buzzWindowTimer = null;

  const p = state.players.find((x) => x.id === winner.socketId);
  if (!p || !p.teamId) return;
  if (state.phase !== "clue" && state.phase !== "dailyDoubleClue") return;
  if (state.buzz.locked) return;

  state = {
    ...state,
    buzz: {
      locked:    true,
      playerId:  p.id,
      teamId:    p.teamId,
      name:      p.name,
      emoji:     p.emoji,
      timestamp: winner.tapTime,
    },
  };
  emitState();
}

// ─── Latency broadcast to host ────────────────────────────────────────────────
// Sends { socketId: rtt } map to all host screens every 3 seconds
const LATENCY_BROADCAST_INTERVAL = 3000;
setInterval(() => {
  if (Object.keys(playerLatency).length > 0) {
    io.emit("latency:update", { ...playerLatency });
  }
}, LATENCY_BROADCAST_INTERVAL);

let state = freshState();
function emitState() { io.emit("state:update", state); }

// ─── Socket Handlers ──────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[+] ${socket.id}`);
  socket.emit("state:update", state);
  getAllThemes().then((t) => socket.emit("themes:update", t)).catch(() => {});

  // ─── Latency ping/pong ────────────────────────────────────────────────────
  const doPing = () => {
    if (!socket.connected) return;
    socket.emit("ping:server", { t: Date.now() });
  };
  doPing();
  const pingTimer = setInterval(doPing, PING_INTERVAL);

  socket.on("pong:server", ({ t }) => {
    const rtt  = Date.now() - t;
    const prev = playerLatency[socket.id] ?? rtt;
    playerLatency[socket.id] = Math.round(prev * 0.7 + rtt * 0.3);
  });

  // ─── Themes ───────────────────────────────────────────────────────────────
  socket.on("host:getThemes", async () => {
    try { socket.emit("themes:update", await getAllThemes()); }
    catch (e) { console.error("[themes] getThemes error:", e.message); }
  });
  socket.on("host:saveTheme", async ({ name, categories }) => {
    if (!name || !Array.isArray(categories) || categories.length !== 6) return;
    const safeName = name.trim().slice(0, 50);
    if (!safeName) return;
    try { await upsertTheme(safeName, categories); socket.emit("themes:update", await getAllThemes()); }
    catch (e) { console.error("[themes] saveTheme error:", e.message); }
  });
  socket.on("host:deleteTheme", async ({ name }) => {
    try { await removeTheme(name); socket.emit("themes:update", await getAllThemes()); }
    catch (e) { console.error("[themes] deleteTheme error:", e.message); }
  });

  // ─── Pause / Resume ───────────────────────────────────────────────────────
  socket.on("host:pause", ({ message }) => {
    state = { ...state, paused: true, pauseMessage: message || "Stand By" };
    emitState();
  });
  socket.on("host:resume", () => {
    state = { ...state, paused: false, pauseMessage: "" };
    emitState();
  });

  // ─── Players ──────────────────────────────────────────────────────────────
  socket.on("player:join", ({ name, emoji, playerId }) => {
    if (state.players.length >= MAX_PLAYERS) return;
    const safeName  = (name || "").trim().slice(0, MAX_NAME_LENGTH);
    if (!safeName) return;
    const safeEmoji = VALID_EMOJIS.has(emoji) ? emoji : "😀";

    // ── Reconnection logic ────────────────────────────────────────────────
    // If the client sent a persistent playerId and we have their registry entry,
    // restore their name/emoji/team automatically
    let restoredTeamId = null;

    if (playerId && playerRegistry[playerId]) {
      const reg = playerRegistry[playerId];
      restoredTeamId = reg.teamId ?? null;
      console.log(`[reconnect] ${safeName} restored with team ${restoredTeamId}`);
    }

    // Register/update persistent player data
    if (playerId) {
      playerRegistry[playerId] = { name: safeName, emoji: safeEmoji, teamId: restoredTeamId };
      socketToPlayer[socket.id] = playerId;
    }

    // If already in game as this socket, preserve teamId
    const existingBySocket = state.players.find((p) => p.id === socket.id);
    const finalTeamId = restoredTeamId ?? existingBySocket?.teamId ?? null;

    state = {
      ...state,
      players: [
        ...state.players.filter((p) => p.id !== socket.id),
        { id: socket.id, name: safeName, emoji: safeEmoji, teamId: finalTeamId },
      ],
    };

    // Auto-assign control if nobody has it yet and this player has a team
    if (finalTeamId && !state.controlPlayerId) {
      state = { ...state, controlPlayerId: socket.id, controlTeamId: finalTeamId };
    }

    emitState();
  });

  socket.on("host:assignTeam", ({ playerId, teamId }) => {
    if (teamId && !state.teams.some((t) => t.id === teamId)) return;
    state = { ...state, players: state.players.map((p) => p.id === playerId ? { ...p, teamId: teamId || null } : p) };

    // Update registry with new team assignment
    const persistentId = socketToPlayer[playerId];
    if (persistentId && playerRegistry[persistentId]) {
      playerRegistry[persistentId].teamId = teamId || null;
    }

    // Auto-assign control if nobody has it
    if (teamId && !state.controlPlayerId) {
      state = { ...state, controlPlayerId: playerId, controlTeamId: teamId };
    }
    // Clear control if unassigned
    if (!teamId && state.controlPlayerId === playerId) {
      const next = state.players.find((p) => p.id !== playerId && p.teamId);
      state = { ...state, controlPlayerId: next?.id ?? null, controlTeamId: next?.teamId ?? null };
    }
    emitState();
  });

  // ─── Game flow ────────────────────────────────────────────────────────────
  socket.on("host:startJaypardy", async () => {
    if (state.phase !== "lobby") return;
    const board = await buildBoard(1);
    if (!board) return;
    state = {
      ...state,
      board,
      phase:       "introducing",
      currentClue: null,
      buzz:        freshBuzz(),
      introIndex:  -1,
    };
    emitState();
  });

  // ─── Category introduction events ───────────────────────────────────────
  socket.on("host:revealNextCategory", () => {
    if (state.phase !== "introducing") return;
    const nextIndex = state.introIndex + 1;
    state = { ...state, introIndex: nextIndex };
    emitState();
  });

  socket.on("host:startFromIntro", () => {
    if (state.phase !== "introducing") return;
    const { playerId, teamId } = pickRandomControlPlayer(state.players);
    state = { ...state, phase: "board", introIndex: -1, controlPlayerId: playerId, controlTeamId: teamId };
    emitState();
  });

  socket.on("host:swapCategory", ({ colIndex, newCategory }) => {
    if (!state.board || colIndex < 0 || colIndex >= state.board.columns.length) return;
    const cat = categoryCache.find((c) => c.category === newCategory);
    if (!cat) return;
    if (state.board.columns.some((col, ci) => ci !== colIndex && col.title === newCategory)) return;
    const values  = state.board.round === 2 ? ROUND2_VALUES : ROUND1_VALUES;
    const chosen  = pickRandom(cat.clues, 5);
    const newCol  = {
      id: `c${colIndex}`, title: cat.category,
      clues: chosen.map((cl, ri) => {
        const clueData = { id:`c${colIndex}r${ri}`, value:values[ri], question:cl.q, answer:cl.a, used:false, isDD:false };
        if (cl.mediaUrl)  clueData.mediaUrl  = cl.mediaUrl;
        if (cl.mediaType) clueData.mediaType = cl.mediaType;
        if (cl.publicId)  clueData.publicId  = cl.publicId;
        return clueData;
      }),
    };
    if (state.board.columns[colIndex].clues.some((c) => c.isDD)) {
      newCol.clues[1 + Math.floor(Math.random() * 4)].isDD = true;
    }
    state = { ...state, board: { ...state.board, columns: state.board.columns.map((col, ci) => ci === colIndex ? newCol : col) } };
    emitState();
  });

  socket.on("host:startRound2", async () => {
    if (state.phase !== "board" || state.board?.round !== 1) return;
    if (!state.board?.columns.every((col) => col.clues.every((c) => c.used))) return;
    const newBoard = await buildBoard(2);
    if (!newBoard) return;
    state = { ...state, board: newBoard, phase: "introducing", currentClue: null, wager: null, buzz: freshBuzz(), introIndex: -1 };
    emitState();
  });

  socket.on("host:skipRound", async () => {
    if (!state.board || (state.phase !== "board" && state.phase !== "clue")) return;
    if (state.board.round === 1) {
      const newBoard = await buildBoard(2);
      if (!newBoard) return;
      state = { ...state, board: newBoard, phase: "board", currentClue: null, wager: null, buzz: freshBuzz() };
    } else {
      state = {
        ...state, phase: "board", currentClue: null, wager: null, buzz: freshBuzz(),
        board: { ...state.board, columns: state.board.columns.map((col) => ({ ...col, clues: col.clues.map((c) => ({ ...c, used: true })) })) },
      };
    }
    emitState();
  });

  socket.on("host:clearDDs", () => {
    if (!state.board || state.phase !== "board") return;
    state = {
      ...state, pickingDD: true, ddPicked: 0,
      board: { ...state.board, columns: state.board.columns.map((col) => ({ ...col, clues: col.clues.map((c) => ({ ...c, isDD: false })) })) },
    };
    emitState();
  });

  socket.on("host:pickDD", ({ colIndex, rowIndex }) => {
    if (!state.board || !state.pickingDD) return;
    const clue = state.board.columns[colIndex]?.clues[rowIndex];
    if (!clue || clue.used || clue.isDD || rowIndex < 1) return;
    const ddNeeded    = state.board.round === 2 ? 2 : 1;
    const newDdPicked = (state.ddPicked ?? 0) + 1;
    const done        = newDdPicked >= ddNeeded;
    state = {
      ...state, pickingDD: !done, ddPicked: done ? 0 : newDdPicked,
      board: {
        ...state.board,
        columns: state.board.columns.map((col, ci) =>
          ci === colIndex ? { ...col, clues: col.clues.map((c, ri) => ri === rowIndex ? { ...c, isDD: true } : c) } : col
        ),
      },
    };
    emitState();
  });

  socket.on("host:cancelPickDD", () => { state = { ...state, pickingDD: false, ddPicked: 0 }; emitState(); });

  socket.on("host:newBoard", async () => {
    const board = await buildBoard(state.board?.round ?? 1);
    if (!board) return;
    state = { ...state, board, phase: "introducing", currentClue: null, buzz: freshBuzz(), introIndex: -1 };
    emitState();
  });

  socket.on("host:selectClue", ({ colIndex, rowIndex }) => {
    if (state.phase !== "board" || !state.board) return;
    const col  = state.board.columns[colIndex];
    const clue = col?.clues[rowIndex];
    if (!clue || clue.used) return;
    const controlPlayer = getControlPlayer(state);
    const wagerPlayerId = controlPlayer?.id ?? null;
    const wagerTeamId   = controlPlayer?.teamId ?? null;
    clearBuzzWindow();
    state = {
      ...state,
      phase: clue.isDD ? "dailyDouble" : "clue",
      currentClue: {
        colIndex, rowIndex, clueId: clue.id,
        category: col.title, question: clue.question, answer: clue.answer,
        value: clue.value, isDD: clue.isDD,
        wagerTeamId, wagerPlayerId,
        wrongPlayers: [],
      },
      wager: null,
      buzz:  freshBuzz(),
    };
    emitState();
  });

  socket.on("host:setControl", ({ playerId }) => {
    const p = state.players.find((x) => x.id === playerId);
    if (!p || !p.teamId) return;
    state = { ...state, controlPlayerId: p.id, controlTeamId: p.teamId };
    emitState();
  });

  socket.on("player:submitWager", ({ amount }) => {
    if (state.phase !== "dailyDouble" || state.currentClue?.wagerPlayerId !== socket.id) return;
    const parsed = parseInt(amount, 10);
    if (!isFinite(parsed) || parsed < 1) return;
    const team     = state.teams.find((t) => t.id === state.currentClue.wagerTeamId);
    const maxWager = Math.max(team?.score ?? 0, 1000);
    state = { ...state, phase: "dailyDoubleClue", wager: { teamId: state.currentClue.wagerTeamId, amount: Math.min(parsed, maxWager) } };
    emitState();
  });

  // ─── Buzz (Level 2+3) ─────────────────────────────────────────────────────
  socket.on("player:buzz", () => {
    if (state.phase !== "clue" && state.phase !== "dailyDoubleClue") return;
    if (state.buzz.locked) return;
    const p = state.players.find((x) => x.id === socket.id);
    if (!p || !p.teamId) return;
    if (state.phase === "dailyDoubleClue" && p.id !== state.currentClue?.wagerPlayerId) return;
    if (state.currentClue?.wrongPlayers?.includes(socket.id)) return;

    const serverArrival = Date.now();
    const tapTime       = compensatedTapTime(socket.id, serverArrival);

    if (buzzWindowTimer === null) {
      pendingBuzzes   = [{ socketId: socket.id, tapTime }];
      buzzWindowTimer = setTimeout(resolveBuzz, LOCKOUT_WINDOW);
    } else {
      pendingBuzzes.push({ socketId: socket.id, tapTime });
    }
  });

  socket.on("host:resetBuzz", () => {
    clearBuzzWindow();
    state = { ...state, buzz: freshBuzz(), puzzleActive: false };
    emitState();
  });

  // ─── Buzzer type toggle ───────────────────────────────────────────────────
  socket.on("host:setBuzzerType", ({ buzzerType }) => {
    if (buzzerType !== "standard" && buzzerType !== "puzzle") return;
    state = { ...state, buzzerType, puzzleActive: false };
    emitState();
  });

  // ─── Puzzle buzzer ────────────────────────────────────────────────────────
  socket.on("host:launchPuzzle", () => {
    if (state.phase !== "clue" && state.phase !== "dailyDoubleClue") return;
    if (state.buzz.locked) return;
    if (state.buzzerType !== "puzzle") return;

    const ALL_SHAPES = ["circle", "square", "triangle", "star", "diamond", "hexagon"];
    const ALL_COLORS = ["#e53935", "#1e88e5", "#43a047", "#fdd835", "#8e24aa", "#fb8c00"];

    const shuffledShapes = [...ALL_SHAPES].sort(() => Math.random() - 0.5);
    const shuffledColors = [...ALL_COLORS].sort(() => Math.random() - 0.5);

    const pool = shuffledShapes.slice(0, 6).map((shape, i) => ({
      id:    shape + "-" + i,
      shape,
      color: shuffledColors[i],
    }));

    const answer  = pool.slice(0, 3);
    const allPool = [...pool].sort(() => Math.random() - 0.5);

    clearBuzzWindow();
    state = { ...state, puzzleActive: true, puzzleSeed: { answer, pool: allPool }, buzz: freshBuzz() };
    emitState();
  });

  socket.on("player:puzzleSolved", ({ solution }) => {
    if (!state.puzzleActive) return;
    if (state.buzz.locked) return;
    const p = state.players.find((x) => x.id === socket.id);
    if (!p || !p.teamId) return;
    if (state.currentClue?.wrongPlayers?.includes(socket.id)) return;

    const { answer } = state.puzzleSeed;
    const correct = Array.isArray(solution)
      && solution.length === 3
      && solution.every((id, i) => id === answer[i].id);

    if (!correct) return;

    state = {
      ...state,
      puzzleActive: false,
      buzz: {
        locked:    true,
        playerId:  p.id,
        teamId:    p.teamId,
        name:      p.name,
        emoji:     p.emoji,
        timestamp: Date.now(),
      },
    };
    emitState();
  });

  // ─── Mark answer ──────────────────────────────────────────────────────────
  socket.on("host:mark", ({ result }) => {
    if (!state.currentClue) return;
    clearBuzzWindow();

    const isDD        = state.phase === "dailyDoubleClue";
    const scoreChange = isDD ? (state.wager?.amount ?? 0) : state.currentClue.value;
    const ts          = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const buzzer      = state.buzz.locked ? state.players.find((p) => p.id === state.buzz.playerId) : null;
    const buzzerTeam  = buzzer ? state.teams.find((t) => t.id === state.buzz.teamId) : null;
    const baseLog     = { ts, category: state.currentClue.category, value: state.currentClue.value, question: state.currentClue.question, answer: state.currentClue.answer };

    if (result === "correct" && state.buzz.locked && state.buzz.teamId) {
      const logEntry = { ...baseLog, result: "correct", player: buzzer?.name ?? "?", team: buzzerTeam?.name ?? "?", teamColor: buzzerTeam?.color ?? "#21c55d", scoreDelta: `+$${scoreChange.toLocaleString()}` };
      state = {
        ...markClueUsed({
          ...state,
          controlTeamId:   state.buzz.teamId,
          controlPlayerId: state.buzz.playerId,
          teams: state.teams.map((t) => t.id === state.buzz.teamId ? { ...t, score: t.score + scoreChange } : t),
        }),
        gameLog: [...(state.gameLog ?? []), logEntry],
      };
      io.emit("sound:cue", "correct");
    } else if (result === "wrong" && state.buzz.locked && state.buzz.teamId) {
      const logEntry = { ...baseLog, result: "wrong", player: buzzer?.name ?? "?", team: buzzerTeam?.name ?? "?", teamColor: buzzerTeam?.color ?? "#ef4444", scoreDelta: `-$${scoreChange.toLocaleString()}` };
      const updatedWrongPlayers = [...(state.currentClue.wrongPlayers ?? []), state.buzz.playerId];
      const deducted = {
        ...state,
        teams: state.teams.map((t) => t.id === state.buzz.teamId ? { ...t, score: t.score - scoreChange } : t),
        currentClue: { ...state.currentClue, wrongPlayers: updatedWrongPlayers },
        buzz: freshBuzz(),
        gameLog: [...(state.gameLog ?? []), logEntry],
      };
      state = isDD ? markClueUsed(deducted) : deducted;
      io.emit("sound:cue", "wrong");
    } else {
      const logEntry = { ...baseLog, result: "skip", player: null, team: null, teamColor: null, scoreDelta: null };
      state = { ...markClueUsed({ ...state, buzz: freshBuzz() }), gameLog: [...(state.gameLog ?? []), logEntry] };
    }
    emitState();
  });

  socket.on("host:adjustScore", ({ teamId, delta }) => {
    if (typeof delta !== "number" || !isFinite(delta)) return;
    state = { ...state, teams: state.teams.map((t) => t.id === teamId ? { ...t, score: t.score + Math.max(-10000, Math.min(10000, Math.round(delta))) } : t) };
    emitState();
  });

  // ─── Final Jaypardy ───────────────────────────────────────────────────────
  socket.on("host:startFinal", ({ category }) => {
    if (state.phase !== "board") return;
    const cat = categoryCache.find((c) => c.category === category);
    if (!cat) return;
    const clue            = pickRandom(cat.clues, 1)[0];
    const eligiblePlayers = state.players.filter((p) => p.teamId);
    const wagers = {}; const answers = {};
    eligiblePlayers.forEach((p) => { wagers[p.id] = null; answers[p.id] = null; });
    state = { ...state, phase: "finalWager", finalJaypardy: { category: cat.category, question: clue.q, answer: clue.a, wagers, answers, revealed: [] } };
    emitState();
  });

  socket.on("player:submitFinalWager", ({ amount }) => {
    if (state.phase !== "finalWager" || !state.finalJaypardy) return;
    const p = state.players.find((x) => x.id === socket.id);
    if (!p || !p.teamId || !(socket.id in state.finalJaypardy.wagers)) return;
    const team   = state.teams.find((t) => t.id === p.teamId);
    const parsed = parseInt(amount, 10);
    if (!isFinite(parsed) || parsed < 0) return;
    state = { ...state, finalJaypardy: { ...state.finalJaypardy, wagers: { ...state.finalJaypardy.wagers, [socket.id]: Math.min(Math.max(parsed, 0), Math.max(team?.score ?? 0, 0)) } } };
    emitState();
  });

  socket.on("host:revealFinalClue",  () => { if (state.phase === "finalWager") { state = { ...state, phase: "finalClue" };   emitState(); } });
  socket.on("host:startFinalReveal", () => { if (state.phase === "finalClue")  { state = { ...state, phase: "finalReveal" }; emitState(); } });

  socket.on("player:submitFinalAnswer", ({ answer }) => {
    if (state.phase !== "finalClue" || !state.finalJaypardy) return;
    const p = state.players.find((x) => x.id === socket.id);
    if (!p || !(socket.id in state.finalJaypardy.answers)) return;
    state = { ...state, finalJaypardy: { ...state.finalJaypardy, answers: { ...state.finalJaypardy.answers, [socket.id]: (answer || "").trim().slice(0, 200) } } };
    emitState();
  });

  socket.on("host:revealFinalAnswer", ({ playerId }) => {
    if (state.phase !== "finalReveal" || !state.finalJaypardy || state.finalJaypardy.revealed.includes(playerId)) return;
    state = { ...state, finalJaypardy: { ...state.finalJaypardy, revealed: [...state.finalJaypardy.revealed, playerId] } };
    emitState();
  });

  socket.on("host:markFinal", ({ playerId, correct }) => {
    if (state.phase !== "finalReveal" || !state.finalJaypardy) return;
    const p = state.players.find((x) => x.id === playerId);
    if (!p) return;
    const wager = state.finalJaypardy.wagers[playerId] ?? 0;
    state = { ...state, teams: state.teams.map((t) => t.id === p.teamId ? { ...t, score: t.score + (correct ? wager : -wager) } : t) };
    emitState();
  });

  socket.on("host:endGame", () => { state = { ...state, phase: "gameOver" }; emitState(); });

  // ─── Load Theme ───────────────────────────────────────────────────────────
  socket.on("host:loadTheme", ({ categories }) => {
    if (!Array.isArray(categories) || categories.length !== 6) return;
    const round   = state.board?.round ?? 1;
    const values  = round === 2 ? ROUND2_VALUES : ROUND1_VALUES;
    const ddCount = round === 2 ? 2 : 1;
    const columns = categories.map((catName, ci) => {
      const cat    = categoryCache.find((c) => c.category === catName) ?? categoryCache[ci % categoryCache.length];
      const chosen = pickRandom(cat.clues, 5);
      return { id:`c${ci}`, title:cat.category, hint: cat.hint || "", clues: chosen.map((cl, ri) => {
        const clueData = { id:`c${ci}r${ri}`, value:values[ri], question:cl.q, answer:cl.a, used:false, isDD:false };
        if (cl.mediaUrl)  clueData.mediaUrl  = cl.mediaUrl;
        if (cl.mediaType) clueData.mediaType = cl.mediaType;
        if (cl.publicId)  clueData.publicId  = cl.publicId;
        return clueData;
      }) };
    });
    const placed = new Set(); let att = 0;
    while (placed.size < ddCount && att < 50) {
      att++;
      const col = Math.floor(Math.random() * 6), row = 1 + Math.floor(Math.random() * 4), key = `${col}-${row}`;
      if (!placed.has(key)) { columns[col].clues[row].isDD = true; placed.add(key); }
    }
    state = { ...state, board: { round, columns }, phase: "introducing", currentClue: null, wager: null, buzz: freshBuzz(), introIndex: -1 };
    emitState();
  });

  // ─── Clue Editor ─────────────────────────────────────────────────────────
  socket.on("editor:getAll", async () => {
    try { socket.emit("editor:data", await getAllCategories()); }
    catch (e) { console.error("[editor] getAll error:", e.message); }
  });
  socket.on("editor:saveCategory", async ({ name, clues, hint }) => {
    if (!name?.trim() || !Array.isArray(clues)) return;
    try {
      await upsertCategory(name.trim(), clues, hint || "");
      await refreshCategoryCache();
      socket.emit("editor:data", await getAllCategories());
      io.emit("categories:update", categoryCache.map((c) => c.category));
    } catch (e) { console.error("[editor] saveCategory error:", e.message); }
  });
  socket.on("editor:renameCategory", async ({ oldName, newName }) => {
    if (!oldName?.trim() || !newName?.trim()) return;
    try {
      await renameCategory(oldName.trim(), newName.trim());
      await refreshCategoryCache();
      socket.emit("editor:data", await getAllCategories());
      io.emit("categories:update", categoryCache.map((c) => c.category));
    } catch (e) { console.error("[editor] renameCategory error:", e.message); }
  });
  socket.on("editor:deleteCategory", async ({ name }) => {
    try {
      await deleteCategory(name);
      await refreshCategoryCache();
      socket.emit("editor:data", await getAllCategories());
      io.emit("categories:update", categoryCache.map((c) => c.category));
    } catch (e) { console.error("[editor] deleteCategory error:", e.message); }
  });

  // ─── Reset / Disconnect ───────────────────────────────────────────────────
  socket.on("host:resetGame", () => {
    // Clear player registry on full reset so new game starts fresh
    Object.keys(playerRegistry).forEach((k) => delete playerRegistry[k]);
    Object.keys(socketToPlayer).forEach((k) => delete socketToPlayer[k]);
    clearBuzzWindow();
    state = freshState();
    emitState();
  });

  socket.on("disconnect", () => {
    console.log(`[-] ${socket.id}`);
    clearInterval(pingTimer);
    delete playerLatency[socket.id];
    pendingBuzzes = pendingBuzzes.filter((b) => b.socketId !== socket.id);

    const wasBuzzer = state.buzz.playerId === socket.id;

    // Control handoff on disconnect
    let newControlPlayerId = state.controlPlayerId;
    let newControlTeamId   = state.controlTeamId;
    if (state.controlPlayerId === socket.id) {
      const remaining = state.players.filter((p) => p.id !== socket.id && p.teamId === state.controlTeamId);
      if (remaining.length > 0) {
        newControlPlayerId = remaining[0].id;
      } else {
        const anyPlayer = state.players.find((p) => p.id !== socket.id && p.teamId);
        newControlPlayerId = anyPlayer?.id ?? null;
        newControlTeamId   = anyPlayer?.teamId ?? null;
      }
    }

    // Note: we do NOT clean up socketToPlayer here — the persistent mapping
    // stays so the player can reconnect. It gets cleaned on host:resetGame.
    // We DO remove them from the active players list.
    state = {
      ...state,
      players:         state.players.filter((p) => p.id !== socket.id),
      buzz:            wasBuzzer ? freshBuzz() : state.buzz,
      controlPlayerId: newControlPlayerId,
      controlTeamId:   newControlTeamId,
    };
    emitState();
  });
});

// ─── Serve React client ───────────────────────────────────────────────────────
// ─── Media upload endpoint ───────────────────────────────────────────────────
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({
    url:          req.file.path,
    public_id:    req.file.filename,
    resource_type: req.file.mimetype?.startsWith("video") ? "video"
                 : req.file.mimetype?.startsWith("audio") ? "audio"
                 : "image",
  });
});

// ─── Media delete endpoint ────────────────────────────────────────────────────
app.delete("/api/upload/:publicId", async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.publicId);
    await cloudinary.uploader.destroy(id, { resource_type: "auto" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const clientBuild = path.join(__dirname, "../client/dist");
app.use(express.static(clientBuild));
app.get("/{*path}", (req, res) => res.sendFile(path.join(clientBuild, "index.html")));

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
initDb()
  .then(() => refreshCategoryCache())
  .then(() => server.listen(PORT, () => console.log(`Jaypardy server running on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error("[db] Failed to initialize database:", err.message);
    categoryCache = QUESTION_BANK;
    console.log(`[db] using questions.js fallback (${categoryCache.length} categories)`);
    server.listen(PORT, () => console.log(`Jaypardy server running on http://localhost:${PORT} (no db)`));
  });