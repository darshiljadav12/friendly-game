"use client";

import { useEffect, useRef, useState } from "react";
import { a11yPrefs } from "../../lib/prefs";
import { A11Y_OPTIONS } from "../constants";
import type { A11y } from "../types";

// Per-player accessibility: starts from the room creator's choice, each player can change it
export default function PrefsMenu({ room, local, effective }: { room: A11y; local: Partial<A11y>; effective: A11y }) {
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
        aria-label="Accessibility settings"
        title="Accessibility"
      >
        ♿
      </button>

      {open && (
        <div className="panel absolute right-0 top-full z-50 mt-2 w-72 p-3" style={{ background: "var(--surface)" }}>
          <p className="panel-label mb-2">Accessibility (just for you)</p>
          <ul className="space-y-1.5">
            {A11Y_OPTIONS.map((o) => (
              <li key={o.key}>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-sunken p-2">
                  <input
                    type="checkbox"
                    checked={effective[o.key]}
                    onChange={(e) => a11yPrefs.set(o.key, e.target.checked)}
                    className="mt-0.5 accent-[var(--rose)]"
                  />
                  <span className="flex-1">
                    <span className="block text-xs font-semibold">
                      {o.icon} {o.label}
                    </span>
                    <span className="block text-[10px] text-muted">
                      {o.desc}
                      {o.key in local ? " · your choice" : room[o.key] ? " · set by room" : ""}
                    </span>
                  </span>
                  {o.key in local && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        a11yPrefs.set(o.key, null);
                      }}
                      className="text-[10px] text-muted underline hover:text-white"
                      title="Go back to the room's setting"
                    >
                      reset
                    </button>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
