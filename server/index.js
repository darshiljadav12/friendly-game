const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const QUESTIONS = require("./questions");

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));

app.get("/health", (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN },
});

/* =========================
   GAME CONFIG
========================= */

const MAX_PLAYERS = 2;
const BOARD_SIZE = 28; // must match the 8x8 ring layout on the client
const DICE_DELAY_MS = 700; // matches dice animation time
const RECONNECT_GRACE_MS = 60_000;
const MAX_NAME_LENGTH = 20;
const MAX_ANSWER_LENGTH = 80;

const LAP_BONUS = 5;
const HEART_POINTS = 5; // per heart when the partner rates an answer
const WILD_STEAL = 10;
const WILD_BACK_STEPS = 3;
const TIMED_DARE_MS = 30_000;
const TIMER_GRACE_MS = 1_000; // allows for network lag on the Done press
const MAX_POWER_UPS = 3;
const COOP_POINTS_PER_ROUND = 30; // co-op goal = rounds * this (test games averaged ~22–43 per round)
const REACTION_COOLDOWN_MS = 250;

// Chosen by the room creator
const LENGTH_OPTIONS = {
  5: { rounds: 5 },
  10: { rounds: 10 },
  20: { rounds: 20 },
  points150: { target: 150 },
};

const REACTIONS = ["😂", "❤️", "😳", "🔥", "😍", "👏"];
const POWER_UPS = ["freePass", "reroll", "handOff"];
const POWER_UP_NAMES = { freePass: "Free Pass", reroll: "Reroll", handOff: "Pass It On" };

const TILE_PATTERN = ["love", "dare", "guess", "memory", "wild", "gift", "dare", "timed", "love"];

// Board is defined only here and sent to clients, so both sides always agree
const BOARD = [
  "start",
  ...Array.from({ length: BOARD_SIZE - 1 }, (_, i) => TILE_PATTERN[i % TILE_PATTERN.length]),
];

// Base points for completing a challenge (skipping gives 0)
const POINTS = {
  love: 10,
  memory: 10,
  dare: 20,
  gift: 15,
  timed: 15, // doubled when finished in time
  guess: 15, // to both players on a match
  together: 10, // to both players
};

// The partner rates these with 1–3 hearts instead of a fixed score
const RATED_TYPES = new Set(["love", "memory"]);

/* =========================
   IN-MEMORY STORAGE
========================= */

const rooms = {};

/* =========================
   HELPERS
========================= */

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

function generateRoomId() {
  let id;
  do {
    id = Math.random().toString(36).substring(2, 7).toUpperCase();
  } while (rooms[id]);
  return id;
}

function cleanText(text, max) {
  if (typeof text !== "string") return "";
  return text.trim().slice(0, max);
}

function parseSettings(raw = {}) {
  const mode = raw.mode === "coop" ? "coop" : "competitive";
  let length = LENGTH_OPTIONS[raw.length] ? String(raw.length) : "10";

  // Co-op needs a round limit, otherwise you can never lose
  if (mode === "coop" && LENGTH_OPTIONS[length].target) length = "10";

  const option = LENGTH_OPTIONS[length];
  return {
    mode,
    length,
    rounds: option.rounds ?? null,
    target: option.target ?? null,
    coopGoal: mode === "coop" ? option.rounds * COOP_POINTS_PER_ROUND : null,
  };
}

function createRoom(roomId, settings) {
  return {
    id: roomId,
    phase: "waiting", // waiting | playing | finished
    settings,
    players: [],
    turn: 0,
    rolling: false,
    freeRolls: 0, // extra rolls (from a 6 or a Reroll card) that do not use up a turn
    challenge: null,
    event: null, // latest announcement shown as a toast: { id, playerId, text }
    eventSeq: 0,
    winnerIds: [],
    coopWon: null,
    decks: {},
  };
}

function createPlayer(playerId, username, socketId) {
  return {
    id: playerId,
    socketId,
    username,
    connected: true,
    position: 0,
    score: 0,
    turnsTaken: 0,
    savedDares: [], // dares put off for later: { id, question, points }
    powerUps: [],
    doubleNext: false, // from a wild tile: next challenge points are doubled
    removeTimer: null,
  };
}

function resetGame(room) {
  room.turn = 0;
  room.rolling = false;
  room.freeRolls = 0;
  room.challenge = null;
  room.event = null;
  room.winnerIds = [];
  room.coopWon = null;
  room.decks = {};
  room.players.forEach((p) => {
    p.position = 0;
    p.score = 0;
    p.turnsTaken = 0;
    p.savedDares = [];
    p.powerUps = [];
    p.doubleNext = false;
  });
  room.phase = room.players.length === MAX_PLAYERS ? "playing" : "waiting";
}

// Draw without repeats until the deck runs out, then reshuffle
function drawQuestion(room, type) {
  const list = QUESTIONS[type];
  if (!list) return null;

  if (!room.decks[type] || room.decks[type].length === 0) {
    room.decks[type] = shuffle(list);
  }
  return room.decks[type].pop();
}

const otherPlayer = (room, player) => room.players.find((p) => p.id !== player.id);

function setEvent(room, playerId, text) {
  room.eventSeq += 1;
  room.event = { id: room.eventSeq, playerId, text };
}

// Adds challenge points, applying a pending "double next" bonus
function award(player, points) {
  if (player.doubleNext) {
    points *= 2;
    player.doubleNext = false;
  }
  player.score += points;
}

function makeChallenge(room, type, player) {
  return {
    type,
    question: drawQuestion(room, type),
    points: POINTS[type] || 0,
    ownerId: player.id, // who landed on it
    playerId: player.id, // who has to do it (changes with Pass It On)
    stage: type === "guess" ? "guessing" : "pending", // pending | rating | timing | guessing | reveal
    handedOff: false,
    endsAt: null,
    answer: null,
    guess: null,
    confirmed: {},
  };
}

// Hides the guess-tile answers until both are locked in
function publicChallenge(c) {
  if (!c) return null;
  const revealed = c.stage === "reveal";
  return {
    type: c.type,
    question: c.question,
    points: c.points,
    ownerId: c.ownerId,
    playerId: c.playerId,
    stage: c.stage,
    handedOff: c.handedOff,
    remainingMs: c.endsAt ? Math.max(0, c.endsAt - Date.now()) : null,
    hasAnswer: c.answer !== null,
    hasGuess: c.guess !== null,
    answer: revealed ? c.answer : null,
    guess: revealed ? c.guess : null,
    confirmed: Object.keys(c.confirmed),
  };
}

// Only send what clients need (no socket ids, timers or decks)
function publicState(room) {
  return {
    id: room.id,
    phase: room.phase,
    settings: room.settings,
    board: BOARD,
    turn: room.turn,
    freeRoll: room.freeRolls > 0,
    challenge: publicChallenge(room.challenge),
    event: room.event,
    winnerIds: room.winnerIds,
    coopWon: room.coopWon,
    players: room.players.map((p) => ({
      id: p.id,
      username: p.username,
      connected: p.connected,
      position: p.position,
      score: p.score,
      turnsTaken: p.turnsTaken,
      savedDares: p.savedDares,
      powerUps: p.powerUps,
      doubleNext: p.doubleNext,
    })),
  };
}

function broadcast(room, move = null) {
  io.to(room.id).emit("roomState", { state: publicState(room), move });
}

function finishGame(room) {
  room.challenge = null;
  room.freeRolls = 0;
  room.phase = "finished";

  if (room.settings.mode === "coop") {
    const total = room.players.reduce((sum, p) => sum + p.score, 0);
    room.coopWon = total >= room.settings.coopGoal;
    room.winnerIds = room.coopWon ? room.players.map((p) => p.id) : [];
    return;
  }

  const best = Math.max(...room.players.map((p) => p.score));
  room.winnerIds = room.players.filter((p) => p.score === best).map((p) => p.id);
}

// "First to N points" ends the game as soon as someone gets there
function reachedTarget(room) {
  const { target } = room.settings;
  return target !== null && room.players.some((p) => p.score >= target);
}

function endTurn(room) {
  room.challenge = null;

  if (reachedTarget(room)) return finishGame(room);

  // Bonus roll / reroll: same player goes again
  if (room.freeRolls > 0) return;

  const { rounds } = room.settings;
  if (rounds !== null && room.players.every((p) => p.turnsTaken >= rounds)) {
    return finishGame(room);
  }

  room.turn = (room.turn + 1) % room.players.length;
}

function applyWild(room, player, partner) {
  let effect = pick(["swap", "steal", "back", "double"]);
  if (effect === "swap" && (!partner || partner.position === player.position)) effect = "double";

  switch (effect) {
    case "swap":
      [player.position, partner.position] = [partner.position, player.position];
      return `⚡ Wild! ${player.username} swapped places with ${partner.username}`;

    case "steal": {
      // Nothing to steal from in co-op, so it becomes a plain bonus
      if (room.settings.mode === "coop" || !partner) {
        player.score += WILD_STEAL;
        return `⚡ Wild! Lucky bonus: ${player.username} gets +${WILD_STEAL}`;
      }
      const amount = Math.min(WILD_STEAL, partner.score);
      partner.score -= amount;
      player.score += amount;
      return `⚡ Wild! ${player.username} stole ${amount} points from ${partner.username}`;
    }

    case "back":
      player.position = (player.position - WILD_BACK_STEPS + BOARD.length) % BOARD.length;
      return `⚡ Wild! ${player.username} moves back ${WILD_BACK_STEPS} tiles`;

    default:
      player.doubleNext = true;
      return `⚡ Wild! ${player.username}'s next challenge is worth double`;
  }
}

// Decides what happens on the tile the player just landed on
function landOn(room, player, messages) {
  const partner = otherPlayer(room, player);
  const tile = BOARD[player.position];

  if (partner && partner.position === player.position) {
    room.challenge = makeChallenge(room, "together", player);
    messages.push(`💑 ${player.username} landed on ${partner.username}: together challenge!`);
    return;
  }

  if (tile === "wild") {
    messages.push(applyWild(room, player, partner));
    endTurn(room);
    return;
  }

  if (tile === "start") {
    endTurn(room);
    return;
  }

  room.challenge = makeChallenge(room, tile, player);
}

function findPlayerBySocket(socketId) {
  for (const roomId in rooms) {
    const player = rooms[roomId].players.find((p) => p.socketId === socketId);
    if (player) return { room: rooms[roomId], player };
  }
  return null;
}

function removePlayer(room, playerId) {
  room.players = room.players.filter((p) => p.id !== playerId);

  if (room.players.length === 0) {
    delete rooms[room.id];
    console.log(`🧹 Room deleted: ${room.id}`);
    return;
  }

  // Partner is gone for good → back to the waiting room so someone can join
  resetGame(room);
  broadcast(room);
}

function seatPlayer(socket, room, player) {
  socket.join(room.id);
  socket.data.roomId = room.id;
  socket.data.playerId = player.id;
  socket.emit("joined", { roomId: room.id, playerId: player.id });
}

/* =========================
   SOCKET LOGIC
========================= */

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  // Resolves the room + player for this socket, or reports why it can't
  const getSeat = () => {
    const room = rooms[socket.data.roomId];
    const player = room?.players.find((p) => p.id === socket.data.playerId);
    return room && player ? { room, player } : null;
  };

  const fail = (message) => socket.emit("errorMessage", message);

  /* -------- CREATE ROOM -------- */
  socket.on("createRoom", ({ username, playerId, settings } = {}) => {
    const name = cleanText(username, MAX_NAME_LENGTH);
    if (!name) return fail("Please enter your name");
    if (typeof playerId !== "string" || !playerId) return fail("Missing player id");
    if (getSeat()) return fail("You are already in a room");

    const room = createRoom(generateRoomId(), parseSettings(settings));
    const player = createPlayer(playerId, name, socket.id);
    room.players.push(player);
    rooms[room.id] = room;

    seatPlayer(socket, room, player);
    console.log(`🟢 Room created: ${room.id} by ${name}`, room.settings);
    broadcast(room);
  });

  /* -------- JOIN ROOM -------- */
  socket.on("joinRoom", ({ roomId, username, playerId } = {}) => {
    const name = cleanText(username, MAX_NAME_LENGTH);
    const code = typeof roomId === "string" ? roomId.trim().toUpperCase() : "";
    const room = rooms[code];

    if (!name) return fail("Please enter your name");
    if (typeof playerId !== "string" || !playerId) return fail("Missing player id");
    if (getSeat()) return fail("You are already in a room");
    if (!room) return fail("Room not found");
    if (room.players.some((p) => p.id === playerId)) return fail("You are already in this room");
    if (room.players.length >= MAX_PLAYERS) return fail("Room is full");

    const player = createPlayer(playerId, name, socket.id);
    room.players.push(player);
    seatPlayer(socket, room, player);

    console.log(`🟡 ${name} joined room: ${room.id}`);

    if (room.players.length === MAX_PLAYERS) resetGame(room);
    broadcast(room);
  });

  /* -------- REJOIN (page refresh / network drop) -------- */
  socket.on("rejoinRoom", ({ roomId, playerId } = {}) => {
    const room = rooms[roomId];
    const player = room?.players.find((p) => p.id === playerId);

    if (!player) {
      socket.emit("rejoinFailed");
      return;
    }

    clearTimeout(player.removeTimer);
    player.removeTimer = null;
    player.socketId = socket.id;
    player.connected = true;

    seatPlayer(socket, room, player);
    console.log(`🔁 ${player.username} rejoined room: ${room.id}`);
    broadcast(room);
  });

  /* -------- ROLL DICE -------- */
  socket.on("rollDice", () => {
    const seat = getSeat();
    if (!seat) return;
    const { room, player } = seat;

    if (room.phase !== "playing") return;
    if (room.players[room.turn]?.id !== player.id) return fail("Not your turn");
    if (room.rolling) return; // ignore double clicks while the dice is in the air
    if (room.challenge) return fail("Finish the current challenge first");

    room.rolling = true;
    const isFreeRoll = room.freeRolls > 0;
    if (isFreeRoll) room.freeRolls -= 1;
    const dice = Math.floor(Math.random() * 6) + 1;

    io.to(room.id).emit("diceRolling", { playerId: player.id });

    setTimeout(() => {
      // Room may have been reset/deleted while the dice was rolling
      if (rooms[room.id] !== room || room.phase !== "playing" || !room.players.includes(player)) {
        room.rolling = false;
        return;
      }

      const steps = [];
      let current = player.position;
      for (let i = 0; i < dice; i++) {
        current = (current + 1) % BOARD.length;
        steps.push(current);
      }

      player.position = current;
      if (!isFreeRoll) player.turnsTaken += 1;
      room.rolling = false;

      const messages = [];

      // Passing (or landing on) START: lap bonus + a power-up card
      if (steps.includes(0)) {
        player.score += LAP_BONUS;
        let text = `⭐ ${player.username} passed START: +${LAP_BONUS}`;
        if (player.powerUps.length < MAX_POWER_UPS) {
          const card = pick(POWER_UPS);
          player.powerUps.push(card);
          text += ` and a ${POWER_UP_NAMES[card]} card`;
        }
        messages.push(text);
      }

      if (dice === 6) {
        room.freeRolls += 1;
        messages.push(`🎲 ${player.username} rolled a 6: bonus roll!`);
      }

      landOn(room, player, messages);
      if (messages.length) setEvent(room, player.id, messages.join("  ·  "));

      console.log(`🎲 ${player.username} rolled ${dice} → ${BOARD[player.position]}`);
      broadcast(room, { playerId: player.id, dice, steps });
    }, DICE_DELAY_MS);
  });

  /* -------- CHALLENGE ACTIONS -------- */
  socket.on("challengeAction", ({ action, hearts, text } = {}) => {
    const seat = getSeat();
    if (!seat) return;
    const { room, player } = seat;
    const c = room.challenge;
    if (!c || room.phase !== "playing") return;

    const isDoer = c.playerId === player.id;
    const doer = room.players.find((p) => p.id === c.playerId);
    const partner = otherPlayer(room, doer);

    // Together: both press Done (both score), either can skip
    if (c.type === "together") {
      if (action === "skip") {
        endTurn(room);
      } else if (action === "done") {
        c.confirmed[player.id] = true;
        if (room.players.every((p) => c.confirmed[p.id])) {
          room.players.forEach((p) => award(p, c.points));
          endTurn(room);
        }
      }
      return broadcast(room);
    }

    switch (c.stage) {
      case "guessing": {
        if (action === "skip" && isDoer) {
          endTurn(room);
          break;
        }
        const value = cleanText(text, MAX_ANSWER_LENGTH);
        if (!value) return fail("Type something first");

        if (action === "answer" && isDoer) c.answer = value;
        else if (action === "guess" && !isDoer) c.guess = value;
        else return;

        if (c.answer !== null && c.guess !== null) c.stage = "reveal";
        break;
      }

      case "reveal": {
        // The person the question is about decides if the guess was right
        if (!isDoer) return;
        if (action === "match") {
          award(doer, c.points);
          if (partner) award(partner, c.points);
        } else if (action !== "nomatch") {
          return;
        }
        endTurn(room);
        break;
      }

      case "rating": {
        if (isDoer || action !== "rate") return;
        const count = Math.round(Number(hearts));
        if (!(count >= 1 && count <= 3)) return;
        award(doer, count * HEART_POINTS);
        endTurn(room);
        break;
      }

      case "timing": {
        if (!isDoer) return;
        if (action === "done") {
          const inTime = Date.now() <= c.endsAt + TIMER_GRACE_MS;
          award(doer, inTime ? c.points * 2 : c.points);
        } else if (action !== "skip") {
          return;
        }
        endTurn(room);
        break;
      }

      case "pending": {
        if (!isDoer) return;

        if (action === "done") {
          if (RATED_TYPES.has(c.type)) {
            c.stage = "rating";
            break;
          }
          award(doer, c.points);
        } else if (action === "startTimer" && c.type === "timed") {
          c.stage = "timing";
          c.endsAt = Date.now() + TIMED_DARE_MS;
          break;
        } else if (action === "save") {
          if (c.type !== "dare") return fail("Only dares can be saved for later");
          doer.savedDares.push({
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            question: c.question,
            points: c.points,
          });
        } else if (action !== "skip") {
          return;
        }
        endTurn(room);
        break;
      }
    }

    broadcast(room);
  });

  /* -------- POWER-UP CARDS -------- */
  socket.on("usePowerUp", ({ card } = {}) => {
    const seat = getSeat();
    if (!seat) return;
    const { room, player } = seat;
    const c = room.challenge;

    if (room.phase !== "playing" || !c) return fail("Cards can only be used on a challenge");
    if (c.type === "together" || c.stage !== "pending" && c.stage !== "guessing") return fail("You can't use a card right now");
    if (c.ownerId !== player.id || c.playerId !== player.id) return fail("You can only use cards on your own challenge");
    if (c.stage === "guessing" && (c.answer !== null || c.guess !== null)) return fail("Too late, answers are already in");

    const index = player.powerUps.indexOf(card);
    if (index === -1) return;

    const partner = otherPlayer(room, player);

    if (card === "freePass") {
      award(player, c.points);
      setEvent(room, player.id, `🎟️ ${player.username} used a Free Pass: +${c.points} without doing it`);
      endTurn(room);
    } else if (card === "reroll") {
      room.challenge = null;
      room.freeRolls += 1;
      setEvent(room, player.id, `🎲 ${player.username} used a Reroll and rolls again`);
    } else if (card === "handOff") {
      if (c.type === "guess" || !partner) return fail("Pass It On doesn't work on guess questions");
      c.playerId = partner.id;
      c.handedOff = true;
      setEvent(room, player.id, `😈 ${player.username} passed the challenge to ${partner.username}!`);
    } else {
      return;
    }

    player.powerUps.splice(index, 1);
    broadcast(room);
  });

  /* -------- COMPLETE A SAVED DARE -------- */
  // Can be done any time while the game is running, not just on your turn
  socket.on("completeSavedDare", ({ dareId } = {}) => {
    const seat = getSeat();
    if (!seat) return;
    const { room, player } = seat;

    if (room.phase !== "playing") return fail("Saved dares can only be completed during a game");

    const dare = player.savedDares.find((d) => d.id === dareId);
    if (!dare) return;

    player.savedDares = player.savedDares.filter((d) => d.id !== dareId);
    player.score += dare.points;

    if (reachedTarget(room)) finishGame(room);
    broadcast(room);
  });

  /* -------- REACTIONS -------- */
  socket.on("react", ({ emoji } = {}) => {
    const seat = getSeat();
    if (!seat || !REACTIONS.includes(emoji)) return;

    const now = Date.now();
    if (now - (socket.data.lastReaction || 0) < REACTION_COOLDOWN_MS) return;
    socket.data.lastReaction = now;

    io.to(seat.room.id).emit("reaction", { id: `${now}-${seat.player.id}`, playerId: seat.player.id, emoji });
  });

  /* -------- PLAY AGAIN -------- */
  socket.on("playAgain", () => {
    const seat = getSeat();
    if (!seat || seat.room.phase !== "finished") return;

    resetGame(seat.room);
    broadcast(seat.room);
  });

  /* -------- LEAVE ROOM -------- */
  socket.on("leaveRoom", () => {
    const seat = getSeat();
    if (!seat) return;

    clearTimeout(seat.player.removeTimer);
    socket.leave(seat.room.id);
    socket.data.roomId = null;
    socket.data.playerId = null;
    removePlayer(seat.room, seat.player.id);
  });

  /* -------- DISCONNECT -------- */
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);

    const seat = findPlayerBySocket(socket.id);
    if (!seat) return;
    const { room, player } = seat;

    // Keep the seat for a while so a refresh doesn't end the game
    player.connected = false;
    broadcast(room);

    player.removeTimer = setTimeout(() => {
      if (player.connected) return;
      console.log(`⌛ ${player.username} did not come back to ${room.id}`);
      removePlayer(room, player.id);
    }, RECONNECT_GRACE_MS);
  });
});

/* =========================
   SERVER START
========================= */

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
