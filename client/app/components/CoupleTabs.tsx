"use client";

import { useEffect, useState } from "react";
import { request } from "../../lib/couple";
import { BOARD_PRESETS, LENGTH_OPTIONS, TILE_INFO, TILE_THEMES, playerTheme, tileStyle } from "../constants";
import type { AccountSession, AchievementDef, ChallengeType, CoupleOverview, HistoryGame, Memory, SlotStats } from "../types";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const formatTime = (ms: number | string) => new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const nameOf = (overview: CoupleOverview, slot: number | null | undefined) =>
  slot === 0 || slot === 1 ? (overview.members.find((m) => m.slot === slot)?.name ?? "?") : "Both";

function Loading() {
  return <p className="py-6 text-center text-sm text-muted">Loading…</p>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

/* =========================
   HISTORY
========================= */

export function HistoryTab({ session, overview }: { session: AccountSession; overview: CoupleOverview }) {
  const [games, setGames] = useState<HistoryGame[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    request<{ games: HistoryGame[] }>("coupleHistory", session).then((res) => {
      if (res.error) setError(res.error);
      else setGames(res.games);
    });
  }, [session, overview.stats.games]);

  if (error) return <Empty>{error}</Empty>;
  if (!games) return <Loading />;
  if (games.length === 0) return <Empty>No finished games yet. Your first one will show up here.</Empty>;

  return (
    <ul className="space-y-2">
      {games.map((g) => {
        const tie = g.settings.mode === "competitive" && g.winnerSlots.length > 1;
        const result =
          g.settings.mode === "coop"
            ? g.coopWon
              ? "💞 Love meter filled"
              : "🥺 So close"
            : tie
              ? "🤝 Tie"
              : `🏆 ${nameOf(overview, g.winnerSlots[0])} won`;
        const isOpen = open === g._id;

        return (
          <li key={g._id} className="rounded-xl bg-sunken">
            <button onClick={() => setOpen(isOpen ? null : g._id)} className="w-full p-3 text-left" aria-expanded={isOpen}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">{result}</span>
                <span className="text-[11px] text-muted">{formatDate(g.endedAt)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {g.players.map((p) => (
                  <span key={p.slot} style={{ color: playerTheme(p.slot).base }} className="font-semibold">
                    {p.name} {p.score}
                  </span>
                ))}
                <span className="text-muted">
                  {g.settings.mode === "coop" ? "Co-op" : "Competitive"} · {LENGTH_OPTIONS.find((l) => l.value === g.settings.length)?.label} ·{" "}
                  {BOARD_PRESETS.find((b) => b.value === g.settings.board)?.label ?? "Classic"} board
                </span>
                <span className="ml-auto text-muted">{isOpen ? "▴" : "▾"}</span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-line px-3 pb-3">
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  {g.players.map((p) => (
                    <div key={p.slot} className="rounded-lg bg-surface p-2">
                      <p className="font-bold" style={{ color: playerTheme(p.slot).base }}>
                        {p.name}
                      </p>
                      <p className="text-muted">
                        ✅ {p.tally.done} done · ⏭️ {p.tally.skipped} skipped · ❤️ {p.tally.heartsReceived} hearts · 🔮 {p.tally.guessMatches} matches · 🃏{" "}
                        {p.tally.cardsUsed} cards · 🪙 {p.tally.coinsEarned}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="panel-label mt-3 mb-1.5">What happened</p>
                <ol className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  {g.log.map((entry) => (
                    <li key={entry.id} className="flex gap-2 text-xs">
                      <span className="w-14 shrink-0 whitespace-nowrap text-[10px] text-muted">{formatTime(entry.at)}</span>
                      <span>{entry.icon}</span>
                      <span>
                        {entry.text}
                        {entry.detail && <span className="block text-[11px] text-muted">“{entry.detail}”</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* =========================
   MEMORY BOOK
========================= */

type MemoryFilter = "all" | "favorite" | ChallengeType;
const MEMORY_FILTERS: MemoryFilter[] = ["all", "favorite", "love", "memory", "guess", "dare", "gift", "timed", "play", "together"];

export function MemoryBook({ session, overview }: { session: AccountSession; overview: CoupleOverview }) {
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MemoryFilter>("all");

  useEffect(() => {
    request<{ memories: Memory[] }>("coupleMemories", session).then((res) => {
      if (res.error) setError(res.error);
      else setMemories(res.memories);
    });
  }, [session, overview.stats.games]);

  const toggleFavorite = async (m: Memory) => {
    setMemories((list) => list?.map((x) => (x._id === m._id ? { ...x, favorite: !m.favorite } : x)) ?? null);
    await request("coupleFavorite", { session, memoryId: m._id, favorite: !m.favorite });
  };

  if (error) return <Empty>{error}</Empty>;
  if (!memories) return <Loading />;

  const shown = memories.filter((m) => (filter === "all" ? true : filter === "favorite" ? m.favorite : m.type === filter));

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {MEMORY_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              filter === f ? "border-rose bg-rose/15 text-white" : "border-line text-muted hover:text-white"
            }`}
          >
            {f === "all" ? "All" : f === "favorite" ? "⭐ Starred" : `${TILE_THEMES[f].icon} ${TILE_INFO[f].label}`}
          </button>
        ))}
      </div>

      {memories.length === 0 ? (
        <Empty>Your memory book fills up as you play couple games: answers your partner rated, guess rounds, dares you did and notes you typed.</Empty>
      ) : shown.length === 0 ? (
        <Empty>Nothing here yet.</Empty>
      ) : (
        <ul className="space-y-2">
          {shown.map((m) => (
            <li key={m._id} className="rounded-xl bg-sunken p-3">
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm" style={tileStyle(m.type)}>
                  {TILE_THEMES[m.type].icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug">{m.question}</p>

                  {m.type === "guess" ? (
                    <p className="mt-1 text-xs">
                      <span className="text-muted">{nameOf(overview, m.doerGuessed ? m.partnerSlot : m.slot)}:</span> “{m.answer}” ·{" "}
                      <span className="text-muted">{nameOf(overview, m.doerGuessed ? m.slot : m.partnerSlot)} guessed:</span> “{m.guess}” {m.matched ? "✅" : "❌"}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted">
                      {m.type === "together" ? "Done together" : nameOf(overview, m.slot)}
                      {m.hearts ? ` · ${"❤️".repeat(m.hearts)} from ${nameOf(overview, m.partnerSlot)}` : ""}
                      {m.inTime ? " · ⏱️ beat the timer" : ""}
                      {m.saved ? " · ⏳ was saved for later" : ""}
                    </p>
                  )}
                  {m.note && <p className="mt-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-xs italic">“{m.note}”</p>}
                  <p className="mt-1 text-[10px] text-muted">{formatDate(m.createdAt)}</p>
                </div>
                <button
                  onClick={() => toggleFavorite(m)}
                  className="text-lg leading-none"
                  aria-label={m.favorite ? "Unstar" : "Star"}
                  title={m.favorite ? "Unstar" : "Star this memory"}
                >
                  {m.favorite ? "⭐" : "☆"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* =========================
   STATS
========================= */

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "–");

function favoriteType(stats: SlotStats) {
  const entries = Object.entries(stats.byType) as [ChallengeType, number][];
  if (entries.length === 0) return "–";
  const [type] = entries.sort((a, b) => b[1] - a[1])[0];
  return `${TILE_THEMES[type].icon} ${TILE_INFO[type].label}`;
}

export function StatsTab({ overview }: { overview: CoupleOverview }) {
  const { stats } = overview;
  if (stats.games === 0) return <Empty>Play a couple game to start your stats.</Empty>;

  const rows: [string, (s: SlotStats) => string | number][] = [
    ["🏆 Wins", (s) => s.wins],
    ["⭐ Total points", (s) => s.points],
    ["🥇 Best score", (s) => s.bestScore],
    ["✅ Challenges done", (s) => s.done],
    ["⏭️ Skip rate", (s) => pct(s.skipped, s.done + s.skipped)],
    ["❤️ Avg hearts received", (s) => (s.ratingsReceived ? (s.heartsReceived / s.ratingsReceived).toFixed(1) : "–")],
    ["😍 Perfect 3-heart answers", (s) => s.threeHearts],
    ["🔮 Guess matches", (s) => `${s.guessMatches} (${pct(s.guessMatches, s.guessRounds)})`],
    ["⏱️ Timers beaten", (s) => s.timedInTime],
    ["🎮 Mini-games played", (s) => s.minigames ?? 0],
    ["⏳ Dares saved", (s) => s.saved],
    ["💌 IOU dares kept", (s) => s.iouDone],
    ["🃏 Cards played", (s) => s.cardsUsed],
    ["🪙 Coins earned / spent", (s) => `${s.coinsEarned} / ${s.coinsSpent}`],
    ["🎲 Sixes rolled", (s) => s.sixes],
    ["🌍 Laps", (s) => s.laps],
    ["📖 Memory notes", (s) => s.notes],
    ["💗 Favourite tile", favoriteType],
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-sunken p-3">
          <p className="text-2xl font-black text-gold">{stats.games}</p>
          <p className="text-[11px] text-muted">games together</p>
        </div>
        <div className="rounded-xl bg-sunken p-3">
          <p className="text-2xl font-black text-rose">
            {stats.coopWins}/{stats.coopGames}
          </p>
          <p className="text-[11px] text-muted">co-op wins</p>
        </div>
        <div className="rounded-xl bg-sunken p-3">
          <p className="text-2xl font-black">{stats.ties}</p>
          <p className="text-[11px] text-muted">ties</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-sunken">
              <th className="p-2 text-left font-semibold text-muted">Stat</th>
              {overview.members.map((m) => (
                <th key={m.slot} className="p-2 text-right font-bold" style={{ color: playerTheme(m.slot).base }}>
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-t border-line">
                <td className="p-2">{label}</td>
                {overview.members.map((m) => (
                  <td key={m.slot} className="p-2 text-right font-mono">
                    {value(stats.slots[String(m.slot) as "0" | "1"])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================
   ACHIEVEMENTS
========================= */

export function AchievementsTab({ overview, definitions }: { overview: CoupleOverview; definitions: AchievementDef[] }) {
  const total = definitions.length * 2;
  const unlocked = Object.keys(overview.achievements["0"]).length + Object.keys(overview.achievements["1"]).length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        {unlocked} of {total} unlocked between you. Game badges are checked when a game ends; the 📅 ones count across all your games.
      </p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {definitions.map((a) => {
          const owners = overview.members.filter((m) => overview.achievements[String(m.slot) as "0" | "1"][a.id]);
          return (
            <li key={a.id} className={`flex gap-2.5 rounded-xl p-3 ${owners.length ? "bg-gold/10 border border-gold/30" : "bg-sunken opacity-70"}`}>
              <span className={`text-2xl ${owners.length ? "" : "grayscale"}`}>{a.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-bold">
                  {a.name} {a.scope === "lifetime" && <span title="Counts across all games">📅</span>}
                </p>
                <p className="text-[11px] text-muted">{a.desc}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {overview.members.map((m) => {
                    const at = overview.achievements[String(m.slot) as "0" | "1"][a.id];
                    return (
                      <span
                        key={m.slot}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${at ? "text-[#1b1020]" : "border border-line text-muted"}`}
                        style={at ? { background: playerTheme(m.slot).base } : undefined}
                        title={at ? `Unlocked ${formatDate(at)}` : "Locked"}
                      >
                        {at ? "✓" : "🔒"} {m.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* =========================
   IOU WALLET
========================= */

export function IouWallet({
  session,
  slot,
  overview,
  compact = false,
}: {
  session: AccountSession;
  slot: 0 | 1;
  overview: CoupleOverview;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const complete = async (id: string) => {
    setBusy(id);
    setError(null);
    const res = await request("coupleCompleteIou", { session, iouId: id });
    setBusy(null);
    if (res.error) setError(res.error);
  };

  if (overview.iou.length === 0) {
    return compact ? null : <Empty>Nothing owed 🎉 Dares and gifts you save for later and don&apos;t finish in a game land here.</Empty>;
  }

  return (
    <div className="space-y-2">
      {!compact && (
        <p className="text-xs text-muted">
          Dares and gifts saved in past games and not done yet. When you&apos;ve done one for real, tap Done. No points, but it counts for 💌 Promise Keeper.
        </p>
      )}
      {error && <p className="text-xs text-rose">{error}</p>}
      <ul className="space-y-2">
        {overview.iou.map((d) => {
          const mine = d.ownerSlot === slot;
          const type = d.type ?? "dare";
          return (
            <li key={d.id} className="rounded-xl bg-sunken p-3 border-l-4" style={{ borderLeftColor: playerTheme(d.ownerSlot).base }}>
              <p className="text-sm leading-snug">
                <span aria-label={TILE_INFO[type].label}>{TILE_THEMES[type].icon}</span> {d.question}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-muted">
                  {mine ? "You owe this" : `${nameOf(overview, d.ownerSlot)} owes you`} · since {formatDate(d.createdAt)}
                </span>
                {mine && (
                  <button onClick={() => complete(d.id)} disabled={busy === d.id} className="btn btn-primary px-3 py-1 text-xs">
                    {busy === d.id ? "…" : "Done"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
