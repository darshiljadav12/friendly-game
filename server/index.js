// server.js

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

/* =========================
   GAME CONFIG
========================= */

// Board tile types (loop)
const BOARD = [
  "start",
  "love",
  "dare",
  "memory",
  "gift",
  "love",
  "dare",
  "memory",
  "gift",
  "love",
  "dare",
  "memory",
  "gift",
  "love",
  "dare",
  "memory",
];

// Questions (centralized → sync for both players)
const QUESTIONS = {
  love: ["What do you love most about me?", "Describe our first date ❤️"],
  dare: ["Send a voice note 😈", "Say something romantic"],
  memory: ["Best memory together?", "When did you miss me most?"],
  gift: ["Plan a surprise 🎁", "Send a cute pic"],
};

/* =========================
   IN-MEMORY STORAGE
========================= */

const rooms = {};

/* =========================
   HELPERS
========================= */

function createGameState() {
  return {
    players: [],
    turn: 0,
    positions: {},
    scores: {},
    currentTile: null,
    currentQuestion: null,
  };
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 7);
}

function getRandomQuestion(type) {
  const list = QUESTIONS[type];
  if (!list) return null;

  return list[Math.floor(Math.random() * list.length)];
}

/* =========================
   SOCKET LOGIC
========================= */

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  /* -------- CREATE ROOM -------- */
  socket.on("createRoom", ({ username }) => {
    const roomId = generateRoomId();

    const game = createGameState();

    game.players.push({ id: socket.id, username });
    game.positions[socket.id] = 0;
    game.scores[socket.id] = 0;

    rooms[roomId] = game;

    socket.join(roomId);

    console.log(`🟢 Room created: ${roomId}`);
    console.log(`🟢 Username: ${username}`);

    socket.emit("roomCreated", { roomId });
  });

  /* -------- JOIN ROOM -------- */
  socket.on("joinRoom", ({ roomId, username }) => {
    const room = rooms[roomId];

    if (!room) {
      socket.emit("errorMessage", "Room not found");
      return;
    }

    if (room.players.length >= 2) {
      socket.emit("errorMessage", "Room is full");
      return;
    }

    room.players.push({ id: socket.id, username });
    room.positions[socket.id] = 0;
    room.scores[socket.id] = 0;

    socket.join(roomId);

    console.log(`🟡 Player joined room: ${roomId}`);
    console.log(`🟢 Username: ${username}`);

    io.to(roomId).emit("gameStart", room);
  });

  /* -------- ROLL DICE -------- */
  // socket.on("rollDice", ({ roomId }) => {

  //   const room = rooms[roomId];

  //   if (!room) return;

  //   const currentPlayer = room.players[room.turn];

  //   if (currentPlayer.id !== socket.id) {
  //     socket.emit("errorMessage", "Not your turn");
  //     return;
  //   }

  //   // 🎲 Roll dice
  //   const dice = Math.floor(Math.random() * 6) + 1;

  //   const steps = [];

  //   let current = room.positions[socket.id];

  //   for (let i = 0; i < dice; i++) {
  //     current = (current + 1) % BOARD.length;
  //     steps.push(current);
  //   }

  //   room.positions[socket.id] = current;

  //   const newPosition = room.positions[socket.id];
  //   const tileType = BOARD[newPosition];

  //   // 🎯 Generate SAME question for both users
  //   let question = null;
  //   if (tileType !== "start") {
  //     question = getRandomQuestion(tileType);
  //   }

  //   // 🧠 Save state (important for sync)
  //   room.currentTile = tileType;
  //   room.currentQuestion = question;

  //   // 🧮 Score logic (simple for now)
  //   room.scores[socket.id] += 10;

  //   // 🔄 Next turn
  //   room.turn = (room.turn + 1) % room.players.length;

  //   console.log(`🎲 Dice: ${dice}, Player: ${socket.id}, Tile: ${tileType}`);

  //   // 📡 Emit to BOTH players
  //   io.to(roomId).emit("gameUpdate", {
  //     dice,
  //     room,
  //     steps,
  //     playerId: socket.id, // ✅ ADD THIS
  //     tileType,
  //     question,
  //   });
  // });

  socket.on("rollDice", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const currentPlayer = room.players[room.turn];

    if (currentPlayer.id !== socket.id) {
      socket.emit("errorMessage", "Not your turn");
      return;
    }

    // 🎲 STEP 1: generate dice
    const dice = Math.floor(Math.random() * 6) + 1;

    console.log(`🎲 Dice rolled: ${dice}`);

    // 👉 OPTIONAL: tell both players dice started rolling
    io.to(roomId).emit("diceRolling", {
      playerId: socket.id,
    });

    // ⏳ simulate real dice delay (like Ludo)
    setTimeout(() => {
      // 🧮 calculate steps
      const steps = [];
      let current = room.positions[socket.id];

      for (let i = 0; i < dice; i++) {
        current = (current + 1) % BOARD.length;
        steps.push(current);
      }

      room.positions[socket.id] = current;

      const newPosition = current;
      const tileType = BOARD[newPosition];

      let question = null;
      if (tileType !== "start") {
        question = getRandomQuestion(tileType);
      }

      room.currentTile = tileType;
      room.currentQuestion = question;

      room.scores[socket.id] += 10;
      room.turn = (room.turn + 1) % room.players.length;

      // 🎯 STEP 2: send FINAL dice result
      io.to(roomId).emit("diceRolled", {
        playerId: socket.id,
        dice,
      });

      // 🎯 STEP 3: send game update AFTER dice
      io.to(roomId).emit("gameUpdate", {
        dice,
        room,
        steps,
        playerId: socket.id,
        tileType,
        question,
      });
    }, 700); // matches dice animation time
  });

  /* -------- DISCONNECT -------- */
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);

    // Cleanup rooms
    for (const roomId in rooms) {
      const room = rooms[roomId];

      const isPlayer = room.players.some((player) => player.id === socket.id);

      if (isPlayer) {
        room.players = room.players.filter((p) => p.id !== socket.id);

        delete room.positions[socket.id];
        delete room.scores[socket.id];

        // If room empty → delete
        if (room.players.length === 0) {
          delete rooms[roomId];
          console.log(`🧹 Room deleted: ${roomId}`);
        } else {
          // Reset turn if needed
          room.turn = 0;

          io.to(roomId).emit("playerLeft", room);
        }
      }
    }
  });
});

/* =========================
   SERVER START
========================= */

const PORT = 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
