// Achievement definitions.
// "game" ones are checked against one player's tally for the game that just ended.
// "lifetime" ones are checked against a couple member's saved stats (couple games only).

const ACHIEVEMENTS = [
  // ---- in a single game ----
  { id: "first_win", icon: "🏆", name: "First Victory", desc: "Win a competitive game", scope: "game", check: (t, g) => g.mode === "competitive" && g.won && !g.tie },
  { id: "dream_team", icon: "💞", name: "Dream Team", desc: "Fill the love meter in a co-op game", scope: "game", check: (t, g) => g.mode === "coop" && g.coopWon },
  { id: "century", icon: "💯", name: "Century", desc: "Score 100+ points in one game", scope: "game", check: (t, g) => g.score >= 100 },
  { id: "heart_throb", icon: "😍", name: "Heart Throb", desc: "Get 3 hearts three times in one game", scope: "game", check: (t) => t.threeHearts >= 3 },
  { id: "mind_reader", icon: "🔮", name: "Mind Reader", desc: "Match 3 guess questions in one game", scope: "game", check: (t) => t.guessMatches >= 3 },
  { id: "no_excuses", icon: "💪", name: "No Excuses", desc: "Finish a game without skipping anything", scope: "game", check: (t) => t.skipped === 0 && t.done >= 3 },
  { id: "dare_devil", icon: "😈", name: "Dare Devil", desc: "Complete 4 dares in one game", scope: "game", check: (t) => (t.byType.dare || 0) >= 4 },
  { id: "speed_demon", icon: "⚡", name: "Speed Demon", desc: "Beat the timer twice in one game", scope: "game", check: (t) => t.timedInTime >= 2 },
  { id: "card_shark", icon: "🃏", name: "Card Shark", desc: "Play 2 power-up cards in one game", scope: "game", check: (t) => t.cardsUsed >= 2 },
  { id: "lucky_sixes", icon: "🎲", name: "Lucky Sixes", desc: "Roll three 6s in one game", scope: "game", check: (t) => t.sixes >= 3 },
  { id: "globetrotter", icon: "🌍", name: "Globetrotter", desc: "Pass START 3 times in one game", scope: "game", check: (t) => t.laps >= 3 },
  { id: "game_night", icon: "🎮", name: "Game Night", desc: "Play 3 mini-games in one game", scope: "game", check: (t) => (t.minigames || 0) >= 3 },
  { id: "big_spender", icon: "🛍️", name: "Big Spender", desc: "Spend 20 coins in one game", scope: "game", check: (t) => t.coinsSpent >= 20 },

  // ---- across all couple games ----
  { id: "regulars", icon: "📅", name: "Regulars", desc: "Play 10 games together", scope: "lifetime", check: (s, c) => c.games >= 10 },
  { id: "promise_keeper", icon: "💌", name: "Promise Keeper", desc: "Complete 5 saved dares or gifts from the IOU wallet", scope: "lifetime", check: (s) => s.iouDone >= 5 },
  { id: "soulmates", icon: "🫶", name: "Soulmates", desc: "Match 20 guess questions in total", scope: "lifetime", check: (s) => s.guessMatches >= 20 },
  { id: "storyteller", icon: "📖", name: "Storyteller", desc: "Add 10 notes to the memory book", scope: "lifetime", check: (s) => s.notes >= 10 },
];

const byId = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// Public definitions for the client (no functions)
const definitions = () => ACHIEVEMENTS.map(({ id, icon, name, desc, scope }) => ({ id, icon, name, desc, scope }));

function gameAchievements(tally, gameInfo) {
  return ACHIEVEMENTS.filter((a) => a.scope === "game" && a.check(tally, gameInfo)).map((a) => a.id);
}

function lifetimeAchievements(slotStats, coupleStats) {
  return ACHIEVEMENTS.filter((a) => a.scope === "lifetime" && a.check(slotStats, coupleStats)).map((a) => a.id);
}

module.exports = { ACHIEVEMENTS, byId, definitions, gameAchievements, lifetimeAchievements };
