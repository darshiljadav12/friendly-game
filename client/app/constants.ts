import type { ChallengeType, GameLength, PowerUp, TileType } from "./types";

type ThemeKey = TileType | ChallengeType;

// The board order comes from the server; this only describes how each tile looks
export const TILE_INFO: Record<ThemeKey, { label: string; sub: string }> = {
  start: { label: "START", sub: "+5 & a card each lap" },
  love: { label: "LOVE", sub: "Partner rates your answer" },
  dare: { label: "DARE", sub: "Do it now or save it" },
  memory: { label: "MEMORY", sub: "Partner rates your answer" },
  gift: { label: "GIFT", sub: "A sweet gesture" },
  guess: { label: "GUESS", sub: "Can they guess your answer?" },
  wild: { label: "WILD", sub: "Something random happens" },
  timed: { label: "TIMED", sub: "30s: in time = double" },
  together: { label: "TOGETHER", sub: "Land on your partner" },
};

export const POWER_UP_INFO: Record<PowerUp, { icon: string; name: string; desc: string }> = {
  freePass: { icon: "🎟️", name: "Free Pass", desc: "Skip this challenge and still get its points" },
  reroll: { icon: "🎲", name: "Reroll", desc: "Ignore this tile and roll again" },
  handOff: { icon: "😈", name: "Pass It On", desc: "Your partner has to do this one" },
};

export const REACTIONS = ["😂", "❤️", "😳", "🔥", "😍", "👏"];

export const LENGTH_OPTIONS: { value: GameLength; label: string; coop: boolean }[] = [
  { value: "5", label: "5 rounds", coop: true },
  { value: "10", label: "10 rounds", coop: true },
  { value: "20", label: "20 rounds", coop: true },
  { value: "points150", label: "First to 150", coop: false },
];

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
  start: { light: "#d9a94a", base: "#b8892f", edge: "#6b4d14", icon: "⭐" },
  together: { light: "#e0607e", base: "#b83a5b", edge: "#6a1d33", icon: "💑" },
};

// Raised "block" look: soft highlight on top, solid edge underneath for thickness
export function tileStyle(type: ThemeKey) {
  const t = TILE_THEMES[type];
  return {
    background: `linear-gradient(180deg, ${t.light} 0%, ${t.base} 100%)`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.22), 0 3px 0 ${t.edge}, 0 5px 8px rgba(0,0,0,0.35)`,
  };
}

type PlayerTheme = { light: string; base: string; dark: string };

// Rose and gold: the two accents of the theme
export const PLAYER_THEMES: PlayerTheme[] = [
  { light: "#fecdd3", base: "#fb7185", dark: "#9f1239" },
  { light: "#fde68a", base: "#fbbf24", dark: "#92400e" },
];

export const playerTheme = (index: number) => PLAYER_THEMES[index % PLAYER_THEMES.length];

// Glossy marble look for avatars and tokens
export function sphereStyle(index: number) {
  const t = playerTheme(index);
  return {
    background: `radial-gradient(circle at 32% 28%, ${t.light} 0%, ${t.base} 42%, ${t.dark} 100%)`,
    boxShadow: `inset 0 -3px 6px rgba(0,0,0,0.3), 0 3px 6px rgba(0,0,0,0.45)`,
  };
}
