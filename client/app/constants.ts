import type { A11y, A11yKey, BoardPreset, Challenge, ChallengeType, MiniGameName, GameLength, NewGameSettings, PlayableTile, PowerUp, ThemeName, TileType } from "./types";

type ThemeKey = TileType | ChallengeType;

// The board order comes from the server; this only describes how each tile looks
export const TILE_INFO: Record<ThemeKey, { label: string; sub: string }> = {
  start: { label: "START", sub: "+5 pts, +3 coins & the shop" },
  love: { label: "LOVE", sub: "Partner rates your answer" },
  dare: { label: "DARE", sub: "Do it now or save it" },
  memory: { label: "MEMORY", sub: "Partner rates your answer" },
  gift: { label: "GIFT", sub: "A sweet gesture (or save it)" },
  guess: { label: "GUESS", sub: "Can they guess your answer?" },
  wild: { label: "WILD", sub: "Something random happens" },
  timed: { label: "TIMED", sub: "30s: in time = double" },
  play: { label: "PLAY", sub: "A quick mini-game together" },
  together: { label: "TOGETHER", sub: "Land on your partner" },
};

// Whether the challenge card is waiting for a tap/answer from this player right now
export function needsMyAction(c: Challenge | null | undefined, myId: string) {
  if (!c) return false;
  const isDoer = c.playerId === myId;
  if (c.type === "together") return !c.confirmed.includes(myId);
  if (c.mini) {
    if (c.stage === "picking") return !c.mini.picked.includes(myId);
    if (c.stage === "drawing") return true; // one draws, the other guesses
    if (c.stage === "rating") return !isDoer;
    return isDoer; // pending (start), writing, results (continue)
  }
  switch (c.stage) {
    case "guessing":
      return isDoer ? !c.hasAnswer : !c.hasGuess;
    case "rating":
      return !isDoer;
    default: // pending, timing, reveal
      return isDoer;
  }
}

export const PLAYABLE_TILES: PlayableTile[] = ["love", "memory", "dare", "gift", "guess", "timed", "play", "wild"];

// Prices come from the server (meta); these are fallbacks for the first render
export const POWER_UP_INFO: Record<PowerUp, { icon: string; name: string; desc: string; price: number }> = {
  freePass: { icon: "🎟️", name: "Free Pass", desc: "Skip this challenge and still get its points", price: 18 },
  reroll: { icon: "🎲", name: "Reroll", desc: "Ignore this tile and roll again", price: 12 },
  handOff: { icon: "😈", name: "Pass It On", desc: "Your partner has to do this one", price: 15 },
  shield: { icon: "🛡️", name: "Shield", desc: "Blocks your partner's Wild swap/steal or Pass It On (automatic)", price: 12 },
  mirror: { icon: "🔁", name: "Mirror", desc: "Your partner earns the same points you do on this challenge", price: 15 },
  teleport: { icon: "🎯", name: "Teleport", desc: "Instead of rolling, jump to any tile you pick", price: 22 },
};

export const MINI_GAME_INFO: Record<MiniGameName, { icon: string; title: string; how: string; points: string }> = {
  thisOrThat: { icon: "⚖️", title: "This or That", how: "3 quick choices. You both pick in secret, then see if you think alike.", points: "+5 per match" },
  neverEver: { icon: "🙊", title: "Never Have I Ever", how: "3 statements. You both answer honestly in secret, then compare (and tell the stories!).", points: "+5 per match" },
  mostLikely: { icon: "👉", title: "Who's More Likely", how: "3 questions. You both secretly point at one of you, then see if you agree.", points: "+5 per match" },
  finish: { icon: "✍️", title: "Finish My Sentence", how: "Finish a sweet sentence, then your partner rates it with hearts.", points: "1–3 ❤️" },
  draw: { icon: "🎨", title: "Draw It", how: "Draw a secret word in 60 seconds while your partner guesses it.", points: "+10 each" },
};

export const REACTIONS = ["😂", "❤️", "😳", "🔥", "😍", "👏"];

export const LENGTH_OPTIONS: { value: GameLength; label: string; coop: boolean }[] = [
  { value: "5", label: "5 rounds", coop: true },
  { value: "10", label: "10 rounds", coop: true },
  { value: "20", label: "20 rounds", coop: true },
  { value: "points150", label: "First to 150", coop: false },
];

export const BOARD_PRESETS: { value: BoardPreset; icon: string; label: string; desc: string }[] = [
  { value: "classic", icon: "🎲", label: "Classic", desc: "The original balanced board" },
  { value: "romantic", icon: "💗", label: "Romantic", desc: "More love, memories & gifts" },
  { value: "daring", icon: "🔥", label: "Daring", desc: "More dares, timers & wilds" },
  { value: "chill", icon: "🌙", label: "Chill", desc: "No timers, no wild surprises" },
  { value: "random", icon: "🔀", label: "Random", desc: "Every type equally, shuffled" },
  { value: "custom", icon: "🎛️", label: "Custom", desc: "Pick your own mix" },
];

export const THEMES: { value: ThemeName; label: string; swatch: [string, string] }[] = [
  { value: "warm", label: "Warm Night", swatch: ["#3d1531", "#fb7185"] },
  { value: "ocean", label: "Ocean", swatch: ["#0b2236", "#38bdf8"] },
  { value: "forest", label: "Forest", swatch: ["#10251c", "#4ade80"] },
  { value: "festive", label: "Festive", swatch: ["#3a0d12", "#fbbf24"] },
];

export const A11Y_OPTIONS: { key: A11yKey; icon: string; label: string; desc: string }[] = [
  { key: "reduceMotion", icon: "🐢", label: "Reduce motion", desc: "Fewer animations, no floating hearts" },
  { key: "largeText", icon: "🔠", label: "Larger text", desc: "Everything about 15% bigger" },
  { key: "highContrast", icon: "🌓", label: "High contrast", desc: "Brighter text and borders" },
  { key: "colorBlind", icon: "👁️", label: "Colour-blind friendly", desc: "Blue/orange players with shapes" },
];

export const NO_A11Y: A11y = { reduceMotion: false, largeText: false, highContrast: false, colorBlind: false };

export const DEFAULT_NEW_GAME: NewGameSettings = {
  mode: "competitive",
  length: "10",
  board: { preset: "classic", weights: null },
  theme: "warm",
  a11y: NO_A11Y,
};

export const GRID_SIZE = 8;

// Maps each grid cell to a board index (clockwise ring), or null for the empty middle
export const BOARD_LAYOUT: (number | null)[] = (() => {
  const layout: (number | null)[] = Array(GRID_SIZE * GRID_SIZE).fill(null);

  let index = 0;

  // top row
  for (let col = 0; col < GRID_SIZE; col++) {
    layout[col] = index++;
  }

  // right column
  for (let row = 1; row < GRID_SIZE - 1; row++) {
    layout[row * GRID_SIZE + (GRID_SIZE - 1)] = index++;
  }

  // bottom row
  for (let col = GRID_SIZE - 1; col >= 0; col--) {
    layout[(GRID_SIZE - 1) * GRID_SIZE + col] = index++;
  }

  // left column
  for (let row = GRID_SIZE - 2; row > 0; row--) {
    layout[row * GRID_SIZE] = index++;
  }

  return layout;
})();

type TileTheme = { light: string; base: string; edge: string; icon: string };

// Muted tones from one warm family so the board reads calm, not rainbow
export const TILE_THEMES: Record<ThemeKey, TileTheme> = {
  love: { light: "#b4566f", base: "#94384f", edge: "#561c2c", icon: "❤️" },
  dare: { light: "#bd6a4c", base: "#9c4d32", edge: "#5a2919", icon: "😈" },
  memory: { light: "#8a6aac", base: "#6c4f8d", edge: "#3b2a52", icon: "📸" },
  gift: { light: "#6c9a80", base: "#4e7a62", edge: "#2a4535", icon: "🎁" },
  guess: { light: "#6d9aa0", base: "#4f7c82", edge: "#29464a", icon: "🤔" },
  wild: { light: "#b45f9e", base: "#8e3f7c", edge: "#4c1f43", icon: "⚡" },
  timed: { light: "#c4864e", base: "#a06232", edge: "#583514", icon: "⏱️" },
  play: { light: "#7d79c9", base: "#5d58a8", edge: "#312d63", icon: "🎮" },
  start: { light: "#d9a94a", base: "#b8892f", edge: "#6b4d14", icon: "⭐" },
  together: { light: "#e0607e", base: "#b83a5b", edge: "#6a1d33", icon: "💑" },
};

// Raised "block" look: soft highlight on top, solid edge underneath for thickness
export function tileStyle(type: ThemeKey) {
  const t = TILE_THEMES[type];
  return {
    background: `linear-gradient(180deg, ${t.light} 0%, ${t.base} 100%)`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.18), inset 0 0 0 1px rgba(255,255,255,0.08), 0 3px 0 ${t.edge}, 0 6px 10px rgba(0,0,0,0.4)`,
  };
}

type PlayerTheme = { light: string; base: string; dark: string; shape: string };

// Rose and gold: the two accents of the theme
const PLAYER_THEMES: PlayerTheme[] = [
  { light: "#fecdd3", base: "#fb7185", dark: "#9f1239", shape: "50%" },
  { light: "#fde68a", base: "#fbbf24", dark: "#92400e", shape: "50%" },
];

// Okabe–Ito blue/orange plus different token shapes, so players never rely on colour alone
const COLOR_BLIND_THEMES: PlayerTheme[] = [
  { light: "#bfe3ff", base: "#3b9ae1", dark: "#0b4f86", shape: "50%" },
  { light: "#ffe0b0", base: "#f0a030", dark: "#8a5200", shape: "22%" },
];

let colorBlind = false;

// Set once per render from the effective accessibility settings
export function setColorBlindPalette(value: boolean) {
  colorBlind = value;
}

export const playerTheme = (index: number) => {
  const list = colorBlind ? COLOR_BLIND_THEMES : PLAYER_THEMES;
  return list[index % list.length];
};
