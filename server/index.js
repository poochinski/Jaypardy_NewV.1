const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

/**
 * ===== Jaypardy V1.2 Server (Playable Round 1) =====
 * - Single `state` object
 * - Server is source of truth
 * - Clients render state
 * - Host emits events; server applies them and broadcasts state:update
 */

const TEAMS = [
  { id: "red", name: "Red", score: 0 },
  { id: "blue", name: "Blue", score: 0 },
  { id: "green", name: "Green", score: 0 },
  { id: "yellow", name: "Yellow", score: 0 },
  { id: "purple", name: "Purple", score: 0 },
  { id: "orange", name: "Orange", score: 0 },
];

const ROUND1_VALUES = [100, 200, 300, 400, 500];

// Minimal seed categories + clues (we can swap later)
const ROUND1_BANK = [
  {
    category: "90s Disney Princess",
    clues: [
      { q: "She has a tiger named Rajah.", a: "Who is Jasmine?" },
      { q: "This princess’s dad is Chief of the Powhatan tribe.", a: "Who is Pocahontas?" },
      { q: "She trades her voice for legs.", a: "Who is Ariel?" },
      { q: "She’s cursed to sleep after touching a spinning wheel.", a: "Who is Aurora?" },
      { q: "She marries a beast who becomes a prince again.", a: "Who is Belle?" },
      { q: "She has a fairy godmother and loses a glass slipper.", a: "Who is Cinderella?" },
      { q: "She cleans for her stepfamily and sings with animals.", a: "Who is Snow White?" },
      { q: "She’s a princess who disguises herself as a soldier.", a: "Who is Mulan?" },
      { q: "She lives in a tower with very long magical hair.", a: "Who is Rapunzel?" },
      { q: "She kisses a frog prince.", a: "Who is Tiana?" },
    ],
  },
  {
    category: "The Office (US)",
    clues: [
      { q: "The regional manager of Dunder Mifflin Scranton.", a: "Who is Michael Scott?" },
      { q: "The beet-farming assistant (to the) regional manager.", a: "Who is Dwight Schrute?" },
      { q: "Pam’s fiancé who works in a warehouse and plays in a band.", a: "Who is Roy?" },
      { q: "Jim’s classic prank weapon against Dwight.", a: "What is Jell-O?" },
      { q: "The company that buys Dunder Mifflin later in the series.", a: "What is Sabre?" },
      { q: "The “World’s Best Boss” mug is associated with him.", a: "Who is Michael Scott?" },
      { q: "The office HR rep.", a: "Who is Toby Flenderson?" },
      { q: "The receptionist who becomes a salesperson then office administrator.", a: "Who is Pam Beesly?" },
      { q: "The chili guy.", a: "Who is Kevin Malone?" },
      { q: "Michael’s improv class / troupe name.", a: "What is Threat Level Midnight? (alt: improv “The Improvisation”)"},
    ],
  },
  {
    category: "iCarly",
    clues: [
      { q: "Carly’s best friend with a love for fashion and drama.", a: "Who is Sam Puckett? (or Freddie Benson—depending)"},
      { q: "The tech-savvy boy who helped produce iCarly.", a: "Who is Freddie Benson?" },
      { q: "Carly’s older brother and artist.", a: "Who is Spencer Shay?" },
      { q: "The web show they produce.", a: "What is iCarly?" },
      { q: "Gibby’s first name.", a: "What is Gibby?" },
      { q: "Sam’s favorite snack often referenced.", a: "What are meatballs / fried chicken / ribs? (we can refine later)"},
      { q: "Carly’s last name.", a: "What is Shay?" },
      { q: "The doorman in Carly’s building.", a: "Who is Lewbert?" },
      { q: "The character known for saying ‘I’m Gibby!’", a: "Who is Gibby?" },
      { q: "Freddie’s mom’s name.", a: "Who is Marissa Benson?" },
    ],
  },
  {
    category: "3rd Grade US Geography",
    clues: [
      { q: "The ocean on the West Coast of the United States.", a: "What is the Pacific Ocean?" },
      { q: "The ocean on the East Coast of the United States.", a: "What is the Atlantic Ocean?" },
      { q: "The U.S. capital city.", a: "What is Washington, D.C.?" },
      { q: "A state directly north of Oregon.", a: "What is Washington?" },
      { q: "A large river that forms part of the Oregon/Washington border.", a: "What is the Columbia River?" },
      { q: "The largest state by area.", a: "What is Alaska?" },
      { q: "The state known as the Sunshine State.", a: "What is Florida?" },
      { q: "The state that looks like a mitten.", a: "What is Michigan?" },
      { q: "The longest river in the U.S. (common answer).", a: "What is the Mississippi River?" },
      { q: "The state where the Grand Canyon is located.", a: "What is Arizona?" },
    ],
  },
  {
    category: "TikTok Gen Pop",
    clues: [
      { q: "A short video trend where people lip-sync to audio clips.", a: "What is a TikTok trend / sound?" },
      { q: "The TikTok feature used to respond side-by-side to another video.", a: "What is a Duet?" },
      { q: "The TikTok feature used to add your video after a clip.", a: "What is Stitch?" },
      { q: "The main page where TikTok shows recommended videos.", a: "What is the For You Page (FYP)?" },
      { q: "Slang for something amazing or impressive.", a: "What is ‘fire’ / ‘goated’?" },
      { q: "A very short, repeating video format popular online.", a: "What is a meme / loop?" },
      { q: "The act of posting a quick update video.", a: "What is vlogging / posting?" },
      { q: "Common term for the text placed over a TikTok.", a: "What is a caption?" },
      { q: "The section where viewers leave messages.", a: "What are comments?" },
      { q: "The heart icon means you did this.", a: "What is like?" },
    ],
  },
  {
    category: "General Knowledge",
    clues: [
      { q: "The planet we live on.", a: "What is Earth?" },
      { q: "The color of the sky on a clear day.", a: "What is blue?" },
      { q: "H2O is also known as this.", a: "What is water?" },
      { q: "The opposite of ‘hot’.", a: "What is cold?" },
      { q: "A shape with 3 sides.", a: "What is a triangle?" },
      { q: "A baby cat is called a…", a: "What is a kitten?" },
      { q: "The largest mammal.", a: "What is a blue whale?" },
      { q: "The star at the center of our solar system.", a: "What is the Sun?" },
      { q: "A device used to call someone.", a: "What is a phone?" },
      { q: "The month after December.", a: "What is January?" },
    ],
  },
];

function pickRandom(arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function buildRound1Board() {
  // pick 6 categories
  const cats = pickRandom(ROUND1_BANK, 6);

  // for each category, pick 5 clues
  const columns = cats.map((c, colIndex) => {
    const chosen = pickRandom(c.clues, 5);
    return {
      id: `c${colIndex}`,
      title: c.category,
      clues: chosen.map((cl, rowIndex) => ({
        id: `c${colIndex}r${rowIndex}`,
        value: ROUND1_VALUES[rowIndex],
        question: cl.q,
        answer: cl.a,
        used: false,
        isDD: false,
      })),
    };
  });

  // 1 Daily Double in round 1
  const ddCol = Math.floor(Math.random() * 6);
  const ddRow = Math.floor(Math.random() * 5);
  columns[ddCol].clues[ddRow].isDD = true;

  return { round: 1, columns };
}

function freshState() {
  return {
    phase: "lobby", // lobby | board | clue
    players: [],
    teams: TEAMS.map((t) => ({ ...t, score: 0 })),
    controlTeamId: null,
    board: null, // { round, columns }
    currentClue: null, // { col, row, clueId, question, answer, value, isDD }
    buzz: {
      locked: false,
      playerId: null,
      teamId: null,
      name: null,
      emoji: null,
      timestamp: null,
    },
  };
}

let state = freshState();

function emitState() {
  io.emit("state:update", state);
}

// helper: unlock buzz
function resetBuzz() {
  state.buzz = {
    locked: false,
    playerId: null,
    teamId: null,
    name: null,
    emoji: null,
    timestamp: null,
  };
}

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);
  socket.emit("state:update", state);

  socket.on("player:join", ({ name, emoji }) => {
    state.players = state.players.filter((p) => p.id !== socket.id);
    state.players.push({
      id: socket.id,
      name: (name || "").trim(),
      emoji: emoji || "😀",
      teamId: null,
    });
    emitState();
  });

  socket.on("host:assignTeam", ({ playerId, teamId }) => {
    const p = state.players.find((x) => x.id === playerId);
    if (!p) return;
    p.teamId = teamId || null;
    emitState();
  });

  socket.on("host:startJaypardy", () => {
    state.board = buildRound1Board();
    state.phase = "board";
    state.currentClue = null;
    resetBuzz();
    emitState();
  });

  socket.on("host:selectClue", ({ colIndex, rowIndex }) => {
    if (!state.board) return;
    const col = state.board.columns[colIndex];
    if (!col) return;
    const clue = col.clues[rowIndex];
    if (!clue || clue.used) return;

    state.currentClue = {
      colIndex,
      rowIndex,
      clueId: clue.id,
      question: clue.question,
      answer: clue.answer,
      value: clue.value,
      isDD: clue.isDD,
    };

    state.phase = "clue";
    resetBuzz();
    emitState();
  });

  socket.on("player:buzz", () => {
    if (state.phase !== "clue") return; // only buzz during clue
    if (state.buzz.locked) return;

    const p = state.players.find((x) => x.id === socket.id);
    if (!p) return;
    if (!p.teamId) return;

    state.buzz = {
      locked: true,
      playerId: p.id,
      teamId: p.teamId,
      name: p.name,
      emoji: p.emoji,
      timestamp: Date.now(),
    };

    emitState();
  });

  socket.on("host:resetBuzz", () => {
    resetBuzz();
    emitState();
  });

  socket.on("host:mark", ({ result }) => {
    // result: "correct" | "wrong" | "skip"
    if (!state.currentClue) return;

    if (result === "correct" && state.buzz.locked && state.buzz.teamId) {
      // add points to team
      const t = state.teams.find((x) => x.id === state.buzz.teamId);
      if (t) t.score += state.currentClue.value;

      // control goes to that team
      state.controlTeamId = state.buzz.teamId;
    }

    // mark clue used
    const { colIndex, rowIndex } = state.currentClue;
    const clue = state.board?.columns?.[colIndex]?.clues?.[rowIndex];
    if (clue) clue.used = true;

    // back to board
    state.currentClue = null;
    state.phase = "board";
    resetBuzz();
    emitState();
  });

  socket.on("host:resetGame", () => {
    // keep players but reset everything else (handy)
    const playersCopy = [...state.players];
    state = freshState();
    state.players = playersCopy;
    emitState();
  });

  socket.on("disconnect", () => {
    state.players = state.players.filter((p) => p.id !== socket.id);

    if (state.buzz.playerId === socket.id) {
      resetBuzz();
    }

    emitState();
    console.log("❌ Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 NEW V1.2 SERVER CODE RUNNING on http://localhost:${PORT}`));

