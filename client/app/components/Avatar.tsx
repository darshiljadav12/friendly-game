"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { playerTheme } from "../constants";
import type { AvatarGroup } from "../types";

// Fallback until the server's full list arrives (meta.avatarGroups); the server has the final say
export const AVATAR_GROUPS: AvatarGroup[] = [
  {
    id: "animals",
    name: "Animals",
    icon: "🐻",
    avatars: ["🐻", "🐰", "🦊", "🐱", "🐼", "🐨", "🦁", "🐯", "🐸", "🐧", "🦄", "🐶", "🐹", "🐵", "🐙", "🦋"],
  },
];

// Glossy bubble in the player's colour with their avatar inside
export function AvatarBubble({ avatar, colorIndex, className = "", faded = false }: { avatar: string; colorIndex: number; className?: string; faded?: boolean }) {
  const t = playerTheme(colorIndex);
  return (
    <span
      className={`avatar-bubble ${faded ? "opacity-40 grayscale" : ""} ${className}`}
      style={{
        borderColor: t.base,
        borderRadius: t.shape,
        background: `radial-gradient(circle at 35% 28%, #ffffff 0%, ${t.light} 58%, ${t.base} 100%)`,
      }}
    >
      <span aria-hidden>{avatar}</span>
    </span>
  );
}

// Board piece: the bubble on a little point (like a map pin) with a soft shadow
export function BoardPiece({ avatar, colorIndex, active, faded }: { avatar: string; colorIndex: number; active: boolean; faded: boolean }) {
  const t = playerTheme(colorIndex);
  return (
    <div className={`relative h-full w-full ${active ? "token-active" : ""}`}>
      <AvatarBubble avatar={avatar} colorIndex={colorIndex} faded={faded} className="relative z-10 h-full w-full text-[clamp(12px,3.4cqw,22px)]" />
      <span className="piece-pointer" style={{ borderTopColor: t.base }} />
    </div>
  );
}

// Scoreboard avatar you can tap to pick another one
export function AvatarPicker({
  avatar,
  groups,
  takenBy,
  colorIndex,
  onPick,
}: {
  avatar: string;
  groups: AvatarGroup[];
  takenBy: Record<string, string>; // avatar → name of the other player using it
  colorIndex: number;
  onPick: (avatar: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [tab, setTab] = useState(groups[0]?.id);
  const group = groups.find((g) => g.id === tab) ?? groups[0];

  // Open on the tab holding the current avatar
  const toggle = () => {
    if (!open) setTab((groups.find((g) => g.avatars.includes(avatar)) ?? groups[0])?.id);
    setOpen((v) => !v);
  };

  const pick = (a: string) => {
    onPick(a);
    setOpen(false);
  };

  const surprise = () => {
    const free = groups.flatMap((g) => g.avatars).filter((a) => a !== avatar && !takenBy[a]);
    if (free.length) pick(free[Math.floor(Math.random() * free.length)]);
  };
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // The popover is rendered on <body> (cards are separate layers, so anything inside one
  // can't rise above the cards after it); keep it pinned under the button
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(288, window.innerWidth - 16);
      setPos({ top: r.bottom + 8, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const target = e.target as Node;
      const outside = !ref.current?.contains(target) && !popRef.current?.contains(target);
      if (e instanceof KeyboardEvent ? e.key === "Escape" : outside) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={toggle} className="relative block" aria-label="Change your avatar" aria-expanded={open} title="Change your avatar">
        <AvatarBubble avatar={avatar} colorIndex={colorIndex} className="h-9 w-9 text-xl" />
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-surface text-[9px] shadow" aria-hidden>
          ✏️
        </span>
      </button>
      {open && pos && createPortal(
        <div
          ref={popRef}
          className="panel fixed z-[70] w-[min(18rem,calc(100vw-1rem))] p-2.5"
          style={{ background: "var(--surface)", top: pos.top, left: pos.left }}
          role="dialog"
          aria-label="Pick your avatar"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="panel-label">Pick your piece</p>
            <button
              onClick={surprise}
              className="rounded-full border border-line bg-sunken px-2 py-0.5 text-xs font-semibold transition-transform hover:scale-105"
              title="Pick a random free avatar"
            >
              🎲 Surprise me
            </button>
          </div>
          {groups.length > 1 && (
            <div className="mb-2 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Avatar categories">
              {groups.map((g) => (
                <button
                  key={g.id}
                  role="tab"
                  aria-selected={g.id === group?.id}
                  onClick={() => setTab(g.id)}
                  title={g.name}
                  className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold transition-colors ${
                    g.id === group?.id ? "border-gold bg-gold/15" : "border-line bg-sunken hover:bg-gold/10"
                  }`}
                >
                  <span aria-hidden className="text-base leading-none">{g.icon}</span>
                  {g.name}
                </button>
              ))}
            </div>
          )}
          <div className="grid max-h-56 grid-cols-6 gap-1.5 overflow-y-auto overscroll-contain p-0.5" role="tabpanel">
            {(group?.avatars ?? []).map((a) => {
              const taken = takenBy[a];
              return (
                <button
                  key={a}
                  onClick={() => pick(a)}
                  disabled={Boolean(taken)}
                  aria-pressed={a === avatar}
                  aria-label={taken ? `${a} (${taken} has it)` : a}
                  title={taken ? `${taken} has this one` : undefined}
                  className={`flex aspect-square items-center justify-center rounded-xl border text-2xl transition-transform ${
                    a === avatar ? "border-gold bg-gold/15" : "border-line bg-sunken hover:scale-110"
                  } disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100`}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
