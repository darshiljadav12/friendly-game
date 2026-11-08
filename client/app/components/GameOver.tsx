"use client";

import ResultCard from "./ResultCard";
import { AvatarBubble } from "./Avatar";
import { playerTheme } from "../constants";
import type { AchievementDef, GameState } from "../types";

type Props = {
  game: GameState;
  myId: string;
  definitions: AchievementDef[];
  colorIndex: (playerId: string) => number;
  onPlayAgain: () => void;
  onLeave: () => void;
};

export default function GameOver({ game, myId, definitions, colorIndex, onPlayAgain, onLeave }: Props) {
  const isCoop = game.settings.mode === "coop";
  const teamScore = game.players.reduce((sum, p) => sum + p.score, 0);
  const savedDares = game.players.flatMap((p) => p.savedDares.map((d) => ({ ...d, owner: p })));
  const def = (id: string) => definitions.find((d) => d.id === id);

  const headline = isCoop
    ? game.coopWon
      ? "You did it together!"
      : "So close!"
    : game.winnerIds.length > 1
      ? "It's a tie!"
      : game.winnerIds[0] === myId
        ? "You win!"
        : `${game.players.find((p) => p.id === game.winnerIds[0])?.username} wins!`;

  return (
    // Full screen on phones (the board is too small to hold it), over the board on desktop
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:absolute lg:z-20 lg:rounded-2xl lg:p-0">
      <div className="panel w-full max-w-[380px] lg:w-[min(360px,92%)] max-h-full lg:max-h-[94%] overflow-y-auto p-5 text-center space-y-4" style={{ background: "var(--surface)" }}>
        <div className="text-5xl animate-bounce" aria-hidden>
          {isCoop ? (game.coopWon ? "💞" : "🥺") : game.winnerIds.length > 1 ? "💞" : "🏆"}
        </div>
        <h2 className="text-2xl font-black title-gradient">{headline}</h2>

        {isCoop && (
          <p className="text-sm text-muted">
            Love meter: <span className="font-black text-rose">{teamScore}</span> / {game.settings.coopGoal}
          </p>
        )}

        <div className="space-y-1.5 text-sm">
          {[...game.players]
            .sort((a, b) => b.score - a.score)
            .map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl bg-sunken px-3 py-2">
                <span className="flex items-center gap-2">
                  <AvatarBubble avatar={p.avatar} colorIndex={colorIndex(p.id)} className="h-7 w-7 text-base" />
                  {p.username}
                </span>
                <span className="font-black" style={{ color: playerTheme(colorIndex(p.id)).base }}>
                  {p.score}
                </span>
              </div>
            ))}
        </div>

        {/* ACHIEVEMENTS */}
        {game.results && (
          <div className="rounded-xl bg-sunken p-3 text-left">
            <p className="panel-label mb-2">🏅 Badges this game</p>
            {game.players.map((p) => {
              const earned = game.results!.achievements[p.id] ?? [];
              const fresh = new Set(game.results!.newlyUnlocked?.[p.id] ?? []);
              // lifetime badges unlocked by this game aren't in "earned", show them too
              const all = [...new Set([...earned, ...fresh])];
              return (
                <div key={p.id} className="mb-2 last:mb-0">
                  <p className="text-xs font-bold" style={{ color: playerTheme(colorIndex(p.id)).base }}>
                    {p.username}
                  </p>
                  {all.length === 0 ? (
                    <p className="text-[11px] text-muted">None this time</p>
                  ) : (
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {all.map((id) => {
                        const a = def(id);
                        if (!a) return null;
                        return (
                          <li key={id} className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px]" title={a.desc}>
                            {a.icon} {a.name}
                            {fresh.has(id) && <span className="ml-1 rounded bg-gold px-1 text-[9px] font-black text-[#451a03]">NEW</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {savedDares.length > 0 && (
          <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-left">
            <p className="panel-label text-gold">⏳ Still owed</p>
            <ul className="mt-2 space-y-1 text-xs">
              {savedDares.map((dare) => (
                <li key={dare.id}>
                  <span className="font-semibold" style={{ color: playerTheme(colorIndex(dare.owner.id)).base }}>
                    {dare.owner.username}:
                  </span>{" "}
                  {dare.question}
                </li>
              ))}
            </ul>
            {game.isCouple && <p className="mt-2 text-[11px] text-muted">💌 Moved to your IOU wallet</p>}
          </div>
        )}

        {game.isCouple && <p className="text-[11px] text-muted">📚 Saved to your history, stats and memory book</p>}

        <ResultCard game={game} definitions={definitions} colorIndex={colorIndex} />

        <button onClick={onPlayAgain} className="btn btn-primary w-full p-3">
          Play again
        </button>
        <button onClick={onLeave} className="text-sm text-muted hover:text-white underline">
          Back to lobby
        </button>
      </div>
    </div>
  );
}
