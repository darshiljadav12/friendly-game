"use client";

import { REACTIONS } from "../constants";

export type FloatingReaction = {
  id: string;
  emoji: string;
  left: number; // % across the screen
  color: string;
};

export function ReactionBar({ onReact }: { onReact: (emoji: string) => void }) {
  return (
    <div className="panel flex items-center justify-between gap-1 px-2 py-1.5">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className="rounded-xl px-2 py-1 text-xl transition-transform hover:scale-125 active:scale-90"
          aria-label={`React ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export function FloatingReactions({ items }: { items: FloatingReaction[] }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {items.map((r) => (
        <span key={r.id} className="reaction-float" style={{ left: `${r.left}%` }}>
          <span className="text-4xl sm:text-5xl" style={{ filter: `drop-shadow(0 0 10px ${r.color})` }}>
            {r.emoji}
          </span>
        </span>
      ))}
    </div>
  );
}
