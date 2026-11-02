// MongoDB persistence.
// Live games still run from memory; every change is written here (debounced)
// so rooms survive a server restart or deploy. Couples, game history and the
// memory book live here too. Without MONGODB_URI everything falls back to
// in-memory maps (lost on restart), so the game still works for local play.

const dns = require("dns");
const { MongoClient } = require("mongodb");

const SAVE_DEBOUNCE_MS = 300;
const ROOM_TTL_SECONDS = 24 * 60 * 60; // inactive rooms are deleted after a day
const FALLBACK_DNS = ["1.1.1.1", "8.8.8.8"];

let client = null;
let col = null; // { rooms, couples, games, memories } when connected
const pending = new Map(); // roomId -> { timer, room }

// In-memory fallback when there is no database
const memory = { users: new Map(), couples: new Map(), games: [], memories: [] };

// Node's own resolver fails SRV lookups on some home routers (querySrv ECONNREFUSED)
// even though the OS resolves fine, so fall back to public DNS for mongodb+srv URIs.
async function ensureSrvResolves(uri) {
  const match = /^mongodb\+srv:\/\/(?:[^@/]+@)?([^/?]+)/.exec(uri);
  if (!match) return;

  try {
    await dns.promises.resolveSrv(`_mongodb._tcp.${match[1]}`);
  } catch (err) {
    console.warn(`⚠️  DNS SRV lookup failed (${err.code}), using public DNS ${FALLBACK_DNS.join(", ")}`);
    dns.setServers(FALLBACK_DNS);
  }
}

async function connect(uri) {
  await ensureSrvResolves(uri);

  client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  await client.connect();

  // Database name comes from the URI path (…mongodb.net/friendly-game)
  const db = client.db(process.env.MONGODB_DB || undefined);
  col = {
    rooms: db.collection("rooms"),
    users: db.collection("users"),
    couples: db.collection("couples"),
    games: db.collection("games"),
    memories: db.collection("memories"),
  };

  await Promise.all([
    col.rooms.createIndex({ updatedAt: 1 }, { expireAfterSeconds: ROOM_TTL_SECONDS }),
    col.games.createIndex({ coupleCode: 1, endedAt: -1 }),
    col.memories.createIndex({ coupleCode: 1, createdAt: -1 }),
  ]);

  console.log(`🍃 MongoDB connected (database: ${db.databaseName})`);
}

const isConnected = () => col !== null;

/* =========================
   ROOMS
========================= */

// Strip runtime-only fields (sockets, timers) before saving
function serialize(room) {
  const { id, rolling, ...rest } = room; // eslint-disable-line no-unused-vars
  return {
    ...rest,
    _id: id,
    players: room.players.map(({ socketId, removeTimer, connected, ...p }) => p), // eslint-disable-line no-unused-vars
    updatedAt: new Date(),
  };
}

// Rebuild an in-memory room; everyone starts disconnected until they rejoin
function deserialize(doc) {
  const { _id, updatedAt, ...rest } = doc; // eslint-disable-line no-unused-vars
  return {
    ...rest,
    id: _id,
    rolling: false, // a roll in flight during the restart is simply dropped
    players: doc.players.map((p) => ({ ...p, socketId: null, connected: false, removeTimer: null })),
  };
}

async function loadRooms() {
  if (!col) return [];
  const docs = await col.rooms.find({}).toArray();
  return docs.map(deserialize);
}

async function writeRoom(room) {
  try {
    await col.rooms.replaceOne({ _id: room.id }, serialize(room), { upsert: true });
  } catch (err) {
    console.error(`❌ Failed to save room ${room.id}:`, err.message);
  }
}

// Coalesces bursts of updates (e.g. several actions in a row) into one write
function saveRoom(room) {
  if (!col) return;

  const existing = pending.get(room.id);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    pending.delete(room.id);
    writeRoom(room);
  }, SAVE_DEBOUNCE_MS);

  pending.set(room.id, { timer, room });
}

async function deleteRoom(roomId) {
  const existing = pending.get(roomId);
  if (existing) {
    clearTimeout(existing.timer);
    pending.delete(roomId);
  }
  if (!col) return;

  try {
    await col.rooms.deleteOne({ _id: roomId });
  } catch (err) {
    console.error(`❌ Failed to delete room ${roomId}:`, err.message);
  }
}

/* =========================
   USERS (accounts)
========================= */

// _id is the lower-cased username, so usernames are unique regardless of case
async function getUser(usernameKey) {
  if (!col) return memory.users.get(usernameKey) ?? null;
  return col.users.findOne({ _id: usernameKey });
}

async function saveUser(user) {
  if (!col) {
    memory.users.set(user._id, user);
    return;
  }
  await col.users.replaceOne({ _id: user._id }, user, { upsert: true });
}

// Only used to refuse a sign-up that would clash; insert-only
async function createUser(user) {
  if (!col) {
    if (memory.users.has(user._id)) return false;
    memory.users.set(user._id, user);
    return true;
  }
  try {
    await col.users.insertOne(user);
    return true;
  } catch (err) {
    if (err.code === 11000) return false; // duplicate username
    throw err;
  }
}

/* =========================
   COUPLES
========================= */

async function getCouple(code) {
  if (!col) return memory.couples.get(code) ?? null;
  return col.couples.findOne({ _id: code });
}

async function saveCouple(couple) {
  if (!col) {
    memory.couples.set(couple._id, couple);
    return;
  }
  await col.couples.replaceOne({ _id: couple._id }, couple, { upsert: true });
}

/* =========================
   GAME HISTORY + MEMORY BOOK
========================= */

async function insertGame(game) {
  if (!col) {
    memory.games.push(game);
    return;
  }
  await col.games.insertOne(game);
}

async function listGames(coupleCode, limit = 30) {
  if (!col) {
    return memory.games
      .filter((g) => g.coupleCode === coupleCode)
      .sort((a, b) => b.endedAt - a.endedAt)
      .slice(0, limit);
  }
  return col.games.find({ coupleCode }).sort({ endedAt: -1 }).limit(limit).toArray();
}

async function insertMemories(items) {
  if (items.length === 0) return;
  if (!col) {
    memory.memories.push(...items);
    return;
  }
  await col.memories.insertMany(items);
}

async function listMemories(coupleCode, limit = 100) {
  if (!col) {
    return memory.memories
      .filter((m) => m.coupleCode === coupleCode)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }
  return col.memories.find({ coupleCode }).sort({ createdAt: -1 }).limit(limit).toArray();
}

async function setMemoryFavorite(coupleCode, memoryId, favorite) {
  if (!col) {
    const item = memory.memories.find((m) => m._id === memoryId && m.coupleCode === coupleCode);
    if (item) item.favorite = favorite;
    return;
  }
  await col.memories.updateOne({ _id: memoryId, coupleCode }, { $set: { favorite } });
}

/* =========================
   SHUTDOWN
========================= */

// Writes anything still waiting in the debounce, then closes the connection
async function close() {
  const waiting = [...pending.values()];
  pending.clear();
  waiting.forEach(({ timer }) => clearTimeout(timer));

  if (col) await Promise.all(waiting.map(({ room }) => writeRoom(room)));
  await client?.close();
}

module.exports = {
  connect,
  isConnected,
  loadRooms,
  saveRoom,
  deleteRoom,
  getUser,
  saveUser,
  createUser,
  getCouple,
  saveCouple,
  insertGame,
  listGames,
  insertMemories,
  listMemories,
  setMemoryFavorite,
  close,
};
