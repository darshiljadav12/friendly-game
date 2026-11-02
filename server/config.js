// Every number the rules depend on lives here.
// The client's How-to-play guide quotes these, keep it in sync when changing them.

const MAX_PLAYERS = 2;
const BOARD_SIZE = 28; // must match the 8x8 ring layout on the client
const DICE_DELAY_MS = 700; // matches dice animation time
const RECONNECT_GRACE_MS = 60_000;
const MAX_NAME_LENGTH = 20;
const MAX_ANSWER_LENGTH = 80;
const MAX_NOTE_LENGTH = 200; // optional memory-book note on Done
const LOG_LIMIT = 200; // activity entries kept per game
const LOG_PUBLIC = 80; // activity entries sent to clients

const LAP_BONUS = 5;
const HEART_POINTS = 5; // per heart when the partner rates an answer
const WILD_STEAL = 10;
const WILD_BACK_STEPS = 3;
const TIMED_DARE_MS = 30_000;
const TIMER_GRACE_MS = 1_000; // allows for network lag on the Done press
const MAX_POWER_UPS = 3;
const COOP_POINTS_PER_ROUND = 30; // co-op goal = rounds * this (test games averaged ~22–43 per round)
const REACTION_COOLDOWN_MS = 250;

// Coins are a separate shop currency; spending them never lowers your score.
// Cards can only be bought (no free card at START), and they're meant to be a treat.
const COINS_PER_CHALLENGE = 1;
const COINS_PER_LAP = 3;

// Chosen by the room creator
const LENGTH_OPTIONS = {
  5: { rounds: 5 },
  10: { rounds: 10 },
  20: { rounds: 20 },
  points150: { target: 150 },
};

const REACTIONS = ["😂", "❤️", "😳", "🔥", "😍", "👏"];

const POWER_UPS = {
  freePass: { name: "Free Pass", icon: "🎟️", price: 18 },
  reroll: { name: "Reroll", icon: "🎲", price: 12 },
  handOff: { name: "Pass It On", icon: "😈", price: 15 },
  shield: { name: "Shield", icon: "🛡️", price: 12 },
  mirror: { name: "Mirror", icon: "🔁", price: 15 },
  teleport: { name: "Teleport", icon: "🎯", price: 22 },
};

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

// Challenges that can be put off with "Save for later" (a gift can't always be given mid-game)
const SAVABLE_TYPES = new Set(["dare", "gift"]);

// The partner rates these with 1–3 hearts instead of a fixed score
const RATED_TYPES = new Set(["love", "memory"]);

const TILE_TYPES = ["love", "memory", "dare", "gift", "guess", "timed", "wild"];

// The original hand-tuned layout
const CLASSIC_PATTERN = ["love", "dare", "guess", "memory", "wild", "gift", "dare", "timed", "love"];

// Relative weights per tile type; the board is filled in these proportions
const BOARD_PRESETS = {
  classic: null, // uses CLASSIC_PATTERN
  romantic: { love: 4, memory: 4, gift: 3, guess: 2, dare: 1, timed: 1, wild: 1 },
  daring: { dare: 4, timed: 3, wild: 2, love: 1, memory: 1, gift: 1, guess: 1 },
  chill: { love: 3, memory: 3, gift: 3, guess: 3, dare: 1, timed: 0, wild: 0 },
  random: { love: 1, memory: 1, dare: 1, gift: 1, guess: 1, timed: 1, wild: 1 },
  custom: null, // weights come from the creator
};
const MAX_TILE_WEIGHT = 5;

const THEMES = ["warm", "ocean", "forest", "festive"];
const A11Y_KEYS = ["reduceMotion", "largeText", "highContrast", "colorBlind"];

module.exports = {
  MAX_PLAYERS,
  BOARD_SIZE,
  DICE_DELAY_MS,
  RECONNECT_GRACE_MS,
  MAX_NAME_LENGTH,
  MAX_ANSWER_LENGTH,
  MAX_NOTE_LENGTH,
  LOG_LIMIT,
  LOG_PUBLIC,
  LAP_BONUS,
  HEART_POINTS,
  WILD_STEAL,
  WILD_BACK_STEPS,
  TIMED_DARE_MS,
  TIMER_GRACE_MS,
  MAX_POWER_UPS,
  COOP_POINTS_PER_ROUND,
  REACTION_COOLDOWN_MS,
  COINS_PER_CHALLENGE,
  COINS_PER_LAP,
  LENGTH_OPTIONS,
  REACTIONS,
  POWER_UPS,
  POINTS,
  RATED_TYPES,
  SAVABLE_TYPES,
  TILE_TYPES,
  CLASSIC_PATTERN,
  BOARD_PRESETS,
  MAX_TILE_WEIGHT,
  THEMES,
  A11Y_KEYS,
};
