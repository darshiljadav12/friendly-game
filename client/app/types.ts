export type TileType = "start" | "love" | "dare" | "memory" | "gift" | "guess" | "wild" | "timed" | "play";

export type PlayableTile = Exclude<TileType, "start">;

export type ChallengeType = Exclude<TileType, "start" | "wild"> | "together";

export type PowerUp = "freePass" | "reroll" | "handOff" | "shield" | "mirror" | "teleport";

// A dare or gift put off with "Save for later"
export type SavedDare = {
  id: string;
  type?: "dare" | "gift"; // missing on older saves (always dares)
  question: string;
  points: number;
};

export type Tally = {
  done: number;
  skipped: number;
  saved: number;
  byType: Partial<Record<ChallengeType, number>>;
  heartsReceived: number;
  ratingsReceived: number;
  threeHearts: number;
  guessMatches: number;
  guessRounds: number;
  timedInTime: number;
  cardsUsed: number;
  coinsEarned: number;
  coinsSpent: number;
  sixes: number;
  laps: number;
  notes: number;
  minigames?: number; // missing on older games
};

export type Player = {
  id: string;
  username: string;
  avatar: string; // board piece emoji
  slot: 0 | 1 | null;
  connected: boolean;
  position: number;
  score: number;
  coins: number;
  shopOpen: boolean; // after passing START, until this player rolls again
  turnsTaken: number;
  savedDares: SavedDare[];
  powerUps: PowerUp[];
  doubleNext: boolean;
  tally: Tally;
};

export type Challenge = {
  type: ChallengeType;
  question: string;
  points: number;
  ownerId: string; // who landed on it
  playerId: string; // who has to do it
  stage: "pending" | "rating" | "timing" | "guessing" | "reveal" | "picking" | "writing" | "drawing" | "results";
  handedOff: boolean;
  mirror: boolean;
  cardUsed: boolean;
  remainingMs: number | null;
  hasAnswer: boolean;
  hasGuess: boolean;
  answer: string | null;
  guess: string | null;
  confirmed: string[];
  mini: MiniGameState | null; // 🎮 PLAY tile only
};

export type MiniGameName = "thisOrThat" | "neverEver" | "mostLikely" | "finish" | "draw";

export type MiniGameState = {
  game: MiniGameName;
  prompt: string | null; // Finish My Sentence starter
  items: { text: string; options: [string, string] }[] | null; // the pick games
  picked: string[]; // who has locked in their picks
  picks: Record<string, number[]> | null; // revealed with the results
  guesses: string[]; // Draw It: wrong guesses so far
  word: string | null; // Draw It: revealed with the results
  result: { matches?: number; guessed?: boolean; points: Record<string, number> } | null;
};

export type Stroke = { points: [number, number][]; color: string; size: number };

export type GameMode = "competitive" | "coop";

export type GameLength = "5" | "10" | "20" | "points150";

export type BoardPreset = "classic" | "romantic" | "daring" | "chill" | "random" | "custom" | "ours"; // ours = the couple admin's exact tile counts

export type ThemeName = "warm" | "ocean" | "forest" | "festive" | "midnight" | "sakura" | "sunset" | "lavender" | "mint" | "noir";

export type A11yKey = "reduceMotion" | "largeText" | "highContrast" | "colorBlind";

export type A11y = Record<A11yKey, boolean>;

export type BoardSettings = {
  preset: BoardPreset;
  weights: Partial<Record<PlayableTile, number>> | null;
};

export type Settings = {
  mode: GameMode;
  length: GameLength;
  rounds: number | null;
  target: number | null;
  coopGoal: number | null;
  board: BoardSettings;
  theme: ThemeName;
  a11y: A11y;
};

// What the creator picks before the room exists
export type NewGameSettings = {
  mode: GameMode;
  length: GameLength;
  board: BoardSettings;
  theme: ThemeName;
  a11y: A11y;
};

export type GameEvent = {
  id: number;
  playerId: string;
  text: string;
};

export type LogEntry = {
  id: number;
  at: number;
  playerId: string | null;
  icon: string;
  text: string;
  detail: string | null;
};

export type Results = {
  achievements: Record<string, string[]>; // playerId -> earned this game
  newlyUnlocked: Record<string, string[]> | null; // couple games: first time ever
};

export type GameState = {
  id: string;
  phase: "waiting" | "playing" | "finished";
  settings: Settings;
  board: TileType[];
  isCouple: boolean;
  creatorId: string | null; // only the creator can change theme / accessibility mid-game
  turn: number;
  freeRoll: boolean;
  challenge: Challenge | null;
  event: GameEvent | null;
  log: LogEntry[];
  winnerIds: string[];
  coopWon: boolean | null;
  results: Results | null;
  players: Player[];
};

export type Move = {
  playerId: string;
  dice: number | null; // null for a teleport
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

export type AchievementDef = {
  id: string;
  icon: string;
  name: string;
  desc: string;
  scope: "game" | "lifetime";
};

// A tab in the avatar picker
export type AvatarGroup = { id: string; name: string; icon: string; avatars: string[] };

export type Meta = {
  achievements: AchievementDef[];
  powerUps: Record<PowerUp, { name: string; icon: string; price: number }>;
  avatars?: string[];
  avatarGroups?: AvatarGroup[];
  persistent: boolean;
};

/* ---------- accounts + couple profile ---------- */

// Saved on the device after signing up / logging in
export type AccountSession = {
  username: string;
  token: string;
};

// What the server returns for the logged-in account
export type AccountView = {
  user: { username: string; name: string; avatar: string | null };
  slot: 0 | 1 | null; // seat in the couple, null until linked
  overview: CoupleOverview | null;
};

export type SlotStats = Omit<Tally, "byType"> & {
  games: number;
  wins: number;
  points: number;
  bestScore: number;
  iouDone: number;
  byType: Partial<Record<ChallengeType, number>>;
};

export type IouDare = SavedDare & {
  ownerSlot: 0 | 1;
  createdAt: string;
};

export type CoupleOverview = {
  code: string;
  members: { slot: 0 | 1; name: string }[];
  iou: IouDare[];
  stats: {
    games: number;
    coopGames: number;
    coopWins: number;
    ties: number;
    slots: Record<"0" | "1", SlotStats>;
  };
  achievements: Record<"0" | "1", Record<string, string>>; // id -> unlocked date
  activeRoomId: string | null;
  createdAt: string;
  custom: CustomSummary | null; // the admin's game setup
};

/* ---------- couple admin panel ---------- */

export type QuestionListKey =
  | "love"
  | "dare"
  | "memory"
  | "gift"
  | "guess"
  | "timed"
  | "together"
  | "finish"
  | "neverEver"
  | "mostLikely"
  | "thisOrThat"
  | "draw";

// This or That entries are pairs, everything else is plain text
export type QuestionEntry = string | [string, string];

export type CustomSetup = {
  counts: Record<PlayableTile, number> | null; // null = use the normal board presets
  miniGames: MiniGameName[];
  questions: Partial<Record<QuestionListKey, QuestionEntry[]>>; // a list here replaces the built-in one
  theme: ThemeName;
  updatedAt?: string;
};

export type CustomSummary = {
  counts: Record<PlayableTile, number> | null;
  miniGames: MiniGameName[];
  theme: ThemeName;
  questionCounts: Partial<Record<QuestionListKey, number>>;
  updatedAt: string;
};

export type HistoryGame = {
  _id: string;
  startedAt: string;
  endedAt: string;
  settings: { mode: GameMode; length: GameLength; board: BoardPreset; theme: ThemeName };
  players: { slot: 0 | 1; name: string; score: number; coins: number; tally: Tally }[];
  winnerSlots: (0 | 1)[];
  coopWon: boolean | null;
  coopGoal: number | null;
  log: (Omit<LogEntry, "playerId"> & { slot: 0 | 1 | null })[];
};

export type Memory = {
  _id: string;
  type: ChallengeType;
  question: string;
  slot: 0 | 1 | null;
  partnerSlot: 0 | 1 | null;
  answer?: string | null;
  guess?: string | null;
  matched?: boolean;
  doerGuessed?: boolean; // Guess rounds: the player who landed guessed (older memories: their partner did)
  hearts?: number;
  note?: string | null;
  inTime?: boolean;
  saved?: boolean;
  createdAt: string;
  favorite: boolean;
};
