"use client";

import { useEffect, useState, type Ref } from "react";
import { POWER_UP_INFO, TILE_INFO, TILE_THEMES, tileStyle } from "../constants";
import { sound } from "../../lib/sound";
import type { Challenge, GameState, PowerUp } from "../types";

export type ChallengeAction =
  | "done"
  | "skip"
  | "save"
  | "startTimer"
  | "rate"
  | "answer"
  | "guess"
  | "match"
  | "nomatch";

type Props = {
  ref?: Ref<HTMLElement>;
  game: GameState;
  challenge: Challenge;
  myId: string;
  timerEndsAt: number | null;
  onAction: (action: ChallengeAction, extra?: { hearts?: number; text?: string }) => void;
  onUsePowerUp: (card: PowerUp) => void;
};

function Countdown({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      if (endsAt - Date.now() > 0 && endsAt - Date.now() <= 5000) sound.tick();
    }, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const pct = Math.max(0, Math.min(100, ((endsAt - now) / 30_000) * 100));

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between">
        <span className="panel-label">{left > 0 ? "Time left" : "Time's up!"}</span>
        <span className={`font-mono text-3xl font-black ${left <= 5 ? "text-rose" : "text-gold"}`}>{left}s</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken">
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-linear"
          style={{ width: `${pct}%`, background: left <= 5 ? "var(--rose)" : "var(--gold)" }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-muted">
        {left > 0 ? "Finish in time for double points" : "You can still finish for normal points"}
      </p>
    </div>
  );
}

function TextEntry({ placeholder, button, onSubmit }: { placeholder: string; button: string; onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  const submit = () => text.trim() && onSubmit(text.trim());

  return (
    <div className="mt-4 flex gap-2">
      <input
        value={text}
        maxLength={80}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="field min-w-0 flex-1 px-3 py-2 text-sm"
        placeholder={placeholder}
        autoFocus
      />
      <button onClick={submit} disabled={!text.trim()} className="btn btn-primary px-4 text-sm">
        {button}
      </button>
    </div>
  );
}

const Waiting = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-4 flex items-center gap-2 text-xs text-muted">
    <span className="h-1.5 w-1.5 rounded-full bg-muted animate-pulse" />
    {children}
  </p>
);

export default function ChallengeCard({ ref, game, challenge: c, myId, timerEndsAt, onAction, onUsePowerUp }: Props) {
  const doer = game.players.find((p) => p.id === c.playerId);
  const owner = game.players.find((p) => p.id === c.ownerId);
  const me = game.players.find((p) => p.id === myId);
  const partnerOfDoer = game.players.find((p) => p.id !== c.playerId);
  const isDoer = c.playerId === myId;
  const theme = TILE_THEMES[c.type];

  const doubled = doer?.doubleNext;
  const pointsLabel =
    c.type === "love" || c.type === "memory"
      ? "1–3 ❤️"
      : c.type === "timed"
        ? `+${c.points} / ${c.points * 2}`
        : c.type === "guess" || c.type === "together"
          ? `+${c.points} each`
          : `+${c.points}`;

  // Cards can be used by whoever landed, before anything has been answered
  const canUseCards =
    isDoer &&
    c.ownerId === myId &&
    c.type !== "together" &&
    (c.stage === "pending" || (c.stage === "guessing" && !c.hasAnswer && !c.hasGuess));
  const cards = canUseCards ? (me?.powerUps ?? []) : [];

  const title =
    c.type === "together"
      ? "Together challenge"
      : c.handedOff
        ? `${owner?.username} passed it to ${isDoer ? "you" : doer?.username} 😈`
        : `${isDoer ? "Your" : `${doer?.username}'s`} challenge`;

  let body: React.ReactNode = null;

  if (c.type === "together") {
    const iConfirmed = c.confirmed.includes(myId);
    body = iConfirmed ? (
      <Waiting>Waiting for your partner to tap Done…</Waiting>
    ) : (
      <div className="mt-5 flex gap-3">
        <button onClick={() => onAction("done")} className="btn btn-primary flex-1 py-2.5">
          We did it
        </button>
        <button onClick={() => onAction("skip")} className="btn btn-secondary flex-1 py-2.5">
          Skip
        </button>
      </div>
    );
  } else if (c.stage === "guessing") {
    if (isDoer) {
      body = c.hasAnswer ? (
        <Waiting>Locked in. Waiting for {partnerOfDoer?.username}&apos;s guess…</Waiting>
      ) : (
        <>
          <p className="mt-3 text-xs text-muted">Type your real answer. {partnerOfDoer?.username} will try to guess it.</p>
          <TextEntry placeholder="Your answer (secret)" button="Lock in" onSubmit={(text) => onAction("answer", { text })} />
          <button onClick={() => onAction("skip")} className="mt-3 text-xs text-muted underline hover:text-white">
            Skip this one
          </button>
        </>
      );
    } else {
      body = c.hasGuess ? (
        <Waiting>Guess locked in. Waiting for {doer?.username}&apos;s answer…</Waiting>
      ) : (
        <>
          <p className="mt-3 text-xs text-muted">How well do you know {doer?.username}? Type your guess.</p>
          <TextEntry placeholder="Your guess" button="Guess" onSubmit={(text) => onAction("guess", { text })} />
        </>
      );
    }
  } else if (c.stage === "reveal") {
    body = (
      <>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-sunken p-3">
            <p className="panel-label">{doer?.username}&apos;s answer</p>
            <p className="mt-1 font-semibold">{c.answer}</p>
          </div>
          <div className="rounded-xl bg-sunken p-3">
            <p className="panel-label">{partnerOfDoer?.username}&apos;s guess</p>
            <p className="mt-1 font-semibold">{c.guess}</p>
          </div>
        </div>
        {isDoer ? (
          <div className="mt-4 flex gap-3">
            <button onClick={() => onAction("match")} className="btn btn-primary flex-1 py-2.5">
              It&apos;s a match!
            </button>
            <button onClick={() => onAction("nomatch")} className="btn btn-secondary flex-1 py-2.5">
              Not quite
            </button>
          </div>
        ) : (
          <Waiting>{doer?.username} is deciding if you got it…</Waiting>
        )}
      </>
    );
  } else if (c.stage === "rating") {
    body = isDoer ? (
      <Waiting>Waiting for {partnerOfDoer?.username} to rate your answer…</Waiting>
    ) : (
      <>
        <p className="mt-4 text-sm font-semibold">How was {doer?.username}&apos;s answer?</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((hearts) => (
            <button key={hearts} onClick={() => onAction("rate", { hearts })} className="btn btn-secondary py-2.5 text-sm">
              <div>{"❤️".repeat(hearts)}</div>
              <div className="mt-0.5 text-[10px] text-muted">+{hearts * 5}</div>
            </button>
          ))}
        </div>
      </>
    );
  } else if (c.stage === "timing") {
    body = (
      <>
        {timerEndsAt && <Countdown endsAt={timerEndsAt} />}
        {isDoer ? (
          <div className="mt-4 flex gap-3">
            <button onClick={() => onAction("done")} className="btn btn-primary flex-1 py-2.5">
              Done!
            </button>
            <button onClick={() => onAction("skip")} className="btn btn-secondary flex-1 py-2.5">
              Skip
            </button>
          </div>
        ) : (
          <Waiting>{doer?.username} is racing the clock…</Waiting>
        )}
      </>
    );
  } else if (isDoer) {
    // pending
    body =
      c.type === "timed" ? (
        <div className="mt-5 flex gap-3">
          <button onClick={() => onAction("startTimer")} className="btn btn-gold flex-1 py-2.5">
            ▶ Start 30s timer
          </button>
          <button onClick={() => onAction("skip")} className="btn btn-secondary px-5 py-2.5">
            Skip
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {(c.type === "love" || c.type === "memory") && (
            <p className="text-xs text-muted">Answer out loud, then {partnerOfDoer?.username} rates it.</p>
          )}
          <div className="flex gap-3">
            <button onClick={() => onAction("done")} className="btn btn-primary flex-1 py-2.5">
              Done
            </button>
            <button onClick={() => onAction("skip")} className="btn btn-secondary flex-1 py-2.5">
              Skip
            </button>
          </div>
          {c.type === "dare" && (
            <button onClick={() => onAction("save")} className="btn btn-gold w-full py-2.5">
              ⏳ Save for later
            </button>
          )}
        </div>
      );
  } else {
    body = <Waiting>Waiting for {doer?.username} to finish…</Waiting>;
  }

  return (
    <section ref={ref} className="panel overflow-hidden">
      {/* tile-coloured header */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: tileStyle(c.type).background }}>
        <span className="text-xs font-black uppercase tracking-widest">
          {theme.icon} {TILE_INFO[c.type].label}
        </span>
        <span className="flex items-center gap-1.5">
          {doubled && <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-black text-[#451a03]">2×</span>}
          <span className="rounded-full bg-black/25 px-2 py-0.5 text-xs font-bold text-gold">{pointsLabel}</span>
        </span>
      </div>

      <div className="p-4">
        <p className="panel-label">{title}</p>
        <p className="mt-2 text-lg font-semibold leading-snug">{c.question}</p>

        {body}

        {/* POWER-UP CARDS */}
        {cards.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="panel-label mb-2">Play a card</p>
            <div className="flex flex-wrap gap-2">
              {cards.map((card, i) => {
                const info = POWER_UP_INFO[card];
                const blocked = card === "handOff" && c.type === "guess";
                return (
                  <button
                    key={`${card}-${i}`}
                    onClick={() => onUsePowerUp(card)}
                    disabled={blocked}
                    title={blocked ? "Doesn't work on guess questions" : info.desc}
                    className="btn btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                  >
                    <span>{info.icon}</span>
                    {info.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
