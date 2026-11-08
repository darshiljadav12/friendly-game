// Game rules. Everything here works on a plain room object; index.js wires it to sockets.

const C = require("./config");
const QUESTIONS = require("./questions");
const MINI = require("./minigames");
const { gameAchievements } = require("./achievements");

const TILE_LABEL = {
  start: "⭐ START",
  love: "❤️ Love",
  memory: "📸 Memory",
  dare: "😈 Dare",
  gift: "🎁 Gift",
  guess: "🤔 Guess",
  timed: "⏱️ Timed",
  play: "🎮 Play",
  wild: "⚡ Wild",
  together: "💑 Together",
};

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
const randomId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function cleanText(text, max) {
  if (typeof text !== "string") return "";
  return text.trim().slice(0, max);
}

const otherPlayer = (room, player) => room.players.find((p) => p.id !== player.id);
const cardName = (card) => `${C.POWER_UPS[card].icon} ${C.POWER_UPS[card].name}`;

/* =========================
   SETTINGS + BOARD
========================= */

function parseBoard(raw = {}) {
  const preset = Object.hasOwn(C.BOARD_PRESETS, raw.preset) ? raw.preset : "classic";
  if (preset !== "custom") return { preset, weights: null };

  const weights = {};
  for (const type of C.TILE_TYPES) {
    const n = Math.round(Number(raw.weights?.[type]));
    weights[type] = Number.isFinite(n) ? Math.min(C.MAX_TILE_WEIGHT, Math.max(0, n)) : 0;
  }
  // An all-zero mix can't make a board
  if (Object.values(weights).every((w) => w === 0)) return { preset: "classic", weights: null };
  return { preset, weights };
}

// `custom` is the couple's admin setup (see couples.validateCustom); it allows the "ours" board
function parseSettings(raw = {}, custom = null) {
  const mode = raw.mode === "coop" ? "coop" : "competitive";
  let length = Object.hasOwn(C.LENGTH_OPTIONS, raw.length) ? String(raw.length) : "10";

  // Co-op needs a round limit, otherwise you can never lose
  if (mode === "coop" && C.LENGTH_OPTIONS[length].target) length = "10";

  const option = C.LENGTH_OPTIONS[length];
  const a11y = Object.fromEntries(C.A11Y_KEYS.map((key) => [key, raw.a11y?.[key] === true]));

  return {
    mode,
    length,
    rounds: option.rounds ?? null,
    target: option.target ?? null,
    coopGoal: mode === "coop" ? option.rounds * C.COOP_POINTS_PER_ROUND : null,
    board: raw.board?.preset === "ours" && custom?.counts ? { preset: "ours", weights: null, counts: custom.counts } : parseBoard(raw.board),
    theme: C.THEMES.includes(raw.theme) ? raw.theme : "warm",
    a11y,
  };
}

// 27 playable tiles after START, in the proportions of the chosen preset
function generateBoard({ preset, weights, counts }) {
  const count = C.BOARD_SIZE - 1;

  if (preset === "classic") {
    return ["start", ...Array.from({ length: count }, (_, i) => C.CLASSIC_PATTERN[i % C.CLASSIC_PATTERN.length])];
  }

  // The couple's own board: exactly these many tiles of each type
  if (preset === "ours" && counts) {
    return ["start", ...spreadOut(shuffle(Object.entries(counts).flatMap(([type, n]) => Array(n).fill(type))))];
  }

  const mix = preset === "custom" ? weights : C.BOARD_PRESETS[preset];
  const entries = Object.entries(mix).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);

  // Largest-remainder rounding so the counts add up to exactly 27
  const exact = entries.map(([type, w]) => ({ type, value: (w / total) * count }));
  const amounts = exact.map((e) => ({ type: e.type, n: Math.floor(e.value), rest: e.value % 1 }));
  let missing = count - amounts.reduce((sum, c) => sum + c.n, 0);
  [...amounts].sort((a, b) => b.rest - a.rest).forEach((c) => {
    if (missing-- > 0) c.n += 1;
  });

  return ["start", ...spreadOut(shuffle(amounts.flatMap((c) => Array(c.n).fill(c.type))))];
}

// Spread tiles out a little so the same type isn't bunched together
function spreadOut(tiles) {
  for (let i = 1; i < tiles.length; i++) {
    if (tiles[i] !== tiles[i - 1]) continue;
    const j = tiles.findIndex((t, k) => k > i && t !== tiles[i - 1] && tiles[k - 1] !== tiles[i]);
    if (j !== -1) [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

/* =========================
   ROOM + PLAYER
========================= */

function emptyTally() {
  return {
    done: 0,
    skipped: 0,
    saved: 0,
    byType: {},
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
  };
}

// `content` = the couple's own questions and allowed mini-games ({ questions, miniGames }), or null
function createRoom(roomId, settings, coupleCode = null, content = null) {
  return {
    id: roomId,
    content,
    phase: "waiting", // waiting | playing | finished
    settings,
    board: generateBoard(settings.board),
    coupleCode, // set when both players play as a saved couple
    creatorId: null, // only the creator may change the theme / accessibility mid-game
    players: [],
    turn: 0,
    rolling: false,
    freeRolls: 0, // extra rolls (from a 6 or a Reroll card) that do not use up a turn
    challenge: null,
    event: null, // latest announcement shown as a toast: { id, playerId, text }
    eventSeq: 0,
    log: [], // activity feed: { id, at, playerId, icon, text, detail }
    logSeq: 0,
    moments: [], // memory-book entries collected during the game
    winnerIds: [],
    coopWon: null,
    results: null, // achievements etc. once finished
    decks: {},
    gameNo: 0,
    recordedGameNo: 0,
    startedAt: null,
  };
}

function createPlayer(playerId, username, socketId, slot = null, avatar = null) {
  return {
    id: playerId,
    socketId,
    username,
    avatar, // board piece emoji, see pickAvatar
    slot, // 0 or 1 when playing as a couple
    connected: true,
    position: 0,
    score: 0,
    coins: 0,
    shopOpen: false, // after passing START, until this player rolls again
    turnsTaken: 0,
    savedDares: [], // dares put off for later: { id, question, points }
    powerUps: [],
    doubleNext: false, // from a wild tile: next challenge points are doubled
    tally: emptyTally(),
    removeTimer: null,
  };
}

function addLog(room, playerId, icon, text, detail = null) {
  room.logSeq += 1;
  room.log.push({ id: room.logSeq, at: Date.now(), playerId, icon, text, detail });
  if (room.log.length > C.LOG_LIMIT) room.log.splice(0, room.log.length - C.LOG_LIMIT);
}

function setEvent(room, playerId, text) {
  room.eventSeq += 1;
  room.event = { id: room.eventSeq, playerId, text };
}

function resetGame(room) {
  room.turn = 0;
  room.rolling = false;
  room.freeRolls = 0;
  room.challenge = null;
  room.event = null;
  room.log = [];
  room.moments = [];
  room.winnerIds = [];
  room.coopWon = null;
  room.results = null;
  room.decks = {};
  room.board = generateBoard(room.settings.board);
  room.players.forEach((p) => {
    p.position = 0;
    p.score = 0;
    p.coins = 0;
    p.shopOpen = false;
    p.turnsTaken = 0;
    p.savedDares = [];
    p.powerUps = [];
    p.doubleNext = false;
    p.tally = emptyTally();
  });
  room.phase = room.players.length === C.MAX_PLAYERS ? "playing" : "waiting";

  if (room.phase === "playing") {
    room.gameNo += 1;
    room.startedAt = new Date();
    addLog(room, null, "🏁", `Game started: ${room.players.map((p) => p.username).join(" vs ")}`);
  }
}

// Older saved rooms may miss newer fields
function normalizeRoom(room) {
  const fresh = createRoom(room.id, parseSettings(room.settings), room.coupleCode ?? null);
  const merged = { ...fresh, ...room, settings: { ...fresh.settings, ...room.settings } };
  merged.board = room.board ?? fresh.board;
  merged.creatorId = room.creatorId ?? room.players[0]?.id ?? null;
  merged.players = room.players.map((p) => ({ ...createPlayer(p.id, p.username, null, p.slot ?? null), ...p }));
  for (const p of merged.players) if (!p.avatar) p.avatar = pickAvatar(merged, null, p); // rooms saved before avatars
  return merged;
}

// Draw without repeats until the deck runs out, then reshuffle
function drawFrom(room, key, list) {
  if (!room.decks[key] || room.decks[key].length === 0) {
    room.decks[key] = shuffle(list);
  }
  return room.decks[key].pop();
}

// The couple's own list replaces the built-in one when they uploaded one
function questionList(room, key, builtIn) {
  const own = room.content?.questions?.[key];
  return own?.length ? own : builtIn;
}

function drawQuestion(room, type) {
  const list = questionList(room, type, QUESTIONS[type]);
  return list ? drawFrom(room, type, list) : null;
}

// The wanted avatar if it's valid and free, otherwise the first free one (🐻, then 🐰, …)
function pickAvatar(room, wanted, player = null) {
  const taken = new Set(room.players.filter((p) => p !== player).map((p) => p.avatar));
  if (C.AVATARS.includes(wanted) && !taken.has(wanted)) return wanted;
  return C.AVATARS.find((a) => !taken.has(a));
}

// Returns an error message, or null when changed
function setAvatar(room, player, avatar) {
  if (!C.AVATARS.includes(avatar)) return "Pick one of the avatars";
  const other = room.players.find((p) => p !== player && p.avatar === avatar);
  if (other) return `${other.username} already has ${avatar}`;
  player.avatar = avatar;
  return null;
}

/* =========================
   SCORING
========================= */

function earnCoins(player, amount) {
  player.coins += amount;
  player.tally.coinsEarned += amount;
}

// Adds challenge points (doubled by a pending Wild bonus) plus coins; returns points given
function award(player, points, { coins = true } = {}) {
  if (player.doubleNext && points > 0) {
    points *= 2;
    player.doubleNext = false;
  }
  player.score += points;
  if (coins && points > 0) earnCoins(player, C.COINS_PER_CHALLENGE);
  return points;
}

function countDone(player, type) {
  player.tally.done += 1;
  player.tally.byType[type] = (player.tally.byType[type] || 0) + 1;
}

function addMoment(room, moment) {
  room.moments.push({ at: Date.now(), ...moment });
}

/* =========================
   STATE FOR CLIENTS
========================= */

// 🎮 PLAY: a random mini-game, never the same one twice in a row
function pickMiniGame(room) {
  const allowed = room.content?.miniGames?.length ? room.content.miniGames : Object.keys(C.MINI_GAMES);
  const options = allowed.length > 1 ? allowed.filter((g) => g !== room.lastMiniGame) : allowed;
  room.lastMiniGame = pick(options);
  return room.lastMiniGame;
}

// Cards talk to the player whose turn it is ("you"); {partner} becomes the other player's name
const fillPartner = (text, partnerName) => (typeof text === "string" ? text.replace(/\{partner\}/gi, partnerName || "your partner") : text);

function makeChallenge(room, type, player) {
  const mini = type === "play" ? { game: pickMiniGame(room), prompt: null, items: null, picks: {}, word: null, strokes: [], guesses: [], result: null } : null;
  const template = mini ? `${C.MINI_GAMES[mini.game].icon} ${C.MINI_GAMES[mini.game].title}` : drawQuestion(room, type);
  return {
    type,
    template, // the question before {partner} is filled in (Pass It On fills it again for the new player)
    question: fillPartner(template, otherPlayer(room, player)?.username),
    mini,
    points: C.POINTS[type] || 0,
    ownerId: player.id, // who landed on it
    playerId: player.id, // who has to do it (changes with Pass It On)
    stage: type === "guess" ? "guessing" : "pending", // pending | rating | timing | guessing | reveal
    handedOff: false,
    mirror: false, // Mirror card: partner earns the same points
    cardUsed: false, // one card per challenge
    endsAt: null,
    answer: null,
    guess: null,
    note: null, // optional memory-book note typed on Done
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
    mirror: c.mirror,
    cardUsed: c.cardUsed,
    remainingMs: c.endsAt ? Math.max(0, c.endsAt - Date.now()) : null,
    hasAnswer: c.answer !== null,
    hasGuess: c.guess !== null,
    answer: revealed || c.mini ? c.answer : null, // Finish My Sentence: shown for the rating
    guess: revealed ? c.guess : null,
    confirmed: Object.keys(c.confirmed),
    mini: c.mini && publicMini(c),
  };
}

// Secret picks and the Draw It word stay hidden until the results
function publicMini(c) {
  const m = c.mini;
  const results = c.stage === "results";
  return {
    game: m.game,
    prompt: m.prompt,
    items: m.items,
    picked: Object.keys(m.picks),
    picks: results ? m.picks : null,
    guesses: m.guesses,
    word: results ? m.word : null,
    result: m.result,
  };
}

// Only send what clients need (no socket ids, timers or decks)
function publicState(room) {
  return {
    id: room.id,
    phase: room.phase,
    settings: room.settings,
    board: room.board,
    isCouple: Boolean(room.coupleCode),
    creatorId: room.creatorId,
    turn: room.turn,
    freeRoll: room.freeRolls > 0,
    challenge: publicChallenge(room.challenge),
    event: room.event,
    log: room.log.slice(-C.LOG_PUBLIC),
    winnerIds: room.winnerIds,
    coopWon: room.coopWon,
    results: room.results,
    players: room.players.map((p) => ({
      id: p.id,
      username: p.username,
      avatar: p.avatar,
      slot: p.slot,
      connected: p.connected,
      position: p.position,
      score: p.score,
      coins: p.coins,
      shopOpen: p.shopOpen,
      turnsTaken: p.turnsTaken,
      savedDares: p.savedDares,
      powerUps: p.powerUps,
      doubleNext: p.doubleNext,
      tally: p.tally,
    })),
  };
}

/* =========================
   TURN FLOW
========================= */

function finishGame(room) {
  room.challenge = null;
  room.freeRolls = 0;
  room.players.forEach((p) => (p.shopOpen = false));
  room.phase = "finished";

  const { mode } = room.settings;
  if (mode === "coop") {
    const total = room.players.reduce((sum, p) => sum + p.score, 0);
    room.coopWon = total >= room.settings.coopGoal;
    room.winnerIds = room.coopWon ? room.players.map((p) => p.id) : [];
    addLog(room, null, "🏁", room.coopWon ? `Game over: love meter filled (${total}/${room.settings.coopGoal})!` : `Game over: ${total}/${room.settings.coopGoal}, so close`);
  } else {
    const best = Math.max(...room.players.map((p) => p.score));
    room.winnerIds = room.players.filter((p) => p.score === best).map((p) => p.id);
    const names = room.players.filter((p) => room.winnerIds.includes(p.id)).map((p) => p.username);
    addLog(room, null, "🏁", names.length > 1 ? `Game over: it's a tie at ${best}!` : `Game over: ${names[0]} wins with ${best}!`);
  }

  const tie = mode === "competitive" && room.winnerIds.length > 1;
  room.results = {
    achievements: Object.fromEntries(
      room.players.map((p) => [
        p.id,
        gameAchievements(p.tally, { mode, won: room.winnerIds.includes(p.id), tie, coopWon: room.coopWon, score: p.score }),
      ]),
    ),
    newlyUnlocked: null, // filled in for couple games once saved
  };
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

// Shield is used up automatically when the partner's Wild or Pass It On would hit you
function useShield(player) {
  const index = player.powerUps.indexOf("shield");
  if (index === -1) return false;
  player.powerUps.splice(index, 1);
  return true;
}

function applyWild(room, player, partner) {
  let effect = pick(["swap", "steal", "back", "double"]);
  if (effect === "swap" && (!partner || partner.position === player.position)) effect = "double";

  // Steal in co-op is a plain bonus, so only an actual steal can be blocked
  const targetsPartner = partner && (effect === "swap" || (effect === "steal" && room.settings.mode !== "coop"));
  if (targetsPartner && useShield(partner)) {
    const text = `🛡️ ${partner.username}'s Shield blocked ${player.username}'s Wild ${effect}!`;
    addLog(room, partner.id, "🛡️", text);
    return text;
  }

  let text;
  switch (effect) {
    case "swap":
      [player.position, partner.position] = [partner.position, player.position];
      text = `⚡ Wild! ${player.username} swapped places with ${partner.username}`;
      break;

    case "steal": {
      if (room.settings.mode === "coop" || !partner) {
        player.score += C.WILD_STEAL;
        text = `⚡ Wild! Lucky bonus: ${player.username} gets +${C.WILD_STEAL}`;
        break;
      }
      const amount = Math.min(C.WILD_STEAL, partner.score);
      partner.score -= amount;
      player.score += amount;
      text = `⚡ Wild! ${player.username} stole ${amount} points from ${partner.username}`;
      break;
    }

    case "back":
      player.position = (player.position - C.WILD_BACK_STEPS + room.board.length) % room.board.length;
      text = `⚡ Wild! ${player.username} moves back ${C.WILD_BACK_STEPS} tiles`;
      break;

    default:
      player.doubleNext = true;
      text = `⚡ Wild! ${player.username}'s next challenge is worth double`;
  }

  addLog(room, player.id, "⚡", text.replace("⚡ Wild! ", "Wild: "));
  return text;
}

// Decides what happens on the tile the player just arrived on
function landOn(room, player, messages) {
  const partner = otherPlayer(room, player);
  const tile = room.board[player.position];

  if (partner && partner.position === player.position) {
    room.challenge = makeChallenge(room, "together", player);
    messages.push(`💑 ${player.username} landed on ${partner.username}: together challenge!`);
    addLog(room, player.id, "💑", `${player.username} landed on ${partner.username}: together challenge`, room.challenge.question);
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

// Applies a dice roll that already passed validation
function resolveRoll(room, player, dice, isFreeRoll) {
  const steps = [];
  let current = player.position;
  for (let i = 0; i < dice; i++) {
    current = (current + 1) % room.board.length;
    steps.push(current);
  }

  player.position = current;
  if (!isFreeRoll) player.turnsTaken += 1;

  addLog(room, player.id, "🎲", `${player.username} rolled ${dice}${isFreeRoll ? " (bonus roll)" : ""} → ${TILE_LABEL[room.board[current]]}`);

  const messages = [];

  // Passing (or landing on) START: lap bonus, coins, a power-up card and the shop
  if (steps.includes(0)) {
    player.score += C.LAP_BONUS;
    earnCoins(player, C.COINS_PER_LAP);
    player.tally.laps += 1;
    player.shopOpen = true;

    const text = `⭐ ${player.username} passed START: +${C.LAP_BONUS} pts, +${C.COINS_PER_LAP} 🪙`;
    messages.push(`${text}. The shop is open!`);
    addLog(room, player.id, "⭐", `${text.replace("⭐ ", "")}. Shop opened`);
  }

  if (dice === 6) {
    room.freeRolls += 1;
    player.tally.sixes += 1;
    messages.push(`🎲 ${player.username} rolled a 6: bonus roll!`);
  }

  landOn(room, player, messages);
  if (messages.length) setEvent(room, player.id, messages.join("  ·  "));

  return { playerId: player.id, dice, steps };
}

/* =========================
   CHALLENGES
========================= */

// Points for the doer, plus the same for the partner when Mirror was played
function awardChallenge(room, c, doer, points) {
  const got = award(doer, points);
  const partner = otherPlayer(room, doer);
  if (c.mirror && partner) {
    const mirrored = award(partner, points);
    addLog(room, partner.id, "🔁", `Mirror: ${partner.username} also gets +${mirrored}`);
  }
  return got;
}

function noteFrom(text) {
  const note = cleanText(text, C.MAX_NOTE_LENGTH);
  return note || null;
}

// Returns an error message, or null when the action was applied
function challengeAction(room, player, { action, hearts, text, note, picks } = {}) {
  const c = room.challenge;
  if (!c || room.phase !== "playing") return "";

  const isDoer = c.playerId === player.id;
  const doer = room.players.find((p) => p.id === c.playerId);
  const partner = otherPlayer(room, doer);
  const label = TILE_LABEL[c.type];

  // Together: both press Done (both score), either can skip
  if (c.type === "together") {
    if (action === "skip") {
      addLog(room, player.id, "⏭️", `${player.username} skipped the together challenge`, c.question);
      room.players.forEach((p) => (p.tally.skipped += 1));
      endTurn(room);
    } else if (action === "done") {
      c.confirmed[player.id] = true;
      if (room.players.every((p) => c.confirmed[p.id])) {
        const got = room.players.map((p) => {
          countDone(p, "together");
          return `${p.username} +${award(p, c.points)}`;
        });
        addLog(room, null, "💑", `Together challenge done: ${got.join(", ")}`, c.question);
        addMoment(room, { type: "together", question: c.question, playerId: doer.id, partnerId: partner?.id, points: c.points });
        endTurn(room);
      }
    }
    return null;
  }

  // Mini-games have their own steps; Finish My Sentence reuses the normal heart rating
  if (c.type === "play" && c.stage !== "rating") return miniGameAction(room, player, c, { action, text, picks });

  switch (c.stage) {
    // Guess: the question is about the partner. The player who landed guesses, the partner types
    // the real answer; nobody sees either until both are in.
    case "guessing": {
      if (action === "skip" && isDoer) {
        if (c.guess !== null) return "You already locked in your guess";
        doer.tally.skipped += 1;
        addLog(room, doer.id, "⏭️", `${doer.username} skipped a guess question`, c.question);
        endTurn(room);
        return null;
      }
      const value = cleanText(text, C.MAX_ANSWER_LENGTH);
      if (!value) return "Type something first";

      if (action === "guess" && isDoer) c.guess = value;
      else if (action === "answer" && !isDoer) c.answer = value;
      else return "";

      if (c.answer !== null && c.guess !== null) c.stage = "reveal";
      return null;
    }

    case "reveal": {
      // The partner (the question is about them) decides if the guess was right
      if (isDoer) return "";
      if (action !== "match" && action !== "nomatch") return "";

      const matched = action === "match";
      doer.tally.guessRounds += 1;
      if (partner) partner.tally.guessRounds += 1;

      if (matched) {
        countDone(doer, "guess");
        doer.tally.guessMatches += 1;
        const a = award(doer, c.points);
        let b = 0;
        if (partner) {
          partner.tally.guessMatches += 1;
          b = award(partner, c.points);
        }
        addLog(room, doer.id, "🔮", `Match! ${doer.username} knew ${partner?.username}'s answer (+${a} / +${b})`, `${c.question} → “${c.answer}” / “${c.guess}”`);
      } else {
        addLog(room, doer.id, "🤔", `No match: ${doer.username} guessed “${c.guess}”, it was “${c.answer}”`, c.question);
      }
      // doerGuessed: the player who landed guessed (older memories have it the other way round)
      addMoment(room, { type: "guess", question: c.question, playerId: doer.id, partnerId: partner?.id, answer: c.answer, guess: c.guess, matched, doerGuessed: true });
      endTurn(room);
      return null;
    }

    case "rating": {
      if (isDoer || action !== "rate") return "";
      const count = Math.round(Number(hearts));
      if (!(count >= 1 && count <= 3)) return "";

      countDone(doer, c.type);
      if (c.mini) doer.tally.minigames = (doer.tally.minigames || 0) + 1;
      doer.tally.heartsReceived += count;
      doer.tally.ratingsReceived += 1;
      if (count === 3) doer.tally.threeHearts += 1;

      const got = awardChallenge(room, c, doer, count * C.HEART_POINTS);
      addLog(room, player.id, "❤️", `${player.username} rated ${doer.username}'s answer ${"❤️".repeat(count)} (+${got})`, c.question);
      addMoment(room, { type: c.type, question: c.question, playerId: doer.id, partnerId: player.id, hearts: count, note: c.note });
      endTurn(room);
      return null;
    }

    case "timing": {
      if (!isDoer) return "";
      if (action === "done") {
        const inTime = Date.now() <= c.endsAt + C.TIMER_GRACE_MS;
        countDone(doer, "timed");
        if (inTime) doer.tally.timedInTime += 1;
        const got = awardChallenge(room, c, doer, inTime ? c.points * 2 : c.points);
        addLog(room, doer.id, "⏱️", `${doer.username} finished ${inTime ? "in time" : "late"} (+${got})`, c.question);
        addMoment(room, { type: "timed", question: c.question, playerId: doer.id, inTime });
      } else if (action === "skip") {
        doer.tally.skipped += 1;
        addLog(room, doer.id, "⏭️", `${doer.username} skipped a timed challenge`, c.question);
      } else {
        return "";
      }
      endTurn(room);
      return null;
    }

    case "pending": {
      if (!isDoer) return "";

      if (action === "done") {
        const memo = noteFrom(note);
        if (memo) doer.tally.notes += 1;

        if (C.RATED_TYPES.has(c.type)) {
          c.note = memo;
          c.stage = "rating";
          addLog(room, doer.id, "🗣️", `${doer.username} answered a ${label} question, waiting for ${partner?.username}'s rating`, c.question);
          return null;
        }
        countDone(doer, c.type);
        const got = awardChallenge(room, c, doer, c.points);
        addLog(room, doer.id, "✅", `${doer.username} did the ${label} (+${got})`, c.question);
        addMoment(room, { type: c.type, question: c.question, playerId: doer.id, note: memo });
      } else if (action === "startTimer" && c.type === "timed") {
        c.stage = "timing";
        c.endsAt = Date.now() + C.TIMED_DARE_MS;
        addLog(room, doer.id, "⏱️", `${doer.username} started the 30s timer`, c.question);
        return null;
      } else if (action === "save") {
        if (!C.SAVABLE_TYPES.has(c.type)) return "Only dares and gifts can be saved for later";
        doer.savedDares.push({ id: randomId(), type: c.type, question: c.question, points: c.points });
        doer.tally.saved += 1;
        addLog(room, doer.id, "⏳", `${doer.username} saved a ${label} for later`, c.question);
      } else if (action === "skip") {
        doer.tally.skipped += 1;
        addLog(room, doer.id, "⏭️", `${doer.username} skipped a ${label}`, c.question);
      } else {
        return "";
      }
      endTurn(room);
      return null;
    }
  }
  return "";
}

/* =========================
   MINI-GAMES (🎮 PLAY tile)
========================= */

const normalizeWord = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// "cats", "a cat" or "icecream" all count
function guessMatches(guess, word) {
  const g = normalizeWord(guess).replace(/^(a|an|the) /, "");
  const w = normalizeWord(word);
  return g === w || g === `${w}s` || g === `${w}es` || g.replace(/ /g, "") === w.replace(/ /g, "");
}

function startMiniGame(room, c, doer, partner) {
  const m = c.mini;
  if (m.game === "finish") {
    m.prompt = fillPartner(drawFrom(room, "mini:finish", questionList(room, "finish", MINI.finish)), partner?.username);
    c.stage = "writing";
  } else if (m.game === "draw") {
    m.word = drawFrom(room, "mini:draw", questionList(room, "draw", MINI.draw));
    m.strokes = [];
    c.stage = "drawing";
    c.endsAt = Date.now() + C.DRAW_MS;
  } else {
    m.items = Array.from({ length: C.MINI_ROUNDS }, () => {
      if (m.game === "thisOrThat") {
        const [a, b] = drawFrom(room, "mini:thisOrThat", questionList(room, "thisOrThat", MINI.thisOrThat));
        return { text: "", options: [a, b] };
      }
      if (m.game === "neverEver") {
        return { text: fillPartner(`Never have I ever ${drawFrom(room, "mini:neverEver", questionList(room, "neverEver", MINI.neverEver))}`, partner?.username), options: ["🙋 I have", "🙅 Never"] };
      }
      return { text: fillPartner(`Who's more likely to ${drawFrom(room, "mini:mostLikely", questionList(room, "mostLikely", MINI.mostLikely))}?`, partner?.username), options: [doer.username, partner?.username ?? "You"] };
    });
    m.picks = {};
    c.stage = "picking";
  }
  addLog(room, doer.id, "🎮", `${doer.username} started ${c.question}`);
}

function countMiniGame(player, scored) {
  if (scored) countDone(player, "play");
  player.tally.minigames = (player.tally.minigames || 0) + 1;
}

function finishPicks(room, c, doer, partner) {
  const m = c.mini;
  const [a, b] = [doer, partner].map((p) => m.picks[p.id]);
  const matches = m.items.filter((_, i) => a[i] === b[i]).length;
  const each = matches * C.MINI_MATCH_POINTS + (matches === m.items.length ? C.MINI_ALL_MATCH_BONUS : 0);

  const points = {};
  for (const p of room.players) {
    countMiniGame(p, true);
    points[p.id] = each > 0 ? award(p, each) : 0;
  }
  m.result = { matches, points };
  c.stage = "results";

  const scored = room.players.map((p) => `${p.username} +${points[p.id]}`).join(", ");
  addLog(room, doer.id, "🎮", `${c.question}: ${matches}/${m.items.length} matches (${scored})`);
  addMoment(room, {
    type: "play",
    question: c.question,
    playerId: doer.id,
    partnerId: partner.id,
    note: m.items.map((item, i) => `${item.text ? `${item.text}: ` : ""}${item.options[a[i]]} / ${item.options[b[i]]}`).join(" · "),
  });
}

function endDrawing(room, c, doer, partner, guessed) {
  const m = c.mini;
  const points = {};
  if (guessed) {
    for (const p of room.players) {
      countMiniGame(p, true);
      points[p.id] = award(p, c.points);
    }
    addLog(room, partner.id, "🎨", `${partner.username} guessed ${doer.username}'s drawing: “${m.word}” (+${c.points} each)`);
    addMoment(room, { type: "play", question: c.question, playerId: doer.id, partnerId: partner.id, note: `Drew “${m.word}” and it was guessed` });
  } else {
    room.players.forEach((p) => countMiniGame(p, false));
    addLog(room, doer.id, "🎨", `Nobody got ${doer.username}'s drawing: it was “${m.word}”`);
  }
  m.result = { guessed, points };
  c.stage = "results";
  c.endsAt = null;
}

function miniGameAction(room, player, c, { action, text, picks }) {
  const isDoer = c.playerId === player.id;
  const doer = room.players.find((p) => p.id === c.playerId);
  const partner = otherPlayer(room, doer);
  const m = c.mini;
  if (!partner) return "";

  // The one who landed can skip until there's a result (giving up a drawing shows the word)
  if (action === "skip" && isDoer && c.stage !== "results") {
    doer.tally.skipped += 1;
    if (c.stage === "drawing") {
      endDrawing(room, c, doer, partner, false);
      return null;
    }
    addLog(room, doer.id, "⏭️", `${doer.username} skipped ${c.question}`);
    endTurn(room);
    return null;
  }

  switch (c.stage) {
    case "pending":
      if (!isDoer || action !== "start") return "";
      startMiniGame(room, c, doer, partner);
      return null;

    case "picking": {
      if (action !== "pick") return "";
      if (m.picks[player.id]) return "You already locked in your picks";
      const valid = Array.isArray(picks) && picks.length === m.items.length && picks.every((x) => x === 0 || x === 1);
      if (!valid) return "Pick one option for every question";
      m.picks[player.id] = picks;
      if (room.players.every((p) => m.picks[p.id])) finishPicks(room, c, doer, partner);
      return null;
    }

    case "writing": {
      if (!isDoer || action !== "answer") return "";
      const value = cleanText(text, C.MAX_ANSWER_LENGTH);
      if (!value) return "Type something first";
      c.answer = value;
      c.note = `${m.prompt.replace(/…/g, "").trim()} ${value}`; // shows in the memory book
      c.stage = "rating";
      addLog(room, doer.id, "✍️", `${doer.username} finished the sentence, waiting for ${partner.username}'s rating`, c.note);
      return null;
    }

    case "drawing": {
      if (action === "timeup") {
        if (Date.now() < c.endsAt) return "";
        endDrawing(room, c, doer, partner, false);
        return null;
      }
      if (isDoer || action !== "guess") return "";
      if (Date.now() > c.endsAt + C.TIMER_GRACE_MS) return "Time's up!";
      const value = cleanText(text, C.MAX_ANSWER_LENGTH);
      if (!value) return "Type a guess first";
      if (guessMatches(value, m.word)) {
        endDrawing(room, c, doer, partner, true);
      } else {
        m.guesses = [...m.guesses, value].slice(-C.MAX_DRAW_GUESSES);
      }
      return null;
    }

    case "results":
      if (!isDoer || action !== "continue") return "";
      endTurn(room);
      return null;
  }
  return "";
}

// Live drawing: only the drawer, only while drawing. Points are 0..1 so any screen size works.
function addStroke(room, player, stroke) {
  const c = room.challenge;
  if (!c?.mini || c.mini.game !== "draw" || c.stage !== "drawing" || c.playerId !== player.id) return null;
  if (c.mini.strokes.length >= C.MAX_STROKES) return null;

  const points = (Array.isArray(stroke?.points) ? stroke.points.slice(0, C.MAX_STROKE_POINTS) : [])
    .filter((pt) => Array.isArray(pt) && pt.length === 2 && pt.every((n) => Number.isFinite(n)))
    .map((pt) => pt.map((n) => Math.min(1, Math.max(0, Math.round(n * 1000) / 1000))));
  if (points.length === 0) return null;

  const color = typeof stroke.color === "string" && /^#[0-9a-f]{6}$/i.test(stroke.color) ? stroke.color : "#ffffff";
  const size = Math.min(24, Math.max(1, Math.round(Number(stroke.size) || 4)));
  const saved = { points, color, size };
  c.mini.strokes.push(saved);
  return saved;
}

function clearDrawing(room, player) {
  const c = room.challenge;
  if (!c?.mini || c.mini.game !== "draw" || c.stage !== "drawing" || c.playerId !== player.id) return false;
  c.mini.strokes = [];
  return true;
}

// For a (re)opened drawing card: the strokes so far, and the word only for the drawer
function drawingState(room, player) {
  const c = room.challenge;
  if (!c?.mini || c.mini.game !== "draw") return { strokes: [], word: null };
  const canSee = c.playerId === player.id || c.stage === "results";
  return { strokes: c.mini.strokes, word: canSee ? c.mini.word : null };
}

/* =========================
   CARDS + SHOP
========================= */

// Returns { error } or { move } (teleport) or {}
function usePowerUp(room, player, card, target) {
  if (room.phase !== "playing") return { error: "Cards can only be used during a game" };
  if (!Object.hasOwn(C.POWER_UPS, card)) return { error: "Unknown card" };

  const index = player.powerUps.indexOf(card);
  if (index === -1) return { error: "You don't have that card" };

  if (card === "shield") return { error: "Your Shield works by itself when your partner's Wild or Pass It On hits you" };

  const partner = otherPlayer(room, player);
  const consume = () => {
    player.powerUps.splice(index, 1);
    player.tally.cardsUsed += 1;
  };

  // Teleport replaces your roll
  if (card === "teleport") {
    if (room.players[room.turn]?.id !== player.id) return { error: "Teleport replaces your roll, use it on your turn" };
    if (room.rolling || room.challenge) return { error: "Finish the current challenge first" };

    const to = Math.round(Number(target));
    if (!Number.isInteger(to) || to < 0 || to >= room.board.length) return { error: "Pick a tile on the board" };
    if (to === player.position) return { error: "You're already on that tile" };

    if (room.freeRolls > 0) room.freeRolls -= 1;
    else player.turnsTaken += 1;
    player.shopOpen = false;

    consume();
    player.position = to;
    const messages = [`🎯 ${player.username} teleported to ${TILE_LABEL[room.board[to]]}`];
    addLog(room, player.id, "🎯", `${player.username} used ${cardName(card)} → ${TILE_LABEL[room.board[to]]}`);
    landOn(room, player, messages);
    setEvent(room, player.id, messages.join("  ·  "));
    return { move: { playerId: player.id, dice: null, steps: [to] } };
  }

  // The rest are played on your own challenge before you've done anything with it
  const c = room.challenge;
  if (!c) return { error: "Play this card on a challenge" };
  if (c.type === "together") return { error: "Cards can't be used on a together challenge" };
  if (c.ownerId !== player.id || c.playerId !== player.id) return { error: "You can only use cards on your own challenge" };
  if (c.cardUsed) return { error: "Only one card per challenge" };
  if (c.stage !== "pending" && c.stage !== "guessing") return { error: "You can't use a card right now" };
  if (c.stage === "guessing" && (c.answer !== null || c.guess !== null)) return { error: "Too late, answers are already in" };

  // In the pick games and Draw It you both play and score anyway
  const bothPlay = c.mini && c.mini.game !== "finish";
  if (bothPlay && card === "mirror") return { error: "Mirror doesn't work on this mini-game (you both score already)" };
  if (bothPlay && c.mini.game !== "draw" && card === "handOff") return { error: "Pass It On doesn't work on this mini-game (you both play it)" };

  if (card === "freePass") {
    consume();
    countDone(player, c.type);
    const got = award(player, c.points);
    setEvent(room, player.id, `🎟️ ${player.username} used a Free Pass: +${got} without doing it`);
    addLog(room, player.id, "🎟️", `${player.username} used ${cardName(card)} on a ${TILE_LABEL[c.type]} (+${got})`, c.question);
    endTurn(room);
    return {};
  }

  if (card === "reroll") {
    consume();
    room.challenge = null;
    room.freeRolls += 1;
    setEvent(room, player.id, `🎲 ${player.username} used a Reroll and rolls again`);
    addLog(room, player.id, "🎲", `${player.username} used ${cardName(card)} on a ${TILE_LABEL[c.type]}`, c.question);
    return {};
  }

  if (card === "handOff") {
    if (c.type === "guess" || !partner) return { error: "Pass It On doesn't work on guess questions" };
    consume();
    c.cardUsed = true;
    if (useShield(partner)) {
      setEvent(room, partner.id, `🛡️ ${partner.username}'s Shield blocked the Pass It On!`);
      addLog(room, partner.id, "🛡️", `${partner.username}'s Shield blocked ${player.username}'s Pass It On`, c.question);
      return {};
    }
    c.playerId = partner.id;
    c.handedOff = true;
    c.question = fillPartner(c.template ?? c.question, player.username); // now it's about the one who passed it
    setEvent(room, player.id, `😈 ${player.username} passed the challenge to ${partner.username}!`);
    addLog(room, player.id, "😈", `${player.username} passed the ${TILE_LABEL[c.type]} to ${partner.username}`, c.question);
    return {};
  }

  if (card === "mirror") {
    if (c.type === "guess") return { error: "Mirror doesn't work on guess questions (you both score on a match already)" };
    consume();
    c.cardUsed = true;
    c.mirror = true;
    setEvent(room, player.id, `🔁 ${player.username} played Mirror: ${partner?.username} earns the same points`);
    addLog(room, player.id, "🔁", `${player.username} played ${cardName(card)} on a ${TILE_LABEL[c.type]}`, c.question);
    return {};
  }

  return { error: "Unknown card" };
}

const THEME_NAMES = {
  warm: "Warm Night",
  ocean: "Ocean",
  forest: "Forest",
  festive: "Festive",
  midnight: "Midnight",
  sakura: "Sakura",
  sunset: "Sunset",
  lavender: "Lavender",
  mint: "Mint",
  noir: "Noir",
};

// The room creator can restyle the room at any time; both screens update live
function updateLook(room, player, { theme, a11y } = {}) {
  if (room.creatorId !== player.id) return "Only the room creator can change the theme";

  if (theme !== undefined) {
    if (!C.THEMES.includes(theme)) return "Unknown theme";
    if (theme !== room.settings.theme) {
      room.settings.theme = theme;
      addLog(room, player.id, "🎨", `${player.username} changed the theme to ${THEME_NAMES[theme] ?? theme}`);
    }
  }

  if (a11y && typeof a11y === "object") {
    for (const key of C.A11Y_KEYS) {
      if (typeof a11y[key] === "boolean") room.settings.a11y[key] = a11y[key];
    }
  }
  return null;
}

function buyCard(room, player, card) {
  if (room.phase !== "playing") return "The shop is only open during a game";
  if (!player.shopOpen) return "The shop opens when you pass START";
  if (!Object.hasOwn(C.POWER_UPS, card)) return "Unknown card";
  if (player.powerUps.length >= C.MAX_POWER_UPS) return `You can hold at most ${C.MAX_POWER_UPS} cards`;

  const { price } = C.POWER_UPS[card];
  if (player.coins < price) return `Not enough coins (${price} 🪙 needed)`;

  player.coins -= price;
  player.tally.coinsSpent += price;
  player.powerUps.push(card);
  addLog(room, player.id, "🛒", `${player.username} bought ${cardName(card)} for ${price} 🪙`);
  return null;
}

function completeSavedDare(room, player, dareId) {
  if (room.phase !== "playing") return "Saved dares can only be completed during a game";

  const dare = player.savedDares.find((d) => d.id === dareId);
  if (!dare) return "";

  player.savedDares = player.savedDares.filter((d) => d.id !== dareId);
  const type = dare.type ?? "dare"; // older saves were always dares
  player.score += dare.points; // never doubled
  earnCoins(player, C.COINS_PER_CHALLENGE);
  countDone(player, type);
  addLog(room, player.id, "✅", `${player.username} did a saved ${TILE_LABEL[type]} (+${dare.points})`, dare.question);
  addMoment(room, { type, question: dare.question, playerId: player.id, saved: true });

  if (reachedTarget(room)) finishGame(room);
  return null;
}

module.exports = {
  TILE_LABEL,
  cleanText,
  otherPlayer,
  parseSettings,
  generateBoard,
  createRoom,
  createPlayer,
  pickAvatar,
  setAvatar,
  normalizeRoom,
  resetGame,
  addLog,
  setEvent,
  publicState,
  resolveRoll,
  challengeAction,
  addStroke,
  clearDrawing,
  drawingState,
  usePowerUp,
  buyCard,
  updateLook,
  completeSavedDare,
  finishGame,
};
