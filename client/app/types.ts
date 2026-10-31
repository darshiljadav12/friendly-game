export type TileType = "start" | "love" | "dare" | "memory" | "gift" | "guess" | "wild" | "timed";

export type ChallengeType = Exclude<TileType, "start" | "wild"> | "together";

export type PowerUp = "freePass" | "reroll" | "handOff";

export type SavedDare = {
  id: string;
  question: string;
  points: number;
};

export type Player = {
  id: string;
  username: string;
  connected: boolean;
  position: number;
  score: number;
  turnsTaken: number;
  savedDares: SavedDare[];
  powerUps: PowerUp[];
  doubleNext: boolean;
};

export type Challenge = {
  type: ChallengeType;
  question: string;
  points: number;
  ownerId: string; // who landed on it
  playerId: string; // who has to do it
  stage: "pending" | "rating" | "timing" | "guessing" | "reveal";
  handedOff: boolean;
  remainingMs: number | null;
  hasAnswer: boolean;
  hasGuess: boolean;
  answer: string | null;
  guess: string | null;
  confirmed: string[];
};

export type GameMode = "competitive" | "coop";

export type GameLength = "5" | "10" | "20" | "points150";

export type Settings = {
  mode: GameMode;
  length: GameLength;
  rounds: number | null;
  target: number | null;
  coopGoal: number | null;
};

export type GameEvent = {
  id: number;
  playerId: string;
  text: string;
};

export type GameState = {
  id: string;
  phase: "waiting" | "playing" | "finished";
  settings: Settings;
  board: TileType[];
  turn: number;
  freeRoll: boolean;
  challenge: Challenge | null;
  event: GameEvent | null;
  winnerIds: string[];
  coopWon: boolean | null;
  players: Player[];
};

export type Move = {
  playerId: string;
  dice: number;
  steps: number[];
};

export type RoomUpdate = {
  state: GameState;
  move: Move | null;
};

export type Reaction = {
  id: string;
  playerId: string;
  emoji: string;
};
