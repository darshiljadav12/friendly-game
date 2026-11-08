const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// Load server/.env when present (Node 20.12+); real env vars take precedence
try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
  // no .env file: fine, use the environment as-is
}

const C = require("./config");
const db = require("./db");
const game = require("./game");
const couples = require("./couples");
const achievements = require("./achievements");

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));

app.get("/health", (_req, res) => res.json({ ok: true, db: db.isConnected() }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN },
});

/* =========================
   IN-MEMORY ROOMS
========================= */

const rooms = {};

function generateRoomId() {
  let id;
  do {
    id = Math.random().toString(36).substring(2, 7).toUpperCase();
  } while (rooms[id]);
  return id;
}

const coupleChannel = (code) => `couple:${code}`;

function pushCouple(couple) {
  if (couple) io.to(coupleChannel(couple._id)).emit("coupleUpdate", couples.overview(couple));
}

// Saves a finished couple game once, then shows any newly unlocked achievements
async function recordIfFinished(room) {
  if (room.phase !== "finished" || !room.coupleCode || room.recordedGameNo === room.gameNo) return;
  room.recordedGameNo = room.gameNo;

  try {
    const result = await couples.recordGame(room);
    if (!result) return;
    if (room.results) room.results.newlyUnlocked = result.newlyUnlocked;
    broadcast(room);
    pushCouple(result.couple);
  } catch (err) {
    console.error(`❌ Failed to record game for ${room.coupleCode}:`, err.message);
  }
}

// Every state change goes through here, so it's also where rooms get persisted
function broadcast(room, move = null) {
  io.to(room.id).emit("roomState", { state: game.publicState(room), move });
  db.saveRoom(room);
}

function commit(room, move = null) {
  broadcast(room, move);
  recordIfFinished(room);
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
  if (room.creatorId === playerId) room.creatorId = room.players[0]?.id ?? null; // the one who stays takes over

  if (room.players.length === 0) {
    delete rooms[room.id];
    db.deleteRoom(room.id);
    if (room.coupleCode) couples.clearActiveRoom(room.coupleCode, room.id).then(pushCouple).catch(() => {});
    console.log(`🧹 Room deleted: ${room.id}`);
    return;
  }

  // Partner is gone for good → back to the waiting room so someone can join
  game.resetGame(room);
  broadcast(room);
}

// Keep the seat for a while so a refresh (or server restart) doesn't end the game
function scheduleRemoval(room, player) {
  clearTimeout(player.removeTimer);
  player.removeTimer = setTimeout(() => {
    if (player.connected) return;
    console.log(`⌛ ${player.username} did not come back to ${room.id}`);
    removePlayer(room, player.id);
  }, C.RECONNECT_GRACE_MS);
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

  // Rule constants the client shows in the UI (shop prices, achievements…)
  socket.emit("meta", {
    achievements: achievements.definitions(),
    powerUps: C.POWER_UPS,
    boardPresets: Object.keys(C.BOARD_PRESETS),
    themes: C.THEMES,
    avatars: C.AVATARS,
    avatarGroups: C.AVATAR_GROUPS,
    persistent: db.isConnected(),
  });

  // Resolves the room + player for this socket, or reports why it can't
  const getSeat = () => {
    const room = rooms[socket.data.roomId];
    const player = room?.players.find((p) => p.id === socket.data.playerId);
    return room && player ? { room, player } : null;
  };

  const fail = (message) => message && socket.emit("errorMessage", message);
  const reply = (ack, payload) => typeof ack === "function" && ack(payload);

  // Checks the account session sent with a request; resolves only when the user is in a couple
  const authCouple = async (session) => {
    const auth = await couples.authenticate(session);
    return auth && auth.couple ? { couple: auth.couple, slot: auth.slot, user: auth.user } : null;
  };

  // Live couple updates (partner joined, IOU done, game saved…) go to this channel
  const followCouple = (couple, slot) => {
    if (socket.data.couple?.code && socket.data.couple.code !== couple._id) socket.leave(coupleChannel(socket.data.couple.code));
    socket.join(coupleChannel(couple._id));
    socket.data.couple = { code: couple._id, slot };
  };

  const guarded = (handler, failure) => async (payload, ack) => {
    try {
      reply(ack, await handler(payload ?? {}));
    } catch (err) {
      console.error(err);
      reply(ack, { error: failure });
    }
  };

  /* -------- ACCOUNTS -------- */
  socket.on("accountSignup", guarded((payload) => couples.signup(payload), "Couldn't sign up, try again"));

  socket.on(
    "accountLogin",
    guarded(async (payload) => {
      const result = await couples.login(payload);
      if (result.overview) followCouple({ _id: result.overview.code }, result.slot);
      return result;
    }, "Couldn't log in, try again"),
  );

  // Called on page load with the saved session
  socket.on(
    "accountAuth",
    guarded(async (session) => {
      const auth = await couples.authenticate(session);
      if (!auth) return { error: "Session expired, please log in again" };

      if (auth.couple) {
        followCouple(auth.couple, auth.slot);
        // Drop a stale active room (e.g. after it expired)
        if (auth.couple.activeRoomId && !rooms[auth.couple.activeRoomId]) {
          await couples.clearActiveRoom(auth.couple._id, auth.couple.activeRoomId);
          auth.couple.activeRoomId = null;
        }
      }
      return couples.accountView(auth.user, auth.couple);
    }, "Couldn't check your login"),
  );

  socket.on("accountLogout", async (session) => {
    if (socket.data.couple) socket.leave(coupleChannel(socket.data.couple.code));
    socket.data.couple = null;
    await couples.logout(session).catch(() => {});
  });

  /* -------- COUPLE LINKING -------- */
  socket.on(
    "coupleCreate",
    guarded(async (session) => {
      const auth = await couples.authenticate(session);
      if (!auth) return { error: "Session expired, please log in again" };
      const result = await couples.createCouple(auth.user);
      if (result.error) return result;
      followCouple(result.couple, result.slot);
      const { couple, ...view } = result; // eslint-disable-line no-unused-vars
      return view;
    }, "Couldn't create the couple, try again"),
  );

  socket.on(
    "coupleJoin",
    guarded(async ({ session, code }) => {
      const auth = await couples.authenticate(session);
      if (!auth) return { error: "Session expired, please log in again" };
      const result = await couples.joinCouple(auth.user, code);
      if (result.error) return result;
      followCouple(result.couple, result.slot);
      pushCouple(result.couple); // the partner sees them arrive
      const { couple, ...view } = result; // eslint-disable-line no-unused-vars
      return view;
    }, "Couldn't join the couple, try again"),
  );

  socket.on("coupleHistory", async (session, ack) => {
    const auth = await authCouple(session).catch(() => null);
    if (!auth) return reply(ack, { error: "Session expired, please log in again" });
    reply(ack, { games: await db.listGames(auth.couple._id) });
  });

  socket.on("coupleMemories", async (session, ack) => {
    const auth = await authCouple(session).catch(() => null);
    if (!auth) return reply(ack, { error: "Session expired, please log in again" });
    reply(ack, { memories: await db.listMemories(auth.couple._id) });
  });

  socket.on("coupleFavorite", async ({ session, memoryId, favorite } = {}, ack) => {
    const auth = await authCouple(session).catch(() => null);
    if (!auth) return reply(ack, { error: "Session expired, please log in again" });
    await db.setMemoryFavorite(auth.couple._id, String(memoryId), Boolean(favorite));
    reply(ack, { ok: true });
  });

  socket.on("coupleCompleteIou", async ({ session, iouId } = {}, ack) => {
    const auth = await authCouple(session).catch(() => null);
    if (!auth) return reply(ack, { error: "Session expired, please log in again" });

    const result = await couples.completeIou(auth.couple._id, auth.slot, iouId);
    if (result.error) return reply(ack, { error: result.error });

    // Show it in the activity feed of a game they're playing right now
    const seat = getSeat();
    if (seat && seat.room.coupleCode === auth.couple._id) {
      game.addLog(seat.room, seat.player.id, "💌", `${seat.player.username} kept a promise from the IOU wallet`, result.dare.question);
      broadcast(seat.room);
    }

    pushCouple(result.couple);
    if (result.unlocked.length) {
      io.to(coupleChannel(auth.couple._id)).emit("achievementsUnlocked", { slot: auth.slot, ids: result.unlocked });
    }
    reply(ack, { ok: true });
  });

  /* -------- CREATE ROOM -------- */
  socket.on("createRoom", async ({ username, playerId, settings, couple, avatar } = {}) => {
    if (typeof playerId !== "string" || !playerId) return fail("Missing player id");
    if (getSeat()) return fail("You are already in a room");

    let name = game.cleanText(username, C.MAX_NAME_LENGTH);
    let coupleCode = null;
    let slot = null;

    if (couple) {
      const auth = await authCouple(couple).catch(() => null);
      if (!auth) return fail("Session expired, please log in again");
      if (auth.couple.members.length < 2) return fail("Your partner hasn't joined your couple yet. Share your couple code with them");
      coupleCode = auth.couple._id;
      slot = auth.slot;
      name = auth.couple.members[slot].name;
      avatar = auth.user.avatar ?? avatar; // couple accounts remember their pick
    }
    if (!name) return fail("Please enter your name");

    const room = game.createRoom(generateRoomId(), game.parseSettings(settings), coupleCode);
    const player = game.createPlayer(playerId, name, socket.id, slot, game.pickAvatar(room, avatar));
    room.creatorId = player.id;
    room.players.push(player);
    rooms[room.id] = room;

    seatPlayer(socket, room, player);
    console.log(`🟢 Room created: ${room.id} by ${name}${coupleCode ? ` (couple ${coupleCode})` : ""}`);
    broadcast(room);

    if (coupleCode) pushCouple(await couples.setActiveRoom(coupleCode, room.id));
  });

  /* -------- JOIN ROOM -------- */
  socket.on("joinRoom", async ({ roomId, username, playerId, couple, avatar } = {}) => {
    const code = typeof roomId === "string" ? roomId.trim().toUpperCase() : "";
    const room = rooms[code];

    if (typeof playerId !== "string" || !playerId) return fail("Missing player id");
    if (getSeat()) return fail("You are already in a room");
    if (!room) return fail("Room not found");
    // (couple rooms check the account instead, and a seat can move between browsers)
    if (!room.coupleCode && room.players.some((p) => p.id === playerId)) return fail("You are already in this room");
    if (!room.coupleCode && room.players.length >= C.MAX_PLAYERS) return fail("Room is full");

    let name = game.cleanText(username, C.MAX_NAME_LENGTH);
    let slot = null;

    // Couple rooms are private: only the other half of that couple can join
    if (room.coupleCode) {
      const auth = await authCouple(couple).catch(() => null);
      if (!auth || auth.couple._id !== room.coupleCode) {
        return fail("This is a private couple game. Log in to an account in that couple to join");
      }
      // Already seated from another browser: the game moves here and that browser is signed out
      const seated = room.players.find((p) => p.slot === auth.slot);
      if (seated) return takeOverSeat(room, seated, couple);
      slot = auth.slot;
      name = auth.couple.members[slot].name;
      avatar = auth.user.avatar ?? avatar;
    }
    if (!name) return fail("Please enter your name");
    if (!rooms[code] || room.players.length >= C.MAX_PLAYERS) return fail("Room is full");
    if (room.players.some((p) => p.id === playerId)) return fail("You are already in this room");

    const player = game.createPlayer(playerId, name, socket.id, slot, game.pickAvatar(room, avatar));
    room.players.push(player);
    seatPlayer(socket, room, player);

    console.log(`🟡 ${name} joined room: ${room.id}`);

    if (room.players.length === C.MAX_PLAYERS) game.resetGame(room);
    broadcast(room);
  });

  // Moves a couple seat from the browser that had it to this one
  const takeOverSeat = async (room, player, session) => {
    const previous = player.socketId !== socket.id ? io.sockets.sockets.get(player.socketId) : null;
    if (previous) {
      previous.leave(room.id);
      if (previous.data.couple) previous.leave(coupleChannel(previous.data.couple.code));
      previous.data.roomId = null;
      previous.data.playerId = null;
      previous.data.couple = null;
      previous.emit("seatMoved");
    }
    await couples.logoutOthers(session).catch(() => {});

    clearTimeout(player.removeTimer);
    player.removeTimer = null;
    player.socketId = socket.id;
    player.connected = true;

    seatPlayer(socket, room, player);
    console.log(`📲 ${player.username} moved to another browser in room: ${room.id}`);
    broadcast(room);
  };

  /* -------- REJOIN (page refresh / network drop / server restart) -------- */
  socket.on("rejoinRoom", async ({ roomId, playerId, couple } = {}) => {
    const room = rooms[roomId];
    const player = room?.players.find((p) => p.id === playerId);

    // In couple games the account must still be logged in here (it's signed out when the game moves to another browser)
    const allowed = player && (!room.coupleCode || (await authCouple(couple).catch(() => null))?.slot === player.slot);
    if (!allowed || getSeat()) {
      if (!allowed) socket.emit("rejoinFailed");
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
    player.shopOpen = false; // your next roll closes your shop
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

      room.rolling = false;
      const move = game.resolveRoll(room, player, dice, isFreeRoll);
      console.log(`🎲 ${player.username} rolled ${dice} → ${room.board[player.position]}`);
      commit(room, move);
    }, C.DICE_DELAY_MS);
  });

  /* -------- CHALLENGE ACTIONS -------- */
  socket.on("challengeAction", (payload = {}) => {
    const seat = getSeat();
    if (!seat) return;

    const error = game.challengeAction(seat.room, seat.player, payload);
    if (error === null) commit(seat.room);
    else fail(error);
  });

  /* -------- AVATAR (board piece) -------- */
  socket.on("setAvatar", ({ avatar } = {}) => {
    const seat = getSeat();
    if (!seat) return;
    const error = game.setAvatar(seat.room, seat.player, avatar);
    if (error) return fail(error);
    broadcast(seat.room);
    if (seat.room.coupleCode) couples.saveAvatar(seat.room.coupleCode, seat.player.slot, avatar).catch(() => {});
  });

  /* -------- DRAW IT (mini-game) -------- */
  // Strokes go straight to the partner instead of a full state broadcast, so drawing feels live
  socket.on("drawStroke", (stroke) => {
    const seat = getSeat();
    if (!seat) return;
    const saved = game.addStroke(seat.room, seat.player, stroke);
    if (saved) socket.to(seat.room.id).emit("drawStroke", saved);
  });

  socket.on("drawClear", () => {
    const seat = getSeat();
    if (seat && game.clearDrawing(seat.room, seat.player)) socket.to(seat.room.id).emit("drawClear");
  });

  // Strokes so far (after a refresh) and the secret word for the drawer
  socket.on("drawSync", (_payload, ack) => {
    const seat = getSeat();
    reply(ack, seat ? game.drawingState(seat.room, seat.player) : { strokes: [], word: null });
  });

  /* -------- POWER-UP CARDS + SHOP -------- */
  socket.on("usePowerUp", ({ card, target } = {}) => {
    const seat = getSeat();
    if (!seat) return;

    const result = game.usePowerUp(seat.room, seat.player, card, target);
    if (result.error) return fail(result.error);
    commit(seat.room, result.move ?? null);
  });

  socket.on("buyCard", ({ card } = {}) => {
    const seat = getSeat();
    if (!seat) return;

    const error = game.buyCard(seat.room, seat.player, card);
    if (error) return fail(error);
    broadcast(seat.room);
  });

  /* -------- THEME / ACCESSIBILITY (room creator only) -------- */
  socket.on("updateLook", (payload = {}) => {
    const seat = getSeat();
    if (!seat) return;

    const error = game.updateLook(seat.room, seat.player, payload);
    if (error) return fail(error);
    broadcast(seat.room);
  });

  /* -------- COMPLETE A SAVED DARE / GIFT (this game) -------- */
  socket.on("completeSavedDare", ({ dareId } = {}) => {
    const seat = getSeat();
    if (!seat) return;

    const error = game.completeSavedDare(seat.room, seat.player, dareId);
    if (error === null) commit(seat.room);
    else fail(error);
  });

  /* -------- REACTIONS -------- */
  socket.on("react", ({ emoji } = {}) => {
    const seat = getSeat();
    if (!seat || !C.REACTIONS.includes(emoji)) return;

    const now = Date.now();
    if (now - (socket.data.lastReaction || 0) < C.REACTION_COOLDOWN_MS) return;
    socket.data.lastReaction = now;

    io.to(seat.room.id).emit("reaction", { id: `${now}-${seat.player.id}`, playerId: seat.player.id, emoji });
  });

  /* -------- PLAY AGAIN -------- */
  socket.on("playAgain", () => {
    const seat = getSeat();
    if (!seat || seat.room.phase !== "finished") return;

    game.resetGame(seat.room);
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

    player.connected = false;
    broadcast(room);
    scheduleRemoval(room, player);
  });
});

/* =========================
   SERVER START
========================= */

async function start() {
  const uri = process.env.MONGODB_URI;

  if (uri) {
    try {
      await db.connect(uri);

      // Bring back saved rooms; players get the usual grace period to reconnect
      for (const saved of await db.loadRooms()) {
        const room = game.normalizeRoom(saved);
        rooms[room.id] = room;
        room.players.forEach((p) => scheduleRemoval(room, p));
      }
      console.log(`📦 Restored ${Object.keys(rooms).length} room(s)`);
    } catch (err) {
      console.error("❌ MongoDB connection failed, running WITHOUT persistence:", err.message);
    }
  } else {
    console.warn("⚠️  MONGODB_URI not set, rooms and couples are kept in memory only");
  }

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

// Flush pending saves before exiting (Ctrl+C, nodemon restart, deploy)
async function shutdown(signal) {
  console.log(`\n${signal} received, saving rooms…`);
  await db.close().catch(() => {});
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();
