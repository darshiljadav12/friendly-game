// Accounts + couple profiles.
// Each person has their own account (username + password). One creates a couple and
// gets a code like LOVE-7K2Q; the other links to it with that code. Each device that
// logs in gets its own session token (only its hash is stored).

const crypto = require("crypto");
const db = require("./db");
const { lifetimeAchievements } = require("./achievements");
const { MAX_NAME_LENGTH } = require("./config");

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
const MAX_SESSIONS = 20; // devices remembered per account
const MAX_IOU = 50;
const LOGIN_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;
const USERNAME_RE = /^[a-zA-Z0-9_.]{3,20}$/;
const MIN_PASSWORD = 6;
const MAX_PASSWORD = 100;

const failedLogins = new Map(); // username key -> { count, last, until }

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const hashPassword = (password, salt) => crypto.scryptSync(password, salt, 32).toString("hex");
const randomToken = () => crypto.randomBytes(24).toString("hex");
const randomId = () => crypto.randomBytes(8).toString("hex");

const cleanName = (name) => (typeof name === "string" ? name.trim().slice(0, MAX_NAME_LENGTH) : "");
const normalizeCode = (code) => (typeof code === "string" ? code.trim().toUpperCase() : "");
const userKey = (username) => (typeof username === "string" ? username.trim().toLowerCase() : "");

function emptySlotStats() {
  return {
    games: 0,
    wins: 0,
    points: 0,
    bestScore: 0,
    done: 0,
    skipped: 0,
    saved: 0,
    iouDone: 0,
    heartsReceived: 0,
    ratingsReceived: 0,
    threeHearts: 0,
    guessMatches: 0,
    guessRounds: 0,
    timedInTime: 0,
    cardsUsed: 0,
    coinsEarned: 0,
    coinsSpent: 0,
    sixes: 0,
    laps: 0,
    notes: 0,
    minigames: 0,
    byType: {},
  };
}

async function generateCode() {
  for (;;) {
    let suffix = "";
    for (let i = 0; i < 4; i++) suffix += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    const code = `LOVE-${suffix}`;
    if (!(await db.getCouple(code))) return code;
  }
}

// What clients may see about a couple (no usernames of the partner's sessions etc.)
function overview(couple) {
  return {
    code: couple._id,
    members: couple.members.map(({ slot, name }) => ({ slot, name })),
    iou: couple.iou,
    stats: couple.stats,
    achievements: couple.achievements,
    activeRoomId: couple.activeRoomId,
    createdAt: couple.createdAt,
  };
}

// Everything the client needs after signing up / logging in / reopening the app
function accountView(user, couple) {
  return {
    user: { username: user.username, name: user.name, avatar: user.avatar ?? null },
    slot: couple ? user.slot : null,
    overview: couple ? overview(couple) : null,
  };
}

function addSession(user) {
  const token = randomToken();
  user.sessions.push({ hash: sha256(token), at: new Date() });
  user.sessions = user.sessions.slice(-MAX_SESSIONS);
  return { username: user.username, token };
}

async function coupleOf(user) {
  return user.coupleCode ? db.getCouple(user.coupleCode) : null;
}

/* =========================
   ACCOUNTS
========================= */

async function signup({ name, username, password } = {}) {
  const display = cleanName(name);
  if (!display) return { error: "Enter your name" };
  if (typeof username !== "string" || !USERNAME_RE.test(username.trim())) {
    return { error: "Username: 3–20 letters, numbers, dots or underscores" };
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD) return { error: `Password must be at least ${MIN_PASSWORD} characters` };
  if (password.length > MAX_PASSWORD) return { error: "Password is too long" };

  const salt = crypto.randomBytes(16).toString("hex");
  const user = {
    _id: userKey(username),
    username: username.trim(),
    name: display,
    passwordSalt: salt,
    passwordHash: hashPassword(password, salt),
    sessions: [],
    coupleCode: null,
    slot: null,
    createdAt: new Date(),
  };
  const session = addSession(user);

  if (!(await db.createUser(user))) return { error: "That username is taken" };
  console.log(`👤 Account created: ${user.username}`);
  return { session, ...accountView(user, null) };
}

async function login({ username, password } = {}) {
  const key = userKey(username);
  if (!key || typeof password !== "string") return { error: "Enter your username and password" };

  const lock = failedLogins.get(key);
  if (lock && lock.until > Date.now()) {
    const minutes = Math.ceil((lock.until - Date.now()) / 60000);
    return { error: `Too many wrong passwords. Try again in ${minutes} min` };
  }

  const user = await db.getUser(key);
  const ok =
    user &&
    crypto.timingSafeEqual(Buffer.from(hashPassword(password, user.passwordSalt), "hex"), Buffer.from(user.passwordHash, "hex"));

  if (!ok) {
    // Count failures within the lock window; an expired lock or old failures start fresh
    const fresh = !lock || (lock.until && lock.until <= Date.now()) || Date.now() - lock.last > LOCK_MS;
    const count = (fresh ? 0 : lock.count) + 1;
    failedLogins.set(key, { count, last: Date.now(), until: count >= LOGIN_ATTEMPTS ? Date.now() + LOCK_MS : 0 });
    return { error: count >= LOGIN_ATTEMPTS ? "Too many wrong passwords. Locked for 10 min" : "Wrong username or password" };
  }
  failedLogins.delete(key);

  const session = addSession(user);
  await db.saveUser(user);
  return { session, ...accountView(user, await coupleOf(user)) };
}

// session = { username, token } saved on the device
async function authenticate(session) {
  if (!session || typeof session !== "object" || typeof session.token !== "string") return null;
  const user = await db.getUser(userKey(session.username));
  if (!user) return null;

  const hash = sha256(session.token);
  if (!user.sessions.some((s) => s.hash === hash)) return null;

  const couple = await coupleOf(user);
  return { user, couple, slot: couple ? user.slot : null };
}

async function logout(session) {
  const auth = await authenticate(session);
  if (!auth) return;
  const hash = sha256(session.token);
  auth.user.sessions = auth.user.sessions.filter((s) => s.hash !== hash);
  await db.saveUser(auth.user);
}

// Signs the account out everywhere except this session (used when a game moves to a new browser)
async function logoutOthers(session) {
  const auth = await authenticate(session);
  if (!auth) return;
  const hash = sha256(session.token);
  auth.user.sessions = auth.user.sessions.filter((s) => s.hash === hash);
  await db.saveUser(auth.user);
}

// Remembers the board avatar picked in a couple game for that member's next games
async function saveAvatar(code, slot, avatar) {
  const couple = await db.getCouple(code);
  const member = couple?.members.find((m) => m.slot === slot);
  const user = member && (await db.getUser(member.username));
  if (!user) return;
  user.avatar = avatar;
  await db.saveUser(user);
}

/* =========================
   COUPLE LINKING
========================= */

async function createCouple(user) {
  if (user.coupleCode) return { error: "You're already in a couple" };

  const couple = {
    _id: await generateCode(),
    members: [{ slot: 0, name: user.name, username: user._id }],
    createdAt: new Date(),
    iou: [],
    stats: { games: 0, coopGames: 0, coopWins: 0, ties: 0, slots: { 0: emptySlotStats(), 1: emptySlotStats() } },
    achievements: { 0: {}, 1: {} }, // slot -> { achievementId: unlockedAt }
    activeRoomId: null,
  };
  user.coupleCode = couple._id;
  user.slot = 0;

  await db.saveCouple(couple);
  await db.saveUser(user);
  console.log(`💑 Couple created: ${couple._id} by ${user.username}`);
  return { couple, ...accountView(user, couple) };
}

async function joinCouple(user, code) {
  if (user.coupleCode) return { error: "You're already in a couple" };

  const couple = await db.getCouple(normalizeCode(code));
  if (!couple) return { error: "No couple with that code" };
  if (couple.members.length >= 2) return { error: "That couple already has two people" };
  if (couple.members.some((m) => m.username === user._id)) return { error: "You're already in this couple" };

  couple.members.push({ slot: 1, name: user.name, username: user._id });
  user.coupleCode = couple._id;
  user.slot = 1;

  await db.saveCouple(couple);
  await db.saveUser(user);
  console.log(`💞 ${user.username} joined couple ${couple._id}`);
  return { couple, ...accountView(user, couple) };
}

async function setActiveRoom(code, roomId) {
  const couple = await db.getCouple(code);
  if (!couple) return null;
  couple.activeRoomId = roomId;
  await db.saveCouple(couple);
  return couple;
}

async function clearActiveRoom(code, roomId) {
  const couple = await db.getCouple(code);
  if (!couple || couple.activeRoomId !== roomId) return null;
  couple.activeRoomId = null;
  await db.saveCouple(couple);
  return couple;
}

// Adds achievement ids for a slot; returns the ones that are new
function unlock(couple, slot, ids) {
  const owned = couple.achievements[slot];
  const fresh = ids.filter((id) => !owned[id]);
  fresh.forEach((id) => (owned[id] = new Date()));
  return fresh;
}

// Marks a saved dare/gift as done (no points: it's a promise kept outside the game)
async function completeIou(code, slot, iouId) {
  const couple = await db.getCouple(code);
  if (!couple) return { error: "Couple not found" };

  const dare = couple.iou.find((d) => d.id === iouId);
  if (!dare) return { error: "That one is already done" };
  if (dare.ownerSlot !== slot) return { error: "Only the person who owes it can mark it done" };

  couple.iou = couple.iou.filter((d) => d.id !== iouId);
  const stats = couple.stats.slots[slot];
  stats.iouDone += 1;
  const unlocked = unlock(couple, slot, lifetimeAchievements(stats, couple.stats));

  await db.saveCouple(couple);
  return { dare, unlocked, couple };
}

const STAT_KEYS = emptySlotStats();

function mergeTally(stats, tally) {
  for (const [key, value] of Object.entries(tally)) {
    if (key === "byType") {
      for (const [type, n] of Object.entries(value)) stats.byType[type] = (stats.byType[type] || 0) + n;
    } else if (typeof value === "number" && key in STAT_KEYS) {
      stats[key] = (stats[key] || 0) + value; // older couples may not have newer counters yet
    }
  }
}

// Saves a finished couple game: history, memory book, stats, achievements and leftover saves
async function recordGame(room) {
  const couple = await db.getCouple(room.coupleCode);
  if (!couple) return null;

  const gameId = randomId();
  const endedAt = new Date();
  const { mode } = room.settings;
  const tie = mode === "competitive" && room.winnerIds.length > 1;
  const newlyUnlocked = {}; // playerId -> ids

  couple.stats.games += 1;
  if (mode === "coop") {
    couple.stats.coopGames += 1;
    if (room.coopWon) couple.stats.coopWins += 1;
  }
  if (tie) couple.stats.ties += 1;

  for (const player of room.players) {
    if (player.slot !== 0 && player.slot !== 1) continue;
    const stats = couple.stats.slots[player.slot];

    mergeTally(stats, player.tally);
    stats.games += 1;
    stats.points += player.score;
    stats.bestScore = Math.max(stats.bestScore, player.score);
    if (mode === "competitive" && !tie && room.winnerIds.includes(player.id)) stats.wins += 1;

    const earned = room.results?.achievements?.[player.id] ?? [];
    newlyUnlocked[player.id] = [
      ...unlock(couple, player.slot, earned),
      ...unlock(couple, player.slot, lifetimeAchievements(stats, couple.stats)),
    ];

    // Unfinished saved dares/gifts carry over to the IOU wallet
    for (const dare of player.savedDares) {
      couple.iou.push({ type: "dare", ...dare, ownerSlot: player.slot, createdAt: endedAt, gameId });
    }
  }
  couple.iou = couple.iou.slice(-MAX_IOU);

  const slotOf = Object.fromEntries(room.players.map((p) => [p.id, p.slot]));

  await db.insertGame({
    _id: gameId,
    coupleCode: couple._id,
    startedAt: room.startedAt,
    endedAt,
    settings: { mode, length: room.settings.length, board: room.settings.board.preset, theme: room.settings.theme },
    players: room.players.map((p) => ({ slot: p.slot, name: p.username, score: p.score, coins: p.coins, tally: p.tally })),
    winnerSlots: room.winnerIds.map((id) => slotOf[id]),
    coopWon: room.coopWon,
    coopGoal: room.settings.coopGoal,
    log: room.log.map(({ playerId, ...entry }) => ({ ...entry, slot: slotOf[playerId] ?? null })),
  });

  await db.insertMemories(
    room.moments.map((m) => {
      const { playerId, partnerId, ...rest } = m;
      return {
        _id: randomId(),
        coupleCode: couple._id,
        gameId,
        ...rest,
        slot: slotOf[playerId] ?? null,
        partnerSlot: partnerId ? (slotOf[partnerId] ?? null) : null,
        createdAt: new Date(m.at),
        favorite: false,
      };
    }),
  );

  await db.saveCouple(couple);
  console.log(`📚 Game recorded for couple ${couple._id}`);
  return { couple, newlyUnlocked, gameId };
}

module.exports = {
  signup,
  login,
  authenticate,
  logout,
  logoutOthers,
  saveAvatar,
  accountView,
  overview,
  createCouple,
  joinCouple,
  setActiveRoom,
  clearActiveRoom,
  completeIou,
  recordGame,
};
