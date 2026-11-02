"use client";

import { useState } from "react";
import { playerTheme } from "../constants";
import type { GameState } from "../types";

const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

// Everything that happened this game, newest first. Entries since your own last
// roll are highlighted so you can catch up before your turn.
export default function ActivityLog({ game, myId, colorIndex }: { game: GameState; myId: string; colorIndex: (playerId: string) => number }) {
  const [expanded, setExpanded] = useState(false);

  const entries = [...game.log].reverse();
  const myLastRoll = entries.findIndex((e) => e.playerId === myId && (e.icon === "🎲" || e.icon === "🎯"));
  const sinceMyTurn = myLastRoll === -1 ? entries.length : myLastRoll;
  const fresh = entries.slice(0, sinceMyTurn).filter((e) => e.playerId !== myId).length;
  const shown = expanded ? entries : entries.slice(0, 8);

  return (
    <section className="panel p-4" aria-label="Activity">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="panel-label">📜 Activity</h2>
        {fresh > 0 && (
          <span className="rounded-full bg-rose/20 px-2 py-0.5 text-[10px] font-bold text-rose">
            {fresh} new since your last turn
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-muted">Nothing yet.</p>
      ) : (
        <ol className="space-y-1.5" aria-live="polite">
          {shown.map((e, i) => {
            const isNew = i < sinceMyTurn && e.playerId !== myId;
            const color = e.playerId ? playerTheme(colorIndex(e.playerId)).base : "var(--muted)";
            return (
              <li
                key={e.id}
                className={`flex gap-2 rounded-lg px-2 py-1.5 text-xs ${isNew ? "bg-rose/10" : ""}`}
                style={{ borderLeft: `3px solid ${color}` }}
              >
                <span aria-hidden>{e.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="leading-snug">{e.text}</p>
                  {e.detail && <p className="mt-0.5 truncate text-[11px] text-muted" title={e.detail}>“{e.detail}”</p>}
                </div>
                <span className="shrink-0 text-[10px] text-muted">{time(e.at)}</span>
              </li>
            );
          })}
        </ol>
      )}

      {entries.length > 8 && (
        <button onClick={() => setExpanded((v) => !v)} className="mt-2 text-[11px] text-muted underline hover:text-white">
          {expanded ? "Show less" : `Show all ${entries.length}`}
        </button>
      )}
    </section>
  );
}
