"use client";

import { useEffect, useRef, useState } from "react";
import { A11Y_OPTIONS, THEMES } from "../constants";
import type { A11y, ThemeName } from "../types";

// Room look for both players; only rendered for the room creator
export default function ThemeMenu({
  theme,
  a11y,
  onChange,
}: {
  theme: ThemeName;
  a11y: A11y;
  onChange: (patch: { theme?: ThemeName; a11y?: Partial<A11y> }) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-line bg-surface px-2.5 py-1 text-sm hover:border-line-strong"
        aria-expanded={open}
        aria-label="Room theme (creator only)"
        title="Room theme (only you, the creator, can change it)"
      >
        🎨
      </button>

      {open && (
        <div className="panel absolute right-0 top-full z-50 mt-2 w-72 p-3" style={{ background: "var(--surface)" }}>
          <p className="panel-label">Room theme</p>
          <p className="mb-2 text-[10px] text-muted">You created this room, so only you can change it. Both screens update.</p>
          <div className="grid grid-cols-5 gap-1">
            {THEMES.map((t) => (
              <button
                key={t.value}
                onClick={() => onChange({ theme: t.value })}
                aria-pressed={theme === t.value}
                className={`rounded-xl border p-1.5 text-center transition-colors ${theme === t.value ? "border-gold" : "border-line hover:border-line-strong"}`}
              >
                <span className="block h-5 w-full rounded-md" style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 40%, ${t.swatch[1]})` }} />
                <span className="mt-1 block truncate text-[9px] font-semibold">{t.label}</span>
              </button>
            ))}
          </div>

          <p className="panel-label mt-3 mb-1.5">Room accessibility</p>
          <ul className="space-y-1">
            {A11Y_OPTIONS.map((o) => (
              <li key={o.key}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-sunken px-2 py-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={a11y[o.key]}
                    onChange={(e) => onChange({ a11y: { [o.key]: e.target.checked } })}
                    className="accent-[var(--rose)]"
                  />
                  {o.icon} {o.label}
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] text-muted">Your partner can still adjust accessibility for themselves with ♿.</p>
        </div>
      )}
    </div>
  );
}
