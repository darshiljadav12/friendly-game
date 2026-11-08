"use client";

import { useEffect, useRef, useState } from "react";
import { MINI_GAME_INFO, PLAYABLE_TILES, THEMES, TILE_INFO, TILE_THEMES, tileStyle } from "../constants";
import { request } from "../../lib/couple";
import { QUESTION_COLUMNS, downloadQuestionSheet, readQuestionFile } from "../../lib/questionSheet";
import type { AccountSession, CoupleOverview, CustomSetup, MiniGameName, PlayableTile, QuestionEntry, QuestionListKey } from "../types";

const BOARD_TILES = 27; // around START
const ALL_MINI_GAMES = Object.keys(MINI_GAME_INFO) as MiniGameName[];
const EVEN_SPLIT: Record<PlayableTile, number> = { love: 4, memory: 4, dare: 4, gift: 3, guess: 3, timed: 3, play: 3, wild: 3 };

const EMPTY_SETUP: CustomSetup = { counts: null, miniGames: ALL_MINI_GAMES, questions: {}, theme: "warm" };

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-line bg-sunken/60 p-3">
    <p className="panel-label">{title}</p>
    {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    <div className="mt-2.5">{children}</div>
  </section>
);

// The couple creator's admin panel: own board, questions (Excel/CSV), mini-games and theme.
// The partner sees the same panel read-only.
export default function AdminPanel({ session, overview }: { session: AccountSession; overview: CoupleOverview }) {
  const [draft, setDraft] = useState<CustomSetup | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const adminName = overview.members.find((m) => m.slot === 0)?.name ?? "The couple creator";

  // Load the saved setup (again whenever it changes on the server and nothing is being edited)
  useEffect(() => {
    if (dirty) return;
    request<{ custom: CustomSetup | null; isAdmin: boolean }>("coupleCustom", session).then((res) => {
      if (res.error) return setStatus({ ok: false, text: res.error });
      setDraft(res.custom ?? EMPTY_SETUP);
      setIsAdmin(res.isAdmin);
    });
  }, [session, overview.custom?.updatedAt, dirty]);

  if (!draft) return <p className="py-6 text-center text-xs text-muted">Loading your game setup…</p>;

  const edit = (patch: Partial<CustomSetup>) => {
    setDraft({ ...draft, ...patch });
    setDirty(true);
    setStatus(null);
  };

  const counts = draft.counts;
  const total = counts ? PLAYABLE_TILES.reduce((sum, t) => sum + (counts[t] ?? 0), 0) : BOARD_TILES;
  const setCount = (type: PlayableTile, n: number) => counts && edit({ counts: { ...counts, [type]: Math.max(0, Math.min(BOARD_TILES, n)) } });
  const playOff = counts?.play === 0;
  const noMiniGames = draft.miniGames.length === 0 && !playOff;
  const canSave = isAdmin && dirty && total === BOARD_TILES && !noMiniGames && !saving;

  const toggleMiniGame = (game: MiniGameName) =>
    edit({ miniGames: draft.miniGames.includes(game) ? draft.miniGames.filter((g) => g !== game) : [...draft.miniGames, game] });

  const upload = async (file: File) => {
    try {
      const { questions, ignoredColumns } = await readQuestionFile(file);
      const found = Object.entries(questions) as [QuestionListKey, string[]][];
      if (found.length === 0) {
        setStatus({ ok: false, text: "No question columns found. Use the template's column names (Love, Dare, Guess…) in the first row." });
        return;
      }
      edit({ questions: { ...draft.questions, ...questions } });
      const summary = found.map(([key, list]) => `${QUESTION_COLUMNS.find((c) => c.key === key)?.header} (${list.length})`).join(", ");
      setStatus({
        ok: true,
        text: `Read ${summary}.${ignoredColumns.length ? ` Ignored columns: ${ignoredColumns.join(", ")}.` : ""} Tap Save to use them.`,
      });
    } catch {
      setStatus({ ok: false, text: "Couldn't read that file. Upload an .xlsx or .csv file (you can start from the template)." });
    }
  };

  const downloadTemplate = async () => {
    const res = await request<{ questions: Partial<Record<QuestionListKey, QuestionEntry[]>> }>("questionDefaults", null);
    if (res.error) return setStatus({ ok: false, text: res.error });
    // your own lists where you have them, the built-in ones elsewhere: a ready-to-edit starting point
    await downloadQuestionSheet({ ...res.questions, ...draft.questions }, "friendly-game-questions.xlsx");
  };

  const save = async () => {
    setSaving(true);
    const res = await request<{ ok: boolean }>("coupleSaveCustom", { session, custom: draft });
    setSaving(false);
    if (res.error) return setStatus({ ok: false, text: res.error });
    setDirty(false);
    setStatus({ ok: true, text: "Saved! New games use this setup." });
  };

  const resetAll = async () => {
    if (!window.confirm("Go back to the built-in board, questions, mini-games and theme?")) return;
    const res = await request<{ ok: boolean }>("coupleResetCustom", session);
    if (res.error) return setStatus({ ok: false, text: res.error });
    setDraft(EMPTY_SETUP);
    setDirty(false);
    setStatus({ ok: true, text: "Back to the built-in setup." });
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted">
        {isAdmin
          ? "You're the admin of your couple. Changes apply to new games (a game that's already running keeps its setup)."
          : `${adminName} manages your game setup. You can look, but only they can change it.`}
      </p>

      <fieldset disabled={!isAdmin} className="space-y-3 disabled:opacity-80">
        {/* BOARD */}
        <Section title="🎲 Board" hint="Choose exactly how many tiles of each type go around the board. 0 turns a tile off.">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={Boolean(counts)}
              onChange={(e) => edit({ counts: e.target.checked ? { ...EVEN_SPLIT } : null })}
              className="accent-[var(--rose)]"
            />
            <span className="font-semibold">Use our own board</span>
            <span className="text-muted">(otherwise the normal board styles)</span>
          </label>

          {counts && (
            <div className="mt-2.5 space-y-1.5">
              {PLAYABLE_TILES.map((type) => (
                <div key={type} className={`flex items-center gap-2 text-xs ${counts[type] === 0 ? "opacity-50" : ""}`}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs" style={tileStyle(type)}>
                    {TILE_THEMES[type].icon}
                  </span>
                  <span className="w-16 font-semibold">{TILE_INFO[type].label}</span>
                  <button type="button" onClick={() => setCount(type, counts[type] - 1)} className="btn btn-secondary h-7 w-7 text-sm" aria-label={`Fewer ${TILE_INFO[type].label} tiles`}>
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={BOARD_TILES}
                    value={counts[type]}
                    onChange={(e) => setCount(type, Number(e.target.value) || 0)}
                    className="field w-12 px-1 py-1 text-center font-mono"
                    aria-label={`${TILE_INFO[type].label} tiles`}
                  />
                  <button type="button" onClick={() => setCount(type, counts[type] + 1)} className="btn btn-secondary h-7 w-7 text-sm" aria-label={`More ${TILE_INFO[type].label} tiles`}>
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setCount(type, 0)}
                    className="ml-auto text-[10px] text-muted underline hover:text-white disabled:no-underline"
                    disabled={counts[type] === 0}
                  >
                    {counts[type] === 0 ? "off" : "turn off"}
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1 text-xs">
                <span className={total === BOARD_TILES ? "text-gold font-bold" : "text-rose font-bold"}>
                  {total} / {BOARD_TILES} tiles {total < BOARD_TILES ? `· add ${BOARD_TILES - total} more` : total > BOARD_TILES ? `· remove ${total - BOARD_TILES}` : "✓"}
                </span>
                <button type="button" onClick={() => edit({ counts: { ...EVEN_SPLIT } })} className="text-[11px] text-muted underline hover:text-white">
                  Even mix
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* MINI-GAMES */}
        <Section title="🎮 Mini-games" hint={playOff ? "PLAY tiles are off on your board, so no mini-games come up." : "Which mini-games the PLAY tile can pick."}>
          <div className="grid grid-cols-2 gap-1.5">
            {ALL_MINI_GAMES.map((game) => {
              const on = draft.miniGames.includes(game);
              return (
                <label key={game} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2 text-xs ${on ? "border-rose bg-rose/10" : "border-line bg-surface"}`}>
                  <input type="checkbox" checked={on} onChange={() => toggleMiniGame(game)} className="accent-[var(--rose)]" />
                  {MINI_GAME_INFO[game].icon} {MINI_GAME_INFO[game].title}
                </label>
              );
            })}
          </div>
          {noMiniGames && <p className="mt-2 text-[11px] text-rose">Turn on at least one mini-game, or set PLAY tiles to 0.</p>}
        </Section>

        {/* QUESTIONS */}
        <Section
          title="📝 Questions"
          hint="Upload an Excel (.xlsx) or CSV file: column names in the first row, one question per row. A list you upload replaces the built-in questions of that type."
        >
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-primary px-3 py-2 text-xs">
              ⬆️ Upload sheet
            </button>
            <button type="button" onClick={downloadTemplate} className="btn btn-secondary px-3 py-2 text-xs">
              ⬇️ Download template
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
                e.target.value = "";
              }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-muted">
            The template comes filled with the current questions, so you can edit it and upload it back. This or That: write both options in one cell, like “Beach / Mountains”.
          </p>
          <p className="mt-1.5 rounded-lg bg-surface px-2.5 py-2 text-[11px]">
            ✍️ Write each card for the player <b>whose turn it is</b> (“you”), and put <b className="text-gold">{"{partner}"}</b> where the other person&apos;s name goes. It becomes their real name in the game, e.g. “What do you love most about {"{partner}"}?”. <b>Guess</b> questions are about the partner: “What&apos;s {"{partner}"}&apos;s favourite food?” (you guess, they have the real answer).
          </p>

          <ul className="mt-2.5 divide-y divide-line rounded-xl border border-line bg-surface">
            {QUESTION_COLUMNS.map((c) => {
              const own = draft.questions[c.key]?.length ?? 0;
              return (
                <li key={c.key} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                  <span aria-hidden>{c.icon}</span>
                  <span className="font-semibold">{c.header}</span>
                  <span className={`ml-auto ${own ? "text-gold font-bold" : "text-muted"}`}>{own ? `Yours (${own})` : "Built-in"}</span>
                  {own > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...draft.questions };
                        delete next[c.key];
                        edit({ questions: next });
                      }}
                      className="text-[10px] text-muted underline hover:text-white"
                      aria-label={`Use the built-in ${c.header} questions again`}
                    >
                      use built-in
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>

        {/* THEME */}
        <Section title="🎨 Theme" hint="The theme new games start with (the game's creator can still change it during a game).">
          <div className="grid grid-cols-5 gap-1.5">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => edit({ theme: t.value })}
                aria-pressed={draft.theme === t.value}
                className={`rounded-xl border p-1.5 text-center transition-colors ${draft.theme === t.value ? "border-gold" : "border-line hover:border-line-strong"}`}
              >
                <span className="mx-auto block h-6 w-full rounded-lg" style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 40%, ${t.swatch[1]})` }} />
                <span className="mt-1 block text-[10px] font-semibold">{t.label}</span>
              </button>
            ))}
          </div>
        </Section>
      </fieldset>

      {status && (
        <p className={`rounded-xl border px-3 py-2 text-xs ${status.ok ? "border-gold/40 bg-gold/10" : "border-rose/40 bg-rose/10"}`} role="status">
          {status.text}
        </p>
      )}

      {isAdmin && (
        <div className="space-y-2">
          <button onClick={save} disabled={!canSave} className="btn btn-primary w-full p-3">
            {saving ? "Saving…" : dirty ? "💾 Save setup" : "Saved"}
          </button>
          <button onClick={resetAll} className="w-full text-center text-[11px] text-muted underline hover:text-white">
            Reset everything to the built-in setup
          </button>
        </div>
      )}
    </div>
  );
}
