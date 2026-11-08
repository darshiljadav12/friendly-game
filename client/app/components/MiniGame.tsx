"use client";

import { useEffect, useRef, useState } from "react";
import DrawPad from "./DrawPad";
import { MINI_GAME_INFO } from "../constants";
import { sound } from "../../lib/sound";
import type { ChallengeAction } from "./ChallengeCard";
import type { Challenge, GameState } from "../types";

type Props = {
  game: GameState;
  challenge: Challenge;
  myId: string;
  timerEndsAt: number | null;
  onAction: (action: ChallengeAction, extra?: { text?: string; picks?: number[] }) => void;
};

const Waiting = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-4 flex items-center gap-2 text-xs text-muted">
    <span className="h-1.5 w-1.5 rounded-full bg-muted animate-pulse" />
    {children}
  </p>
);

// Text box that empties after each send (Draw It guesses can be tried again and again)
function SendBox({ placeholder, button, onSend }: { placeholder: string; button: string; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const send = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <div className="mt-3 flex gap-2">
      <input
        value={text}
        maxLength={80}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && send()}
        className="field min-w-0 flex-1 px-3 py-2 text-sm"
        placeholder={placeholder}
        autoFocus
      />
      <button onClick={send} disabled={!text.trim()} className="btn btn-primary px-4 text-sm">
        {button}
      </button>
    </div>
  );
}

function TimerBar({ endsAt, total, onTimeUp }: { endsAt: number; total: number; onTimeUp: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const onTimeUpRef = useRef(onTimeUp);
  const fired = useRef(false);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  useEffect(() => {
    const id = setInterval(() => {
      const left = endsAt - Date.now();
      setNow(Date.now());
      if (left > 0 && left <= 5000) sound.tick();
      if (left <= 0 && !fired.current) {
        fired.current = true;
        onTimeUpRef.current();
      }
    }, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const pct = Math.max(0, Math.min(100, ((endsAt - now) / total) * 100));
  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-linear"
          style={{ width: `${pct}%`, background: left <= 10 ? "var(--rose)" : "var(--gold)" }}
        />
      </div>
      <span className={`font-mono text-xl font-black ${left <= 10 ? "text-rose" : "text-gold"}`}>{left}s</span>
    </div>
  );
}

function PickGame({ challenge: c, myId, isDoer, partnerName, onAction }: { challenge: Challenge; myId: string; isDoer: boolean; partnerName: string; onAction: Props["onAction"] }) {
  const items = c.mini?.items ?? [];
  const [picks, setPicks] = useState<(number | null)[]>(() => items.map(() => null));

  if (c.mini?.picked.includes(myId)) {
    return <Waiting>Locked in! Waiting for {partnerName}&apos;s picks…</Waiting>;
  }

  const ready = picks.every((p) => p !== null);
  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-muted">Pick in secret. You&apos;ll both see the answers once {partnerName} has picked too.</p>
      {items.map((item, i) => (
        <div key={i} className="rounded-xl bg-sunken p-2.5">
          {item.text && <p className="mb-2 text-sm font-semibold">{item.text}</p>}
          <div className="grid grid-cols-2 gap-2">
            {item.options.map((option, o) => (
              <button
                key={o}
                onClick={() => setPicks((list) => list.map((p, k) => (k === i ? o : p)))}
                aria-pressed={picks[i] === o}
                className={`btn py-2 text-sm ${picks[i] === o ? "btn-primary" : "btn-secondary"}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => onAction("pick", { picks: picks as number[] })} disabled={!ready} className="btn btn-gold w-full py-2.5">
        {ready ? "🔒 Lock in my picks" : `Pick ${picks.filter((p) => p === null).length} more`}
      </button>
      {isDoer && (
        <button onClick={() => onAction("skip")} className="text-xs text-muted underline hover:text-white">
          Skip this one
        </button>
      )}
    </div>
  );
}

export default function MiniGame({ game, challenge: c, myId, timerEndsAt, onAction }: Props) {
  const [word, setWord] = useState<string | null>(null);
  const m = c.mini;
  if (!m) return null;

  const info = MINI_GAME_INFO[m.game];
  const isDoer = c.playerId === myId;
  const doer = game.players.find((p) => p.id === c.playerId);
  const partner = game.players.find((p) => p.id !== c.playerId);
  const otherName = (isDoer ? partner : doer)?.username ?? "your partner";
  const nameOf = (id: string) => (id === myId ? "You" : (game.players.find((p) => p.id === id)?.username ?? "?"));

  const continueButton = isDoer ? (
    <button onClick={() => onAction("continue")} className="btn btn-primary mt-4 w-full py-2.5">
      Continue
    </button>
  ) : (
    <Waiting>{doer?.username} will continue…</Waiting>
  );

  switch (c.stage) {
    case "pending":
      return (
        <>
          <p className="mt-2 text-sm text-muted">{info.how}</p>
          <p className="mt-1 text-xs font-semibold text-gold">{info.points}</p>
          {isDoer ? (
            <div className="mt-4 flex gap-3">
              <button onClick={() => onAction("start")} className="btn btn-primary flex-1 py-2.5">
                ▶ Let&apos;s play
              </button>
              <button onClick={() => onAction("skip")} className="btn btn-secondary px-5 py-2.5">
                Skip
              </button>
            </div>
          ) : (
            <Waiting>Waiting for {doer?.username} to start the game…</Waiting>
          )}
        </>
      );

    case "picking":
      return <PickGame challenge={c} myId={myId} isDoer={isDoer} partnerName={otherName} onAction={onAction} />;

    case "writing":
      return (
        <>
          <p className="mt-3 text-xs text-muted">{isDoer ? `Finish this sentence for ${partner?.username}:` : `${doer?.username} is finishing this for you:`}</p>
          <p className="mt-1.5 rounded-xl bg-sunken p-3 text-base font-semibold italic">“{m.prompt}”</p>
          {isDoer ? (
            <SendBox placeholder="Finish the sentence…" button="Done" onSend={(text) => onAction("answer", { text })} />
          ) : (
            <Waiting>{doer?.username} is finishing the sentence…</Waiting>
          )}
        </>
      );

    case "drawing":
      return (
        <>
          {isDoer ? (
            <p className="mt-2 text-sm">
              Draw: <span className="rounded-lg bg-gold px-2 py-0.5 font-black text-[#451a03]">{word ?? "…"}</span>
              <span className="ml-2 text-xs text-muted">No letters or numbers!</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">What is {doer?.username} drawing? Guess as often as you like.</p>
          )}
          {timerEndsAt && <TimerBar endsAt={timerEndsAt} total={60_000} onTimeUp={() => onAction("timeup")} />}
          <DrawPad canDraw={isDoer} onWord={setWord} />
          {isDoer ? (
            <button onClick={() => onAction("skip")} className="mt-3 text-xs text-muted underline hover:text-white">
              Give up and show the word
            </button>
          ) : (
            <>
              <SendBox placeholder="Your guess" button="Guess" onSend={(text) => onAction("guess", { text })} />
              {m.guesses.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.guesses.map((g, i) => (
                    <span key={i} className="rounded-full bg-sunken px-2 py-0.5 text-[11px] text-muted line-through">
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      );

    case "results": {
      if (m.game === "draw") {
        const guessed = m.result?.guessed;
        return (
          <>
            <p className="mt-3 text-sm">
              The word was <span className="rounded-lg bg-gold px-2 py-0.5 font-black text-[#451a03]">{m.word}</span>
            </p>
            <p className={`mt-2 text-sm font-bold ${guessed ? "text-gold" : "text-muted"}`}>
              {guessed ? `🎉 ${partner?.username} got it! +${c.points} each` : "⌛ Nobody got it this time"}
            </p>
            <DrawPad canDraw={false} />
            {continueButton}
          </>
        );
      }

      const ids = [myId, ...game.players.filter((p) => p.id !== myId).map((p) => p.id)].filter((id) => m.picks?.[id]);
      const matches = m.result?.matches ?? 0;
      const total = m.items?.length ?? 0;
      return (
        <>
          <div className="mt-3 space-y-2">
            {m.items?.map((item, i) => {
              const same = ids.length === 2 && m.picks![ids[0]][i] === m.picks![ids[1]][i];
              return (
                <div key={i} className={`rounded-xl border p-2.5 text-sm ${same ? "border-gold/50 bg-gold/10" : "border-line bg-sunken"}`}>
                  {item.text && <p className="mb-1 font-semibold">{item.text}</p>}
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {ids.map((id) => (
                      <span key={id}>
                        <span className="text-muted">{nameOf(id)}:</span> <b>{item.options[m.picks![id][i]]}</b>
                      </span>
                    ))}
                    <span className="ml-auto">{same ? "✅" : "❌"}</span>
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-sm font-bold text-gold">
            {matches}/{total} matches{matches === total ? " · perfect! 💞" : ""} · +{m.result?.points[myId] ?? 0} each
          </p>
          {m.game === "neverEver" && <p className="mt-1 text-xs text-muted">Anyone who said “I have” tells the story 😄</p>}
          {continueButton}
        </>
      );
    }
  }
  return null;
}
