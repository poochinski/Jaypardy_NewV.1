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

console.log("[db] DATABASE_URL present:", !!process.env.DATABASE_URL);
console.log("[db] DATABASE_URL prefix:", (process.env.DATABASE_URL || "").slice(0, 20));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS themes (name TEXT PRIMARY KEY, categories TEXT[] NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS categories (name TEXT PRIMARY KEY, clues JSONB NOT NULL DEFAULT '[]', created_at TIMESTAMPTZ DEFAULT NOW())`);
  if (QUESTION_BANK.length > 0) {
    const values = QUESTION_BANK.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(", ");
    const params = QUESTION_BANK.flatMap((cat) => [cat.category, JSON.stringify(cat.clues)]);
    const result = await pool.query(`INSERT INTO categories (name, clues) VALUES ${values} ON CONFLICT (name) DO NOTHING`, params);
    if (result.rowCount > 0) console.log(`[db] seeded ${result.rowCount} new categories`);
  }
  console.log("[db] tables ready");
}

async function getAllCategories() {
  const { rows } = await pool.query("SELECT name, clues FROM categories ORDER BY name ASC");
  return rows.map((r) => ({ category: r.name, clues: r.clues }));
}
async function upsertCategory(name, clues) {
  await pool.query(`INSERT INTO categories (name, clues) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET clues = $2`, [name, JSON.stringify(clues)]);
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
  await pool.query(`INSERT INTO themes (name, categories) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET categories = $2`, [name, categories]);
}
async function removeTheme(name) {
  await pool.query("DELETE FROM themes WHERE name = $1", [name]);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_PLAYERS     = 60;
const MAX_NAME_LENGTH = 32;

// All 6 possible teams — game config controls how many are active
const ALL_TEAMS = [
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
const playerLatency = {};
const PING_INTERVAL          = 5000;
const MAX_LATENCY            = 500;
const LOCKOUT_WINDOW         = 100;
const LATENCY_BROADCAST_MS   = 3000;

// ─── Player registry ──────────────────────────────────────────────────────────
const playerRegistry = {};
const socketToPlayer = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom(arr, n) {
  const copy = [...arr]; const out = [];
  while (out.length < n && copy.length) { const idx = Math.floor(Math.random() * copy.length); out.push(copy.splice(idx, 1)[0]); }
  return out;
}

function pickClueForRow(clues, rowIndex, usedIndices) {
  const tierMap = { 0:["easy"], 1:["easy"], 2:["medium"], 3:["medium"], 4:["hard"] };
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
    if (cl) { chosen.push(cl); } else { const rem = clues.filter((c) => !chosen.includes(c)); if (rem.length > 0) chosen.push(rem[Math.floor(Math.random() * rem.length)]); }
  }
  return chosen;
}

let categoryCache = [];

async function refreshCategoryCache() {
  try {
    const cats = await getAllCategories();
    if (cats.length > 0) { categoryCache = cats; console.log(`[db] category cache refreshed: ${categoryCache.length} categories`); }
    else { console.log("[db] no categories in DB yet, using questions.js fallback"); categoryCache = QUESTION_BANK; }
  } catch (e) { console.error("[db] cache refresh failed, using questions.js fallback:", e.message); categoryCache = QUESTION_BANK; }
}

async function buildBoard(round = 1, themeCategories = null) {
  const values  = round === 2 ? ROUND2_VALUES : ROUND1_VALUES;
  const ddCount = round === 2 ? 2 : 1;
  if (categoryCache.length < 6) { console.error(`[board] Not enough categories`); return null; }

  let cats;
  if (themeCategories && themeCategories.length === 6) {
    cats = themeCategories.map((name) => categoryCache.find((c) => c.category === name)).filter(Boolean);
    if (cats.length < 6) cats = pickRandom(categoryCache, 6);
  } else {
    cats = pickRandom(categoryCache, 6);
  }

  const columns = cats.map((c, ci) => {
    const chosen = pickFiveClues(c.clues);
    return { id:`c${ci}`, title:c.category, clues: chosen.map((cl, ri) => ({ id:`c${ci}r${ri}`, value:values[ri], question:cl.q, answer:cl.a, used:false, isDD:false })) };
  });
  const placed = new Set(); let att = 0;
  while (placed.size < ddCount && att < 50) { att++; const col = Math.floor(Math.random()*6), row = 1+Math.floor(Math.random()*4), key=`${col}-${row}`; if (!placed.has(key)) { columns[col].clues[row].isDD=true; placed.add(key); } }
  return { round, columns };
}

function freshBuzz() {
  return { locked:false, playerId:null, teamId:null, name:null, emoji:null, timestamp:null };
}

// ─── Default game config ──────────────────────────────────────────────────────
function defaultConfig() {
  return {
    maxPlayers: 10,
    teamPlay:   true,
    numTeams:   2,
    theme:      null,  // null = random, or theme name string
    buzzerType: "standard",  // placeholder for future buzzer types
  };
}

function freshState() {
  return {
    phase:           "pregame",  // ← NEW: pregame before lobby opens
    paused:          false,
    pauseMessage:    "",
    players:         [],
    teams:           ALL_TEAMS.slice(0, 2).map((t) => ({ ...t, score: 0 })),
    gameConfig:      defaultConfig(),  // ← NEW
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
  };
}

function markClueUsed(state) {
  const { colIndex, rowIndex } = state.currentClue;
  return {
    ...state,
    board: { ...state.board, columns: state.board.columns.map((col, ci) => ci === colIndex ? { ...col, clues: col.clues.map((clue, ri) => ri === rowIndex ? { ...clue, used: true } : clue) } : col) },
    currentClue: null, phase: "board", wager: null, buzz: freshBuzz(),
  };
}

function pickRandomControlPlayer(players) {
  const assigned = players.filter((p) => p.teamId);
  if (assigned.length === 0) return { playerId: null, teamId: null };
  const p = assigned[Math.floor(Math.random() * assigned.length)];
  return { playerId: p.id, teamId: p.teamId };
}

function getControlPlayer(state) {
  if (state.controlPlayerId) { const p = state.players.find((x) => x.id === state.controlPlayerId); if (p) return p; }
  if (state.controlTeamId)   { const p = state.players.find((x) => x.teamId === state.controlTeamId); if (p) return p; }
  return state.players.find((p) => p.teamId) ?? null;
}

function compensatedTapTime(socketId, serverArrivalTime) {
  const latency = playerLatency[socketId] ?? 50;
  return serverArrivalTime - Math.min(latency / 2, MAX_LATENCY);
}

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
  pendingBuzzes = []; buzzWindowTimer = null;
  const p = state.players.find((x) => x.id === winner.socketId);
  if (!p || !p.teamId) return;
  if (state.phase !== "clue" && state.phase !== "dailyDoubleClue") return;
  if (state.buzz.locked) return;
  state = { ...state, buzz: { locked:true, playerId:p.id, teamId:p.teamId, name:p.name, emoji:p.emoji, timestamp:winner.tapTime } };
  emitState();
}

setInterval(() => {
  if (Object.keys(playerLatency).length > 0) io.emit("latency:update", { ...playerLatency });
}, LATENCY_BROADCAST_MS);

let state = freshState();
function emitState() { io.emit("state:update", state); }

// ─── Socket Handlers ──────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[+] ${socket.id}`);
  socket.emit("state:update", state);
  getAllThemes().then((t) => socket.emit("themes:update", t)).catch(() => {});

  // ─── Ping ─────────────────────────────────────────────────────────────────
  const doPing = () => { if (socket.connected) socket.emit("ping:server", { t: Date.now() }); };
  doPing();
  const pingTimer = setInterval(doPing, PING_INTERVAL);
  socket.on("pong:server", ({ t }) => {
    const rtt = Date.now() - t;
    const prev = playerLatency[socket.id] ?? rtt;
    playerLatency[socket.id] = Math.round(prev * 0.7 + rtt * 0.3);
  });

  // ─── Themes ───────────────────────────────────────────────────────────────
  socket.on("host:getThemes", async () => { try { socket.emit("themes:update", await getAllThemes()); } catch (e) { console.error(e.message); } });
  socket.on("host:saveTheme", async ({ name, categories }) => {
    if (!name || !Array.isArray(categories) || categories.length !== 6) return;
    const safeName = name.trim().slice(0, 50); if (!safeName) return;
    try { await upsertTheme(safeName, categories); socket.emit("themes:update", await getAllThemes()); } catch (e) { console.error(e.message); }
  });
  socket.on("host:deleteTheme", async ({ name }) => { try { await removeTheme(name); socket.emit("themes:update", await getAllThemes()); } catch (e) { console.error(e.message); } });

  // ─── Pause / Resume ───────────────────────────────────────────────────────
  socket.on("host:pause",  ({ message }) => { state = { ...state, paused: true,  pauseMessage: message || "Stand By" }; emitState(); });
  socket.on("host:resume", ()            => { state = { ...state, paused: false, pauseMessage: "" };                    emitState(); });

  // ─── NEW: Host configures game and opens lobby ────────────────────────────
  socket.on("host:configureGame", ({ maxPlayers, teamPlay, numTeams, theme, buzzerType }) => {
    if (state.phase !== "pregame") return;

    const safeNumTeams  = Math.min(6, Math.max(2, parseInt(numTeams, 10) || 2));
    const safeMaxPlayers = Math.min(60, Math.max(2, parseInt(maxPlayers, 10) || 10));

    const activeTeams = ALL_TEAMS.slice(0, safeNumTeams).map((t) => ({ ...t, score: 0 }));

    const config = {
      maxPlayers:  safeMaxPlayers,
      teamPlay:    !!teamPlay,
      numTeams:    safeNumTeams,
      theme:       theme || null,
      buzzerType:  buzzerType || "standard",
    };

    state = {
      ...state,
      phase:      "lobby",
      gameConfig: config,
      teams:      activeTeams,
      // Reset all player team assignments when lobby opens fresh
      players:    state.players.map((p) => ({ ...p, teamId: null })),
    };
    emitState();
  });

  // ─── Players ──────────────────────────────────────────────────────────────
  socket.on("player:join", ({ name, emoji, playerId, teamId }) => {
    if (state.players.length >= (state.gameConfig?.maxPlayers ?? MAX_PLAYERS)) return;
    const safeName  = (name || "").trim().slice(0, MAX_NAME_LENGTH);
    if (!safeName) return;
    const safeEmoji = VALID_EMOJIS.has(emoji) ? emoji : "😀";

    // Reconnection — restore from registry
    let restoredTeamId = null;
    if (playerId && playerRegistry[playerId]) {
      restoredTeamId = playerRegistry[playerId].teamId ?? null;
    }

    // Validate requested team is valid and active
    let finalTeamId = null;
    const existingBySocket = state.players.find((p) => p.id === socket.id);

    if (state.phase === "lobby") {
      // In lobby: player can pick a team
      if (teamId && state.teams.some((t) => t.id === teamId)) {
        finalTeamId = teamId;
      } else if (restoredTeamId && state.teams.some((t) => t.id === restoredTeamId)) {
        finalTeamId = restoredTeamId;
      }
    } else {
      // In game: restore registry team
      finalTeamId = restoredTeamId ?? existingBySocket?.teamId ?? null;
    }

    if (playerId) {
      playerRegistry[playerId] = { name: safeName, emoji: safeEmoji, teamId: finalTeamId };
      socketToPlayer[socket.id] = playerId;
    }

    state = {
      ...state,
      players: [
        ...state.players.filter((p) => p.id !== socket.id),
        { id: socket.id, name: safeName, emoji: safeEmoji, teamId: finalTeamId },
      ],
    };

    // Auto control if nobody has it
    if (finalTeamId && !state.controlPlayerId) {
      state = { ...state, controlPlayerId: socket.id, controlTeamId: finalTeamId };
    }

    emitState();
  });

  // ─── NEW: Player selects a team in the lobby ──────────────────────────────
  socket.on("player:selectTeam", ({ teamId }) => {
    if (state.phase !== "lobby") return;
    const p = state.players.find((x) => x.id === socket.id);
    if (!p) return;
    if (teamId && !state.teams.some((t) => t.id === teamId)) return;

    const finalTeamId = teamId || null;

    // Update registry
    const persistentId = socketToPlayer[socket.id];
    if (persistentId && playerRegistry[persistentId]) {
      playerRegistry[persistentId].teamId = finalTeamId;
    }

    state = { ...state, players: state.players.map((x) => x.id === socket.id ? { ...x, teamId: finalTeamId } : x) };

    if (finalTeamId && !state.controlPlayerId) {
      state = { ...state, controlPlayerId: socket.id, controlTeamId: finalTeamId };
    }

    emitState();
  });

  socket.on("host:assignTeam", ({ playerId, teamId }) => {
    if (teamId && !state.teams.some((t) => t.id === teamId)) return;
    state = { ...state, players: state.players.map((p) => p.id === playerId ? { ...p, teamId: teamId || null } : p) };
    const persistentId = socketToPlayer[playerId];
    if (persistentId && playerRegistry[persistentId]) playerRegistry[persistentId].teamId = teamId || null;
    if (teamId && !state.controlPlayerId) state = { ...state, controlPlayerId: playerId, controlTeamId: teamId };
    if (!teamId && state.controlPlayerId === playerId) {
      const next = state.players.find((p) => p.id !== playerId && p.teamId);
      state = { ...state, controlPlayerId: next?.id ?? null, controlTeamId: next?.teamId ?? null };
    }
    emitState();
  });

  // ─── Game flow ────────────────────────────────────────────────────────────
  socket.on("host:startJaypardy", async () => {
    if (state.phase !== "lobby") return;

    // Load theme if configured
    let themeCategories = null;
    if (state.gameConfig?.theme) {
      try {
        const themes = await getAllThemes();
        themeCategories = themes[state.gameConfig.theme] ?? null;
      } catch (e) { console.error("[theme] load error:", e.message); }
    }

    const board = await buildBoard(1, themeCategories);
    if (!board) return;

    const { playerId, teamId } = pickRandomControlPlayer(state.players);
    state = { ...state, board, phase: "board", currentClue: null, buzz: freshBuzz(), controlPlayerId: playerId, controlTeamId: teamId };
    emitState();
  });

  socket.on("host:swapCategory", ({ colIndex, newCategory }) => {
    if (!state.board || colIndex < 0 || colIndex >= state.board.columns.length) return;
    const cat = categoryCache.find((c) => c.category === newCategory);
    if (!cat) return;
    if (state.board.columns.some((col, ci) => ci !== colIndex && col.title === newCategory)) return;
    const values = state.board.round === 2 ? ROUND2_VALUES : ROUND1_VALUES;
    const chosen = pickRandom(cat.clues, 5);
    const newCol = { id:`c${colIndex}`, title:cat.category, clues: chosen.map((cl, ri) => ({ id:`c${colIndex}r${ri}`, value:values[ri], question:cl.q, answer:cl.a, used:false, isDD:false })) };
    if (state.board.columns[colIndex].clues.some((c) => c.isDD)) newCol.clues[1 + Math.floor(Math.random() * 4)].isDD = true;
    state = { ...state, board: { ...state.board, columns: state.board.columns.map((col, ci) => ci === colIndex ? newCol : col) } };
    emitState();
  });

  socket.on("host:startRound2", async () => {
    if (state.phase !== "board" || state.board?.round !== 1) return;
    if (!state.board?.columns.every((col) => col.clues.every((c) => c.used))) return;
    const newBoard = await buildBoard(2);
    if (!newBoard) return;
    state = { ...state, board: newBoard, phase: "board", currentClue: null, wager: null, buzz: freshBuzz() };
    emitState();
  });

  socket.on("host:skipRound", async () => {
    if (!state.board || (state.phase !== "board" && state.phase !== "clue")) return;
    if (state.board.round === 1) {
      const newBoard = await buildBoard(2);
      if (!newBoard) return;
      state = { ...state, board: newBoard, phase: "board", currentClue: null, wager: null, buzz: freshBuzz() };
    } else {
      state = { ...state, phase: "board", currentClue: null, wager: null, buzz: freshBuzz(), board: { ...state.board, columns: state.board.columns.map((col) => ({ ...col, clues: col.clues.map((c) => ({ ...c, used: true })) })) } };
    }
    emitState();
  });

  socket.on("host:clearDDs", () => {
    if (!state.board || state.phase !== "board") return;
    state = { ...state, pickingDD: true, ddPicked: 0, board: { ...state.board, columns: state.board.columns.map((col) => ({ ...col, clues: col.clues.map((c) => ({ ...c, isDD: false })) })) } };
    emitState();
  });

  socket.on("host:pickDD", ({ colIndex, rowIndex }) => {
    if (!state.board || !state.pickingDD) return;
    const clue = state.board.columns[colIndex]?.clues[rowIndex];
    if (!clue || clue.used || clue.isDD || rowIndex < 1) return;
    const ddNeeded = state.board.round === 2 ? 2 : 1;
    const newDdPicked = (state.ddPicked ?? 0) + 1;
    const done = newDdPicked >= ddNeeded;
    state = { ...state, pickingDD: !done, ddPicked: done ? 0 : newDdPicked, board: { ...state.board, columns: state.board.columns.map((col, ci) => ci === colIndex ? { ...col, clues: col.clues.map((c, ri) => ri === rowIndex ? { ...c, isDD: true } : c) } : col) } };
    emitState();
  });

  socket.on("host:cancelPickDD", () => { state = { ...state, pickingDD: false, ddPicked: 0 }; emitState(); });

  socket.on("host:newBoard", async () => {
    const board = await buildBoard(state.board?.round ?? 1);
    if (!board) return;
    state = { ...state, board, phase: "board", currentClue: null, buzz: freshBuzz() };
    emitState();
  });

  socket.on("host:selectClue", ({ colIndex, rowIndex }) => {
    if (state.phase !== "board" || !state.board) return;
    const col = state.board.columns[colIndex];
    const clue = col?.clues[rowIndex];
    if (!clue || clue.used) return;
    const controlPlayer = getControlPlayer(state);
    clearBuzzWindow();
    state = { ...state, phase: clue.isDD ? "dailyDouble" : "clue", currentClue: { colIndex, rowIndex, clueId:clue.id, category:col.title, question:clue.question, answer:clue.answer, value:clue.value, isDD:clue.isDD, wagerTeamId:controlPlayer?.teamId ?? null, wagerPlayerId:controlPlayer?.id ?? null, wrongPlayers:[] }, wager:null, buzz:freshBuzz() };
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
    const team = state.teams.find((t) => t.id === state.currentClue.wagerTeamId);
    const maxWager = Math.max(team?.score ?? 0, 1000);
    state = { ...state, phase: "dailyDoubleClue", wager: { teamId: state.currentClue.wagerTeamId, amount: Math.min(parsed, maxWager) } };
    emitState();
  });

  socket.on("player:buzz", () => {
    if (state.phase !== "clue" && state.phase !== "dailyDoubleClue") return;
    if (state.buzz.locked) return;
    const p = state.players.find((x) => x.id === socket.id);
    if (!p || !p.teamId) return;
    if (state.phase === "dailyDoubleClue" && p.id !== state.currentClue?.wagerPlayerId) return;
    if (state.currentClue?.wrongPlayers?.includes(socket.id)) return;
    const tapTime = compensatedTapTime(socket.id, Date.now());
    if (buzzWindowTimer === null) { pendingBuzzes = [{ socketId:socket.id, tapTime }]; buzzWindowTimer = setTimeout(resolveBuzz, LOCKOUT_WINDOW); }
    else { pendingBuzzes.push({ socketId:socket.id, tapTime }); }
  });

  socket.on("host:resetBuzz", () => { clearBuzzWindow(); state = { ...state, buzz: freshBuzz() }; emitState(); });

  socket.on("host:mark", ({ result }) => {
    if (!state.currentClue) return;
    clearBuzzWindow();
    const isDD = state.phase === "dailyDoubleClue";
    const scoreChange = isDD ? (state.wager?.amount ?? 0) : state.currentClue.value;
    const ts = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
    const buzzer = state.buzz.locked ? state.players.find((p) => p.id === state.buzz.playerId) : null;
    const buzzerTeam = buzzer ? state.teams.find((t) => t.id === state.buzz.teamId) : null;
    const baseLog = { ts, category:state.currentClue.category, value:state.currentClue.value, question:state.currentClue.question, answer:state.currentClue.answer };

    if (result === "correct" && state.buzz.locked && state.buzz.teamId) {
      const logEntry = { ...baseLog, result:"correct", player:buzzer?.name??"?", team:buzzerTeam?.name??"?", teamColor:buzzerTeam?.color??"#21c55d", scoreDelta:`+$${scoreChange.toLocaleString()}` };
      state = { ...markClueUsed({ ...state, controlTeamId:state.buzz.teamId, controlPlayerId:state.buzz.playerId, teams:state.teams.map((t) => t.id===state.buzz.teamId ? {...t,score:t.score+scoreChange} : t) }), gameLog:[...(state.gameLog??[]),logEntry] };
      io.emit("sound:cue", "correct");
    } else if (result === "wrong" && state.buzz.locked && state.buzz.teamId) {
      const logEntry = { ...baseLog, result:"wrong", player:buzzer?.name??"?", team:buzzerTeam?.name??"?", teamColor:buzzerTeam?.color??"#ef4444", scoreDelta:`-$${scoreChange.toLocaleString()}` };
      const updatedWrongPlayers = [...(state.currentClue.wrongPlayers??[]), state.buzz.playerId];
      const deducted = { ...state, teams:state.teams.map((t) => t.id===state.buzz.teamId ? {...t,score:t.score-scoreChange} : t), currentClue:{...state.currentClue,wrongPlayers:updatedWrongPlayers}, buzz:freshBuzz(), gameLog:[...(state.gameLog??[]),logEntry] };
      state = isDD ? markClueUsed(deducted) : deducted;
      io.emit("sound:cue", "wrong");
    } else {
      const logEntry = { ...baseLog, result:"skip", player:null, team:null, teamColor:null, scoreDelta:null };
      state = { ...markClueUsed({ ...state, buzz: freshBuzz() }), gameLog:[...(state.gameLog??[]),logEntry] };
    }
    emitState();
  });

  socket.on("host:adjustScore", ({ teamId, delta }) => {
    if (typeof delta !== "number" || !isFinite(delta)) return;
    state = { ...state, teams: state.teams.map((t) => t.id===teamId ? {...t,score:t.score+Math.max(-10000,Math.min(10000,Math.round(delta)))} : t) };
    emitState();
  });

  socket.on("host:startFinal", ({ category }) => {
    if (state.phase !== "board") return;
    const cat = categoryCache.find((c) => c.category === category);
    if (!cat) return;
    const clue = pickRandom(cat.clues, 1)[0];
    const eligiblePlayers = state.players.filter((p) => p.teamId);
    const wagers = {}; const answers = {};
    eligiblePlayers.forEach((p) => { wagers[p.id]=null; answers[p.id]=null; });
    state = { ...state, phase:"finalWager", finalJaypardy:{ category:cat.category, question:clue.q, answer:clue.a, wagers, answers, revealed:[] } };
    emitState();
  });

  socket.on("player:submitFinalWager", ({ amount }) => {
    if (state.phase !== "finalWager" || !state.finalJaypardy) return;
    const p = state.players.find((x) => x.id===socket.id);
    if (!p || !p.teamId || !(socket.id in state.finalJaypardy.wagers)) return;
    const team = state.teams.find((t) => t.id===p.teamId);
    const parsed = parseInt(amount, 10);
    if (!isFinite(parsed) || parsed < 0) return;
    state = { ...state, finalJaypardy:{ ...state.finalJaypardy, wagers:{...state.finalJaypardy.wagers,[socket.id]:Math.min(Math.max(parsed,0),Math.max(team?.score??0,0))} } };
    emitState();
  });

  socket.on("host:revealFinalClue",  () => { if (state.phase==="finalWager") { state={...state,phase:"finalClue"};   emitState(); } });
  socket.on("host:startFinalReveal", () => { if (state.phase==="finalClue")  { state={...state,phase:"finalReveal"}; emitState(); } });

  socket.on("player:submitFinalAnswer", ({ answer }) => {
    if (state.phase !== "finalClue" || !state.finalJaypardy) return;
    const p = state.players.find((x) => x.id===socket.id);
    if (!p || !(socket.id in state.finalJaypardy.answers)) return;
    state = { ...state, finalJaypardy:{ ...state.finalJaypardy, answers:{...state.finalJaypardy.answers,[socket.id]:(answer||"").trim().slice(0,200)} } };
    emitState();
  });

  socket.on("host:revealFinalAnswer", ({ playerId }) => {
    if (state.phase!=="finalReveal"||!state.finalJaypardy||state.finalJaypardy.revealed.includes(playerId)) return;
    state = { ...state, finalJaypardy:{ ...state.finalJaypardy, revealed:[...state.finalJaypardy.revealed,playerId] } };
    emitState();
  });

  socket.on("host:markFinal", ({ playerId, correct }) => {
    if (state.phase!=="finalReveal"||!state.finalJaypardy) return;
    const p = state.players.find((x) => x.id===playerId);
    if (!p) return;
    const wager = state.finalJaypardy.wagers[playerId]??0;
    state = { ...state, teams:state.teams.map((t) => t.id===p.teamId ? {...t,score:t.score+(correct?wager:-wager)} : t) };
    emitState();
  });

  socket.on("host:endGame", () => { state={...state,phase:"gameOver"}; emitState(); });

  socket.on("host:loadTheme", ({ categories }) => {
    if (!Array.isArray(categories) || categories.length !== 6) return;
    const round=state.board?.round??1, values=round===2?ROUND2_VALUES:ROUND1_VALUES, ddCount=round===2?2:1;
    const columns = categories.map((catName, ci) => {
      const cat = categoryCache.find((c) => c.category===catName)??categoryCache[ci%categoryCache.length];
      const chosen = pickRandom(cat.clues, 5);
      return { id:`c${ci}`, title:cat.category, clues:chosen.map((cl,ri) => ({id:`c${ci}r${ri}`,value:values[ri],question:cl.q,answer:cl.a,used:false,isDD:false})) };
    });
    const placed=new Set(); let att=0;
    while (placed.size<ddCount&&att<50) { att++; const col=Math.floor(Math.random()*6),row=1+Math.floor(Math.random()*4),key=`${col}-${row}`; if (!placed.has(key)) { columns[col].clues[row].isDD=true; placed.add(key); } }
    state = { ...state, board:{round,columns}, phase:"board", currentClue:null, wager:null, buzz:freshBuzz() };
    emitState();
  });

  socket.on("editor:getAll", async () => { try { socket.emit("editor:data", await getAllCategories()); } catch (e) { console.error(e.message); } });
  socket.on("editor:saveCategory", async ({ name, clues }) => {
    if (!name?.trim()||!Array.isArray(clues)) return;
    try { await upsertCategory(name.trim(),clues); await refreshCategoryCache(); socket.emit("editor:data",await getAllCategories()); io.emit("categories:update",categoryCache.map((c)=>c.category)); } catch (e) { console.error(e.message); }
  });
  socket.on("editor:renameCategory", async ({ oldName, newName }) => {
    if (!oldName?.trim()||!newName?.trim()) return;
    try { await renameCategory(oldName.trim(),newName.trim()); await refreshCategoryCache(); socket.emit("editor:data",await getAllCategories()); io.emit("categories:update",categoryCache.map((c)=>c.category)); } catch (e) { console.error(e.message); }
  });
  socket.on("editor:deleteCategory", async ({ name }) => {
    try { await deleteCategory(name); await refreshCategoryCache(); socket.emit("editor:data",await getAllCategories()); io.emit("categories:update",categoryCache.map((c)=>c.category)); } catch (e) { console.error(e.message); }
  });

  socket.on("host:resetGame", () => {
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
    let newControlPlayerId = state.controlPlayerId, newControlTeamId = state.controlTeamId;
    if (state.controlPlayerId === socket.id) {
      const remaining = state.players.filter((p) => p.id!==socket.id&&p.teamId===state.controlTeamId);
      if (remaining.length>0) { newControlPlayerId=remaining[0].id; }
      else { const any=state.players.find((p)=>p.id!==socket.id&&p.teamId); newControlPlayerId=any?.id??null; newControlTeamId=any?.teamId??null; }
    }
    state = { ...state, players:state.players.filter((p)=>p.id!==socket.id), buzz:wasBuzzer?freshBuzz():state.buzz, controlPlayerId:newControlPlayerId, controlTeamId:newControlTeamId };
    emitState();
  });
});

const clientBuild = path.join(__dirname, "../client/dist");
app.use(express.static(clientBuild));
app.get("/{*path}", (req, res) => res.sendFile(path.join(clientBuild, "index.html")));

const PORT = process.env.PORT || 5000;
initDb().then(() => refreshCategoryCache()).then(() => server.listen(PORT, () => console.log(`Jaypardy server running on http://localhost:${PORT}`))).catch((err) => {
  console.error("[db] Failed to initialize database:", err.message);
  categoryCache = QUESTION_BANK;
  server.listen(PORT, () => console.log(`Jaypardy server running on http://localhost:${PORT} (no db)`));
});