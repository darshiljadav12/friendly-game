"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { POWER_UP_INFO, TILE_THEMES, tileStyle } from "../constants";

// NOTE: keep these rules in sync with server/index.js (points, timings and limits live there)

type Section = { id: string; title: string; icon: string; body: ReactNode };

const Tile = ({ type }: { type: keyof typeof TILE_THEMES }) => (
  <span
    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm align-middle"
    style={tileStyle(type)}
  >
    {TILE_THEMES[type].icon}
  </span>
);

const H = ({ children }: { children: ReactNode }) => <h3 className="mt-5 first:mt-0 mb-2 text-sm font-black text-gold">{children}</h3>;

const List = ({ children }: { children: ReactNode }) => (
  <ul className="space-y-1.5 text-sm leading-relaxed text-white/85 list-disc pl-5 marker:text-rose">{children}</ul>
);

const Note = ({ children }: { children: ReactNode }) => (
  <p className="mt-3 rounded-xl border border-line bg-sunken px-3 py-2 text-xs leading-relaxed text-muted">💡 {children}</p>
);

function TileRow({ type, name, points, children }: { type: keyof typeof TILE_THEMES; name: string; points: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-sunken p-3">
      <div className="flex items-center gap-2.5">
        <Tile type={type} />
        <span className="font-bold">{name}</span>
        <span className="ml-auto rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-bold text-gold">{points}</span>
      </div>
      <ul className="mt-2 space-y-1 text-[13px] leading-relaxed text-white/80 list-disc pl-5 marker:text-muted">{children}</ul>
    </div>
  );
}

const SECTIONS: Section[] = [
  {
    id: "basics",
    title: "Basics",
    icon: "🎲",
    body: (
      <>
        <H>Getting started</H>
        <List>
          <li>The game is for exactly <b>2 players</b>. Enter your name (up to 20 characters) to begin.</li>
          <li>
            One player taps <b>Create new room</b> and chooses the <b>mode</b> (Competitive or Co-op) and the{" "}
            <b>length</b> (5, 10 or 20 rounds, or First to 150). These can&apos;t be changed after the room is created.
          </li>
          <li>The other player enters the 5-letter <b>room code</b> and taps Join. Capital or small letters both work.</li>
          <li>The game starts as soon as the second player joins. A room can&apos;t take a third player.</li>
          <li>The <b>room creator always goes first</b>, then players take turns.</li>
        </List>

        <H>Your turn</H>
        <List>
          <li>When it&apos;s your turn, the dice glows in your colour. Tap it to roll a number from 1 to 6.</li>
          <li>Your token hops that many tiles <b>clockwise</b> around the 28-tile board.</li>
          <li>Whatever you land on happens (see <b>Tiles</b>). When it&apos;s finished, the turn passes to your partner.</li>
          <li>You can&apos;t roll again while a challenge is still open. It has to be finished, skipped or saved first.</li>
          <li>Each normal roll uses one of your turns. <b>Bonus rolls and Reroll cards don&apos;t</b>.</li>
          <li>
            The <b>round</b> number shown is the lowest number of turns either player has taken, plus one. Round 3 means
            both of you have finished 2 turns.
          </li>
        </List>

        <H>Points at a glance</H>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          {[
            ["❤️ Love / 📸 Memory", "5–15 (partner rates)"],
            ["😈 Dare", "20"],
            ["🎁 Gift", "15"],
            ["🤔 Guess", "15 each on a match"],
            ["⏱️ Timed", "30 in time, 15 late"],
            ["💑 Together", "10 each"],
            ["⭐ Passing START", "+5"],
            ["Skip", "0"],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col rounded-lg bg-sunken px-2.5 py-1.5">
              <span className="font-semibold">{k}</span>
              <span className="text-muted">{v}</span>
            </div>
          ))}
        </div>
        <Note>Skipping never costs you points. You just don&apos;t earn any for that challenge.</Note>
      </>
    ),
  },
  {
    id: "tiles",
    title: "Tiles",
    icon: "🟪",
    body: (
      <div className="space-y-2.5">
        <TileRow type="love" name="Love" points="5 / 10 / 15">
          <li>Answer the question out loud (or on a call), then tap <b>Done</b>.</li>
          <li>Your partner rates your answer: ❤️ = 5, ❤️❤️ = 10, ❤️❤️❤️ = 15 points.</li>
          <li>The game waits until your partner rates. Their phone buzzes when it&apos;s time.</li>
          <li><b>Skip</b> gives 0 and skips the rating.</li>
        </TileRow>
        <TileRow type="memory" name="Memory" points="5 / 10 / 15">
          <li>Works exactly like Love: share the memory, tap Done, and your partner rates it with 1–3 hearts.</li>
        </TileRow>
        <TileRow type="dare" name="Dare" points="20">
          <li><b>Done</b> = 20 points. <b>Skip</b> = 0.</li>
          <li>
            <b>⏳ Save for later</b>: put the dare off. You get no points now and the turn passes. See <b>Dares</b> for
            how to finish it later.
          </li>
        </TileRow>
        <TileRow type="gift" name="Gift" points="15">
          <li>Do the sweet gesture, then tap <b>Done</b> for 15 points, or <b>Skip</b>.</li>
        </TileRow>
        <TileRow type="guess" name="Guess" points="15 each">
          <li>The question is about <b>you</b>, the player who landed (&quot;What&apos;s my favourite food?&quot;).</li>
          <li>You type your real answer and your partner types a guess. Answers can be up to 80 characters.</li>
          <li>Neither can see the other&apos;s text until <b>both are locked in</b>. Then both are revealed side by side.</li>
          <li>
            <b>You</b> decide: <b>It&apos;s a match!</b> gives <b>both</b> of you 15 points, <b>Not quite</b> gives 0.
            Close enough counts if you say so.
          </li>
          <li>You can skip the question before you lock in your answer.</li>
        </TileRow>
        <TileRow type="timed" name="Timed" points="30 / 15">
          <li>Tap <b>▶ Start 30s timer</b> when you&apos;re ready. The countdown shows on both screens.</li>
          <li>Tap <b>Done</b> within 30 seconds for <b>30 points</b> (double). There&apos;s a 1-second allowance for lag.</li>
          <li>Finished but too slow? Tap Done anyway and you still get <b>15</b>.</li>
          <li>Skip gives 0. Timed challenges <b>can&apos;t</b> be saved for later.</li>
        </TileRow>
        <TileRow type="wild" name="Wild" points="random">
          <li>Something random happens straight away, with no challenge to do. It&apos;s one of these four:</li>
          <li><b>Swap</b>: you and your partner swap places. Neither of you gets the challenge of your new tile.</li>
          <li>
            <b>Steal</b>: take up to 10 points from your partner. You can&apos;t take more than they have, and their score
            never goes below 0. <b>In co-op</b> this is a +10 bonus instead.
          </li>
          <li><b>Back 3</b>: move back 3 tiles. The tile you land on does nothing, and going back past START gives no bonus.</li>
          <li>
            <b>Double</b>: your next challenge points are doubled (shown as a <b>2×</b> badge). If you already have
            Double waiting, another one doesn&apos;t stack.
          </li>
        </TileRow>
        <TileRow type="start" name="Start" points="+5">
          <li>Passing over <b>or</b> landing on START gives +5 points and a power-up card (see <b>Cards</b>).</li>
          <li>Landing on START has no challenge, so your turn ends (unless you rolled a 6).</li>
        </TileRow>
      </div>
    ),
  },
  {
    id: "specials",
    title: "Specials",
    icon: "✨",
    body: (
      <>
        <H>🎲 Rolling a 6</H>
        <List>
          <li>You get a <b>bonus roll</b>. First finish whatever is on the tile you landed on, then roll again.</li>
          <li>A bonus roll doesn&apos;t use up a turn, so it doesn&apos;t count against your rounds.</li>
          <li>Roll another 6 on the bonus roll and you get yet another bonus roll.</li>
          <li>The dice label shows <b>&quot;🎲 Bonus roll&quot;</b> while you have one waiting.</li>
        </List>

        <H>💑 Together challenge</H>
        <List>
          <li>If you land on the tile your partner is standing on, you <b>both</b> get a Together challenge instead of the tile&apos;s normal one.</li>
          <li>This happens on any tile, including Wild and START (where you still get the +5 and the card).</li>
          <li>Both players tap <b>We did it</b>. Once both have tapped, <b>each</b> gets 10 points.</li>
          <li>Either player can tap <b>Skip</b>, which ends it for both with no points.</li>
          <li>
            Being moved onto your partner (by Swap or Back 3) <b>doesn&apos;t</b> start a Together challenge. Only landing
            there with a roll does.
          </li>
          <li>Power-up cards can&apos;t be used on a Together challenge.</li>
        </List>

        <H>✖️2 Double points</H>
        <List>
          <li>From a Wild tile. It doubles the <b>next challenge points you earn</b>, then it&apos;s used up.</li>
          <li>It doubles: Done, partner ratings, Timed (60 if in time), Guess matches, Together, and Free Pass.</li>
          <li>It does <b>not</b> double the START bonus, Wild steals or bonuses, or saved dares completed later.</li>
          <li>If a challenge gives points to both players, each player&apos;s own Double applies only to their share.</li>
        </List>

        <H>😂 Reactions</H>
        <List>
          <li>Tap the emoji bar under the board any time to send a reaction that floats up on both screens.</li>
          <li>There&apos;s a short cooldown (a quarter of a second), so really fast taps are ignored.</li>
        </List>

        <H>🔊 Sound & vibration</H>
        <List>
          <li>Dice, steps, points, &quot;your turn&quot;, the timer and winning all have sounds. The 🔊 button in the header mutes them.</li>
          <li>Your mute choice is remembered on this device.</li>
          <li>Phones vibrate on your turn and when your partner needs your rating. iPhones don&apos;t support vibration from websites.</li>
          <li>Browsers only allow sound after you tap the page once.</li>
        </List>
      </>
    ),
  },
  {
    id: "cards",
    title: "Cards",
    icon: "🃏",
    body: (
      <>
        <H>Earning cards</H>
        <List>
          <li>Each time you pass or land on <b>START</b>, you get one random power-up card.</li>
          <li>You can hold up to <b>3 cards</b>. With 3 already, you still get the +5 but no new card.</li>
          <li>Your cards are shown in <b>Your cards</b>. Your partner can see how many you have (🃏) but not which ones.</li>
          <li>Cards are cleared when you press Play again.</li>
        </List>

        <H>The cards</H>
        <div className="space-y-2">
          {(Object.keys(POWER_UP_INFO) as (keyof typeof POWER_UP_INFO)[]).map((key) => (
            <div key={key} className="flex gap-2.5 rounded-xl bg-sunken p-3">
              <span className="text-xl">{POWER_UP_INFO[key].icon}</span>
              <div className="text-[13px] leading-relaxed">
                <p className="font-bold">{POWER_UP_INFO[key].name}</p>
                {key === "freePass" && (
                  <p className="text-white/80">
                    Skip the challenge and still get its <b>base</b> points: Love/Memory 10, Dare 20, Gift 15, Timed 15,
                    Guess 15 (only you, not your partner).
                  </p>
                )}
                {key === "reroll" && (
                  <p className="text-white/80">
                    Throw away this challenge and roll again from where you are. The new roll doesn&apos;t use up a
                    turn, and if you already had a bonus roll from a 6, you keep that too.
                  </p>
                )}
                {key === "handOff" && (
                  <p className="text-white/80">
                    Your partner has to do this challenge instead, and any points go to <b>them</b>. On Love/Memory,
                    you&apos;re the one who rates. If it&apos;s a dare, they can save it to <b>their</b> list. It
                    doesn&apos;t work on Guess questions, because those are about you. Your partner can&apos;t play a
                    card on a challenge you passed to them.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <H>When you can play a card</H>
        <List>
          <li>Only on <b>your own</b> challenge, the one you landed on, and only <b>before</b> you&apos;ve done anything with it.</li>
          <li>Cards appear at the bottom of the challenge card under <b>Play a card</b>.</li>
          <li>
            You <b>can&apos;t</b> play a card: on a Together challenge, after starting a Timed timer, while waiting for a
            rating, or on a Guess once either of you has typed an answer.
          </li>
          <li>You can play one card per challenge (after a Reroll, the challenge is gone; after Pass It On, it&apos;s no longer yours).</li>
        </List>
      </>
    ),
  },
  {
    id: "dares",
    title: "Saved dares",
    icon: "⏳",
    body: (
      <>
        <List>
          <li><b>Save for later</b> only appears on normal <b>Dare</b> tiles, not on Timed or any other challenge.</li>
          <li>Saving ends your turn with no points. The dare goes into the <b>Saved dares</b> list, which both of you can see, marked in its owner&apos;s colour.</li>
          <li>
            Once you&apos;ve done it in real life, tap <b>Done</b> on it in the list. You can do this <b>at any time</b>
            during the game, even when it&apos;s not your turn. You get its 20 points.
          </li>
          <li>Only the player who saved the dare can mark it done.</li>
          <li>Saved dares are <b>never doubled</b>, even if you have a 2× waiting (your 2× stays for your next challenge).</li>
          <li>In <b>First to 150</b>, finishing a saved dare can win you the game on the spot.</li>
          <li>When the game ends, any dares not done are listed on the results screen as <b>&quot;Dares still owed&quot;</b>. They can&apos;t earn points any more.</li>
          <li>Pressing <b>Play again</b> clears the list.</li>
        </List>
        <Note>Saving is great for dares you can&apos;t do right now, like ones that need you to be together in person.</Note>
      </>
    ),
  },
  {
    id: "winning",
    title: "Winning",
    icon: "🏆",
    body: (
      <>
        <H>🏆 Competitive</H>
        <List>
          <li>
            <b>5 / 10 / 20 rounds</b>: the game ends once <b>both</b> players have used all their turns. If the last roll
            was a 6, the bonus roll happens first, and any open challenge is finished first.
          </li>
          <li>
            <b>First to 150</b>: there&apos;s no round limit. The game ends the moment someone has <b>150 or more</b> when
            a turn ends, or when they finish a saved dare.
          </li>
          <li>The highest score wins. Equal scores are a <b>tie</b>.</li>
        </List>

        <H>💞 Co-op</H>
        <List>
          <li>You play as a team. Every point either of you earns fills the shared <b>💞 Love meter</b>.</li>
          <li>The goal is <b>30 points per round</b>: 150 for 5 rounds, 300 for 10 and 600 for 20.</li>
          <li>Reach the goal by the end of the last round and you <b>win together</b>. Otherwise it&apos;s &quot;So close!&quot;</li>
          <li>Co-op always uses rounds. &quot;First to 150&quot; isn&apos;t available in co-op.</li>
          <li>In co-op, the Wild <b>Steal</b> becomes a +10 bonus. Everything else works the same.</li>
        </List>

        <H>After the game</H>
        <List>
          <li>The results screen shows both scores and any dares still owed.</li>
          <li>
            <b>Play again</b> (either player can press it) starts a new game in the same room with the same settings.
            Scores, positions, cards, Double bonuses and saved dares all reset. The room creator goes first again.
          </li>
          <li><b>Back to lobby</b> leaves the room.</li>
        </List>
      </>
    ),
  },
  {
    id: "connection",
    title: "Connection",
    icon: "📶",
    body: (
      <>
        <H>Refreshing & dropping out</H>
        <List>
          <li>Refreshing the page puts you <b>straight back</b> in your seat with the same position, score and cards.</li>
          <li>
            Your seat is tied to <b>this browser tab</b>. A new tab or another browser counts as a new player. That&apos;s
            also how you can test with 2 tabs on one computer.
          </li>
          <li>
            If you lose connection, your partner sees you as <b>offline</b> and the game pauses on you. Come back within{" "}
            <b>60 seconds</b> and you carry on as if nothing happened.
          </li>
          <li>
            After 60 seconds you&apos;re removed. Your partner goes back to the waiting screen and the game{" "}
            <b>resets</b>. Someone can join again with the same room code.
          </li>
          <li>The game also pauses if it&apos;s your partner&apos;s move (rolling, rating, guessing…) while they&apos;re offline.</li>
        </List>

        <H>Leaving</H>
        <List>
          <li><b>Leave</b> in the header removes you right away, and your partner goes back to the waiting screen.</li>
          <li>When both players have left, the room is deleted and the code stops working.</li>
          <li>Rooms are kept only while the server is running. If the server restarts, every game is lost.</li>
        </List>

        <H>Messages you might see</H>
        <List>
          <li><b>Room not found</b>: wrong code, or that room no longer exists.</li>
          <li><b>Room is full</b>: two players are already in it.</li>
          <li><b>Not your turn</b>: wait for the glowing dice.</li>
          <li><b>Finish the current challenge first</b>: finish, skip or save the open challenge before rolling.</li>
          <li><b>Reconnecting to server…</b>: your internet dropped. The game reconnects by itself.</li>
        </List>
      </>
    ),
  },
];

export default function HowToPlay({ variant = "pill" }: { variant?: "pill" | "link" }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];
  const index = SECTIONS.indexOf(section);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          variant === "pill"
            ? "rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold hover:bg-gold/20"
            : "text-sm text-muted hover:text-white underline"
        }
      >
        📖 How to play
      </button>

      {/* Portal to <body>: blurred panels would otherwise trap a fixed overlay inside them */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="How to play"
        >
          <div
            className="panel flex h-[92vh] sm:h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-b-none sm:rounded-[1.25rem]"
            style={{ background: "var(--surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="text-xl font-black title-gradient">How to play</h2>
                <p className="text-xs text-muted">Every rule, from the first roll to the last point</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full border border-line px-2.5 py-1 text-sm text-muted hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* TABS */}
            <nav className="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2.5">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    s.id === active ? "border-rose bg-rose/15 text-white" : "border-line text-muted hover:text-white"
                  }`}
                >
                  {s.icon} {s.title}
                </button>
              ))}
            </nav>

            {/* CONTENT */}
            <div key={section.id} className="flex-1 overflow-y-auto px-5 py-4">
              {section.body}
            </div>

            {/* FOOTER NAV */}
            <div className="flex items-center justify-between border-t border-line px-5 py-3">
              <button
                onClick={() => setActive(SECTIONS[index - 1].id)}
                disabled={index === 0}
                className="text-sm text-muted hover:text-white disabled:opacity-30"
              >
                ← {index > 0 ? SECTIONS[index - 1].title : ""}
              </button>
              <span className="text-xs text-muted">
                {index + 1} / {SECTIONS.length}
              </span>
              {index < SECTIONS.length - 1 ? (
                <button onClick={() => setActive(SECTIONS[index + 1].id)} className="btn btn-primary px-4 py-1.5 text-sm">
                  {SECTIONS[index + 1].title} →
                </button>
              ) : (
                <button onClick={() => setOpen(false)} className="btn btn-primary px-4 py-1.5 text-sm">
                  Let&apos;s play!
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
