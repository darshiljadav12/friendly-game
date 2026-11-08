"use client";

import { A11Y_OPTIONS, BOARD_PRESETS, LENGTH_OPTIONS, PLAYABLE_TILES, THEMES, TILE_INFO, TILE_THEMES, tileStyle } from "../constants";
import type { GameMode, NewGameSettings, PlayableTile } from "../types";

const MODES: { value: GameMode; icon: string; label: string; desc: string }[] = [
  { value: "competitive", icon: "🏆", label: "Competitive", desc: "Highest score wins" },
  { value: "coop", icon: "💞", label: "Co-op", desc: "Fill the love meter together" },
];

const DEFAULT_WEIGHTS: Record<PlayableTile, number> = { love: 2, memory: 2, dare: 2, gift: 1, guess: 1, timed: 1, play: 1, wild: 1 };

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
    active ? "border-gold bg-gold/15 text-gold" : "border-line text-muted hover:text-white"
  }`;

export default function GameSettings({
  value,
  onChange,
  ourBoard = null,
}: {
  value: NewGameSettings;
  onChange: (next: NewGameSettings) => void;
  ourBoard?: Record<PlayableTile, number> | null; // the couple admin's exact tile counts, when set
}) {
  const set = (patch: Partial<NewGameSettings>) => onChange({ ...value, ...patch });

  const chooseMode = (mode: GameMode) => {
    // "First to N points" has no end in co-op, so fall back to rounds
    const lengthOk = LENGTH_OPTIONS.find((o) => o.value === value.length)?.coop;
    set({ mode, length: mode === "coop" && !lengthOk ? "10" : value.length });
  };

  const weights = { ...DEFAULT_WEIGHTS, ...(value.board.weights ?? {}) };
  const setWeight = (type: PlayableTile, n: number) =>
    set({ board: { preset: "custom", weights: { ...weights, [type]: n } } });
  const allZero = PLAYABLE_TILES.every((t) => !weights[t]);

  return (
    <div className="space-y-4">
      {/* MODE */}
      <div className="grid grid-cols-2 gap-2">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => chooseMode(m.value)}
            aria-pressed={value.mode === m.value}
            className={`rounded-xl border p-2.5 text-left transition-colors ${
              value.mode === m.value ? "border-rose bg-rose/15" : "border-line bg-surface hover:border-line-strong"
            }`}
          >
            <div className="text-sm font-bold">
              {m.icon} {m.label}
            </div>
            <div className="text-[11px] text-muted mt-0.5">{m.desc}</div>
          </button>
        ))}
      </div>

      {/* LENGTH */}
      <fieldset>
        <legend className="panel-label mb-1.5">Length</legend>
        <div className="flex flex-wrap gap-1.5">
          {LENGTH_OPTIONS.map((o) => {
            const disabled = value.mode === "coop" && !o.coop;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => set({ length: o.value })}
                disabled={disabled}
                aria-pressed={value.length === o.value}
                title={disabled ? "Co-op games use rounds" : undefined}
                className={chip(value.length === o.value)}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* BOARD */}
      <fieldset>
        <legend className="panel-label mb-1.5">Board</legend>
        {ourBoard && (
          <button
            type="button"
            onClick={() => set({ board: { preset: "ours", weights: null } })}
            aria-pressed={value.board.preset === "ours"}
            className={`mb-1.5 w-full rounded-xl border px-2.5 py-2 text-left transition-colors ${
              value.board.preset === "ours" ? "border-gold bg-gold/10" : "border-line bg-surface hover:border-line-strong"
            }`}
          >
            <div className="text-xs font-bold">⭐ Our board</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {PLAYABLE_TILES.filter((t) => ourBoard[t] > 0).map((t) => (
                <span key={t} className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={tileStyle(t)}>
                  {TILE_THEMES[t].icon} {ourBoard[t]}
                </span>
              ))}
            </div>
          </button>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {BOARD_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => set({ board: { preset: p.value, weights: p.value === "custom" ? weights : null } })}
              aria-pressed={value.board.preset === p.value}
              title={p.desc}
              className={`rounded-xl border px-2 py-1.5 text-left transition-colors ${
                value.board.preset === p.value ? "border-gold bg-gold/10" : "border-line bg-surface hover:border-line-strong"
              }`}
            >
              <div className="text-xs font-bold">
                {p.icon} {p.label}
              </div>
              <div className="text-[10px] leading-tight text-muted">{p.desc}</div>
            </button>
          ))}
        </div>

        {value.board.preset === "custom" && (
          <div className="mt-2 space-y-1.5 rounded-xl border border-line bg-sunken p-3">
            <p className="text-[11px] text-muted">How often each tile appears (0 = never)</p>
            {PLAYABLE_TILES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-xs">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs" style={tileStyle(type)}>
                  {TILE_THEMES[type].icon}
                </span>
                <span className="w-16 font-semibold">{TILE_INFO[type].label}</span>
                <input
                  type="range"
                  min={0}
                  max={5}
                  value={weights[type]}
                  onChange={(e) => setWeight(type, Number(e.target.value))}
                  className="flex-1 accent-[var(--rose)]"
                  aria-label={`${TILE_INFO[type].label} amount`}
                />
                <span className="w-3 text-right font-mono text-muted">{weights[type]}</span>
              </label>
            ))}
            {allZero && <p className="text-[11px] text-rose">Pick at least one tile, or the Classic board is used</p>}
          </div>
        )}
      </fieldset>

      {/* THEME */}
      <fieldset>
        <legend className="panel-label mb-1.5">Theme</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => set({ theme: t.value })}
              aria-pressed={value.theme === t.value}
              className={`rounded-xl border p-1.5 text-center transition-colors ${
                value.theme === t.value ? "border-gold" : "border-line hover:border-line-strong"
              }`}
            >
              <span
                className="mx-auto block h-6 w-full rounded-lg"
                style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 40%, ${t.swatch[1]})` }}
              />
              <span className="mt-1 block text-[10px] font-semibold">{t.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* ACCESSIBILITY */}
      <fieldset>
        <legend className="panel-label mb-1.5">Accessibility (for both players)</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {A11Y_OPTIONS.map((o) => (
            <label
              key={o.key}
              className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2 transition-colors ${
                value.a11y[o.key] ? "border-rose bg-rose/10" : "border-line bg-surface"
              }`}
            >
              <input
                type="checkbox"
                checked={value.a11y[o.key]}
                onChange={(e) => set({ a11y: { ...value.a11y, [o.key]: e.target.checked } })}
                className="mt-0.5 accent-[var(--rose)]"
              />
              <span>
                <span className="block text-xs font-semibold">
                  {o.icon} {o.label}
                </span>
                <span className="block text-[10px] leading-tight text-muted">{o.desc}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-muted">Each player can still change these for themselves with the ♿ button in the game.</p>
      </fieldset>
    </div>
  );
}
