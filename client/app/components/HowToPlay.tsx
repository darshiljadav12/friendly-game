"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BOARD_PRESETS, POWER_UP_INFO, THEMES, TILE_THEMES, tileStyle } from "../constants";
import type { PowerUp } from "../types";

// NOTE: keep these rules in sync with server/config.js, server/game.js,
// server/couples.js and server/achievements.js (points, prices and limits live there)

type Section = { id: string; title: string; icon: string; body: ReactNode };

const Tile = ({ type }: { type: keyof typeof TILE_THEMES }) => (
  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm align-middle" style={tileStyle(type)}>
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

const CARD_RULES: Record<PowerUp, ReactNode> = {
  freePass: (
    <>
      Skip the challenge and still get its <b>base</b> points: Love/Memory 10, Dare 20, Gift 15, Timed 15, Guess 15 (only you, not your partner).
      Counts as done.
    </>
  ),
  reroll: <>Throw away this challenge and roll again from where you are. The new roll doesn&apos;t use up a turn, and a bonus roll you already had from a 6 is kept too.</>,
  handOff: (
    <>
      Your partner has to do this challenge and gets any points. On Love/Memory you&apos;re the one who rates. If it&apos;s a dare they can save it to{" "}
      <b>their</b> list. Not on Guess. If your partner holds a 🛡️ Shield, it blocks this: both cards are used up and you still have to do it.
    </>
  ),
  shield: (
    <>
      Works <b>by itself</b>, you never play it. When your partner&apos;s ⚡ Wild would <b>swap</b> with you or <b>steal</b> from you, or they play 😈 Pass It On on
      you, your Shield blocks it and is used up. It doesn&apos;t block Mirror, Back 3 or Double (those only affect the roller). Your partner sees a hint on the
      challenge card when you hold one.
    </>
  ),
  mirror: (
    <>
      Your partner earns the same points as you on this challenge (plus coins), even though you do it. Works on Love/Memory (they get the same hearts × 5),
      Dare, Gift and Timed. Not on Guess. If you skip or save the challenge, nobody gets anything.
    </>
  ),
  teleport: (
    <>
      Use it from <b>Your cards</b> on your turn <b>instead of rolling</b> (no open challenge). Tap Use, then tap any tile except your own. You jump there and
      that tile happens as usual (a challenge, Wild, or a Together challenge if your partner is there). It uses up your turn, or your pending bonus roll if you
      have one. Jumping over START gives no bonus. It also closes your shop.
    </>
  ),
};

const SECTIONS: Section[] = [
  {
    id: "basics",
    title: "Basics",
    icon: "🎲",
    body: (
      <>
        <H>Two ways to play</H>
        <List>
          <li>
            <b>💑 Couple</b>: log in to your own account, linked to your partner&apos;s (see <b>Couple</b>). Games are private to the two of you and everything is saved: history, memory book,
            stats, badges and owed dares.
          </li>
          <li>
            <b>⚡ Quick game</b>: play with anyone using just a name (up to 20 characters). Nothing is saved after the game ends.
          </li>
          <li>The game is always for exactly <b>2 players</b>.</li>
        </List>

        <H>Starting a game</H>
        <List>
          <li>
            The creator picks the <b>mode</b>, <b>length</b>, <b>board</b>, <b>theme</b> and <b>accessibility</b> (see <b>Settings</b>). Mode, length and board are fixed once
            the room exists; the creator can still change the theme and accessibility with 🎨 during the game.
          </li>
          <li>
            Then share the <b>invite</b>: the 5-letter code, a link (<span className="font-mono">/join/CODE</span>) or the QR code. The link opens the game with the code
            filled in. If you&apos;re logged in to the couple, it joins straight away.
          </li>
          <li>The game starts the moment the second player joins. The <b>creator always goes first</b>.</li>
        </List>

        <H>Your turn</H>
        <List>
          <li>The dice glows in your colour on your turn. Tap it to roll 1–6 and hop <b>clockwise</b> around the 28-tile board.</li>
          <li>Whatever you land on happens (see <b>Tiles</b>). When it&apos;s finished, the turn passes to your partner.</li>
          <li>You can&apos;t roll again while a challenge is still open. Finish, skip or save it first.</li>
          <li>Each normal roll or Teleport uses one of your turns. <b>Bonus rolls and Rerolls don&apos;t</b>.</li>
          <li>The <b>round</b> shown is the lowest number of turns either of you has taken, plus one.</li>
          <li>
            The <b>📜 Activity</b> panel lists everything that has happened this game, newest first. Things that happened <b>since your last turn</b> are highlighted,
            so you can catch up before you roll.
          </li>
        </List>

        <H>Points & coins at a glance</H>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          {[
            ["❤️ Love / 📸 Memory", "5–15 (partner rates)"],
            ["😈 Dare", "20"],
            ["🎁 Gift", "15"],
            ["🤔 Guess", "15 each on a match"],
            ["⏱️ Timed", "30 in time, 15 late"],
            ["💑 Together", "10 each"],
            ["⭐ Passing START", "+5 pts, +3 🪙"],
            ["Any challenge that scores", "+1 🪙"],
            ["Skip / save", "0"],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col rounded-lg bg-sunken px-2.5 py-1.5">
              <span className="font-semibold">{k}</span>
              <span className="text-muted">{v}</span>
            </div>
          ))}
        </div>
        <Note>Skipping never costs points. Coins are only for the shop: spending them never lowers your score.</Note>
      </>
    ),
  },
  {
    id: "tiles",
    title: "Tiles",
    icon: "🟪",
    body: (
      <div className="space-y-2.5">
        <p className="text-xs text-muted">
          Every card is written for the player <b>whose turn it is</b> (&quot;you&quot;) and uses your partner&apos;s name, and the gold <b>👉 line</b> under the question says who does what (&quot;You guess · Bob has the real answer and decides&quot;).
        </p>
        <TileRow type="love" name="Love" points="5 / 10 / 15">
          <li>Answer out loud (or on a call), then tap <b>Done</b>. Your partner rates it: ❤️ = 5, ❤️❤️ = 10, ❤️❤️❤️ = 15.</li>
          <li>The game waits for the rating; their phone buzzes. <b>Skip</b> gives 0.</li>
          <li>In couple games you can type an optional note (up to 200 characters) before Done; it goes to your memory book.</li>
        </TileRow>
        <TileRow type="memory" name="Memory" points="5 / 10 / 15">
          <li>Exactly like Love: share the memory, tap Done, your partner rates it with 1–3 hearts.</li>
        </TileRow>
        <TileRow type="dare" name="Dare" points="20">
          <li><b>Done</b> = 20. <b>Skip</b> = 0. <b>⏳ Save for later</b> = no points now, finish it later (see <b>Dares</b>).</li>
        </TileRow>
        <TileRow type="gift" name="Gift" points="15">
          <li>Do the sweet gesture, then <b>Done</b> for 15, or <b>Skip</b>.</li>
        </TileRow>
        <TileRow type="guess" name="Guess" points="15 each">
          <li>The question is about <b>your partner</b> (&quot;What&apos;s Bob&apos;s favourite food?&quot;). <b>You</b> type a guess and <b>your partner</b> types their real answer (80 characters max).</li>
          <li>Neither text is shown until <b>both are locked in</b>. Then <b>your partner</b> decides: <b>It&apos;s a match!</b> gives both of you 15, <b>Not quite</b> gives 0.</li>
          <li>You can skip before locking in your guess.</li>
        </TileRow>
        <TileRow type="timed" name="Timed" points="30 / 15">
          <li>Tap <b>▶ Start 30s timer</b>; it counts down on both screens. Done within 30 s (1 s grace for lag) = <b>30</b>; later = <b>15</b>.</li>
          <li>Skip gives 0. Timed challenges can&apos;t be saved for later.</li>
        </TileRow>
        <TileRow type="play" name="Play" points="mini-game">
          <li>A random mini-game (never the same one twice in a row). The player who landed taps <b>▶ Let&apos;s play</b> or <b>Skip</b>.</li>
          <li><b>⚖️ This or That</b>, <b>🙊 Never Have I Ever</b>, <b>👉 Who&apos;s More Likely</b>: 3 prompts. You <b>both</b> pick in secret, then all picks are shown. Each match gives <b>both</b> of you +5, all 3 matching is +20 each.</li>
          <li><b>✍️ Finish My Sentence</b>: you type the end of a sweet sentence, your partner rates it with 1–3 hearts (5 / 10 / 15). It goes to the memory book.</li>
          <li><b>🎨 Draw It</b>: you get a secret word and draw it in <b>60 s</b>; your partner sees it live and can guess as often as they like (small typos like &quot;cats&quot; for &quot;cat&quot; count). Right guess = <b>+10 each</b>; time up or <b>Give up</b> = 0.</li>
          <li>After the results, the player who landed taps <b>Continue</b> to end the turn.</li>
        </TileRow>
        <TileRow type="wild" name="Wild" points="random">
          <li>One random effect straight away, no challenge to do:</li>
          <li><b>Swap</b> places with your partner (neither gets the new tile&apos;s challenge).</li>
          <li><b>Steal</b> up to 10 points (never below 0). In <b>co-op</b> it&apos;s a +10 bonus instead.</li>
          <li><b>Back 3</b> tiles (the tile does nothing; going back past START gives nothing).</li>
          <li><b>Double</b>: your next challenge points are doubled (2× badge). Doesn&apos;t stack.</li>
          <li>Your partner&apos;s 🛡️ Shield blocks a swap or a steal (and is used up).</li>
        </TileRow>
        <TileRow type="start" name="Start" points="+5 & 🪙3">
          <li>Passing over <b>or</b> landing on START: +5 points, +3 coins and the <b>🛒 shop opens</b>. No free cards: cards are only sold in the shop.</li>
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
          <li>Bonus roll: finish the tile you landed on, then roll again. It doesn&apos;t use up a turn. Another 6 gives another one.</li>
          <li>The dice label shows <b>&quot;🎲 Bonus roll&quot;</b> while you have one waiting.</li>
        </List>

        <H>💑 Together challenge</H>
        <List>
          <li>Landing (by roll or Teleport) on your partner&apos;s tile gives you <b>both</b> a Together challenge instead of the tile, on any tile type.</li>
          <li>Both tap <b>We did it</b> and each gets 10 (+1 coin each). Either can <b>Skip</b> it for both.</li>
          <li>Being moved onto your partner by a Wild Swap or Back 3 doesn&apos;t count. Cards can&apos;t be played on it.</li>
        </List>

        <H>✖️2 Double points</H>
        <List>
          <li>From a Wild tile. Doubles the next challenge points <b>you</b> earn: Done, ratings, Timed, Guess matches, Together, Free Pass and Mirror payouts.</li>
          <li>Not doubled: the START bonus, Wild steals or bonuses, saved dares or gifts finished later.</li>
        </List>

        <H>😂 Reactions & 🔊 sound</H>
        <List>
          <li>Tap the emoji bar under the board any time to send a reaction to both screens (a quarter-second cooldown).</li>
          <li>Sounds for dice, steps, points, your turn, the timer and winning. 🔊 in the header mutes them (remembered on this device).</li>
          <li>Phones vibrate on your turn and when your rating is needed (not on iPhone). Browsers only play sound after your first tap.</li>
        </List>
      </>
    ),
  },
  {
    id: "cards",
    title: "Cards & shop",
    icon: "🃏",
    body: (
      <>
        <H>Getting cards</H>
        <List>
          <li>Cards are <b>only sold in the shop</b>; nobody gets free cards. You can hold at most <b>3</b>. They&apos;re meant to be a rare treat.</li>
          <li>Your partner sees how many cards you have (🃏) but not which ones. Cards and coins reset on Play again.</li>
        </List>

        <H>🛒 The shop</H>
        <List>
          <li>It opens for you when you pass or land on START and stays open, even during your partner&apos;s turn, until your <b>next roll</b> (including a bonus roll) or a Teleport. Each player has their own shop.</li>
          <li>While it&apos;s open you can buy as many cards as your coins and the 3-card limit allow.</li>
          <li>
            Prices:{" "}
            {(Object.keys(POWER_UP_INFO) as PowerUp[]).map((c, i) => (
              <span key={c}>
                {i > 0 && " · "}
                {POWER_UP_INFO[c].icon} {POWER_UP_INFO[c].name} {POWER_UP_INFO[c].price}🪙
              </span>
            ))}
          </li>
          <li>Coins: +1 for every challenge that gives you points (also Mirror payouts and saved dares/gifts), +3 for each START. Skips, saves and Wild bonuses give none.</li>
        </List>

        <H>The cards</H>
        <div className="space-y-2">
          {(Object.keys(POWER_UP_INFO) as PowerUp[]).map((key) => (
            <div key={key} className="flex gap-2.5 rounded-xl bg-sunken p-3">
              <span className="text-xl">{POWER_UP_INFO[key].icon}</span>
              <div className="text-[13px] leading-relaxed">
                <p className="font-bold">
                  {POWER_UP_INFO[key].name} <span className="font-normal text-muted">· {POWER_UP_INFO[key].price}🪙</span>
                </p>
                <p className="text-white/80">{CARD_RULES[key]}</p>
              </div>
            </div>
          ))}
        </div>

        <H>When you can play a card</H>
        <List>
          <li>Free Pass, Reroll, Pass It On and Mirror: only on <b>your own</b> challenge (the one you landed on), before you&apos;ve done anything with it, from <b>Play a card</b> on the challenge card.</li>
          <li><b>One card per challenge.</b> Not on Together, not after starting a timer, not while waiting for a rating, not on a Guess once either answer is typed.</li>
          <li>Teleport replaces a roll; Shield is automatic.</li>
          <li>🎮 Play tile: cards only before you tap <b>Let&apos;s play</b>. Free Pass gives 10. Mirror only works on Finish My Sentence; Pass It On on Finish My Sentence and Draw It (your partner does it).</li>
        </List>
      </>
    ),
  },
  {
    id: "dares",
    title: "Saved & IOU",
    icon: "⏳",
    body: (
      <>
        <H>Saving a dare or gift</H>
        <List>
          <li><b>Save for later</b> is on <b>Dare</b> and <b>Gift</b> tiles (you can&apos;t always give a gift mid-game). It ends your turn with no points and adds it to <b>Saved for later</b>.</li>
          <li>Done it? Tap <b>Done</b> on it any time during the game, even on your partner&apos;s turn: you get its points (dare 20, gift 15) and 1 coin, never doubled.</li>
          <li>Only the person who saved it can mark it done. In <b>First to 150</b>, finishing one can win the game on the spot.</li>
        </List>

        <H>💌 IOU wallet (couple games)</H>
        <List>
          <li>Saved dares and gifts not done by the end of a couple game move into your <b>IOU wallet</b>, which lasts across games (the latest 50 are kept).</li>
          <li>Find it in the couple home (<b>💌 IOU</b> tab) and during couple games (&quot;IOU wallet (earlier games)&quot;).</li>
          <li>When you&apos;ve done one for real, the owner taps <b>Done</b>. No points, but it counts toward the 💌 Promise Keeper badge and shows in the activity feed.</li>
          <li>In a quick game, unfinished dares are just listed as &quot;still owed&quot; at the end.</li>
        </List>
      </>
    ),
  },
  {
    id: "couple",
    title: "Couple",
    icon: "💑",
    body: (
      <>
        <H>Your couple profile</H>
        <List>
          <li>
            Each of you <b>signs up</b> with your own name (shown in games), a <b>username</b> (3–20 letters, numbers, dots or underscores) and a <b>password</b> (6+
            characters). No email needed.
          </li>
          <li>
            One of you taps <b>Create our couple</b> and gets a code like <span className="font-mono">LOVE-7K2Q</span>. The other taps <b>Join your partner</b> and enters it.
            A couple is exactly two accounts, and an account belongs to one couple.
          </li>
          <li>After that, just <b>log in</b> with your username and password on any device; it remembers you until you tap <b>Log out</b> (up to 20 devices per account).</li>
          <li><b>5 wrong passwords lock</b> the account for 10 minutes. Couple games can start once both of you have joined.</li>
          <li>Couple games use your profile names and keep each person&apos;s colour across games.</li>
        </List>

        <H>Private couple games</H>
        <List>
          <li>Only the other half of your couple can join (logged in as the other person). One person can&apos;t take both seats.</li>
          <li>While a game is waiting, your partner sees a <b>💌 Join your game</b> button in their couple home, or can open the invite link.</li>
        </List>

        <H>Saved when a couple game ends</H>
        <List>
          <li><b>📜 History</b>: date, settings, scores, each player&apos;s numbers and the full activity log of what happened.</li>
          <li>
            <b>📖 Memory book</b>: rated Love/Memory answers (with hearts and your note), every Guess round (both answers, match or not), dares, gifts and timed
            challenges you did, saved dares and gifts you finished, and Together moments. Skipped ones aren&apos;t kept. ⭐ Star your favourites and filter by type.
          </li>
          <li><b>📊 Stats</b> per person: wins, points, best score, done vs skipped, average hearts, guess accuracy, timers beaten, cards, coins, sixes, laps and favourite tile.</li>
          <li><b>🏅 Badges</b> (below) and leftover dares to the <b>💌 IOU wallet</b>.</li>
          <li>A game is saved once it finishes. Leaving before the end saves nothing.</li>
        </List>

        <H>🏅 Badges</H>
        <div className="grid grid-cols-1 gap-1 text-[12px] sm:grid-cols-2">
          {[
            ["🏆 First Victory", "Win a competitive game"],
            ["💞 Dream Team", "Fill the love meter in co-op"],
            ["💯 Century", "Score 100+ in one game"],
            ["😍 Heart Throb", "3 hearts, three times in a game"],
            ["🔮 Mind Reader", "3 guess matches in a game"],
            ["💪 No Excuses", "No skips (at least 3 done)"],
            ["😈 Dare Devil", "4 dares in a game"],
            ["⚡ Speed Demon", "Beat the timer twice in a game"],
            ["🃏 Card Shark", "Play 2 cards in a game"],
            ["🎲 Lucky Sixes", "Roll three 6s in a game"],
            ["🌍 Globetrotter", "Pass START 3 times in a game"],
            ["🛍️ Big Spender", "Spend 20 coins in a game"],
            ["🎮 Game Night", "Play 3 mini-games in a game"],
            ["📅 Regulars", "Play 10 games together"],
            ["📅 Promise Keeper", "Complete 5 IOU dares or gifts"],
            ["📅 Soulmates", "20 guess matches in total"],
            ["📅 Storyteller", "10 memory-book notes"],
          ].map(([name, desc]) => (
            <div key={name} className="rounded-lg bg-sunken px-2.5 py-1.5">
              <span className="font-semibold">{name}</span> <span className="text-muted">· {desc}</span>
            </div>
          ))}
        </div>
        <Note>Badges are checked when a game ends. In quick games you see the ones you earned on the results screen, but they aren&apos;t kept. 📅 badges count across all your couple games.</Note>
      </>
    ),
  },
  {
    id: "settings",
    title: "Settings",
    icon: "🎛️",
    body: (
      <>
        <H>Mode & length</H>
        <List>
          <li><b>🏆 Competitive</b>: highest score wins; equal scores are a tie.</li>
          <li><b>💞 Co-op</b>: every point fills a shared love meter; reach <b>30 × rounds</b> (150 / 300 / 600) by the end to win together. Co-op always uses rounds.</li>
          <li><b>5 / 10 / 20 rounds</b> end when both players used all their turns (a pending bonus roll and an open challenge finish first). <b>First to 150</b> ends the moment someone has 150+ at the end of a turn or after finishing a saved dare or gift.</li>
        </List>

        <H>Board</H>
        <List>
          {BOARD_PRESETS.map((b) => (
            <li key={b.value}>
              <b>
                {b.icon} {b.label}
              </b>
              : {b.desc}
              {b.value === "custom" ? " (0–5 for each tile type; all zero falls back to Classic)." : "."}
            </li>
          ))}
          <li>Always START + 27 tiles. Every board except Classic is reshuffled for each new game, including Play again. &quot;Tiles on this board&quot; lists what&apos;s in play.</li>
          <li><b>⭐ Our board</b> (couple games): exactly the tile amounts set in ⚙️ Setup, shuffled for every game.</li>
        </List>

        <H>⚙️ Setup (couple admin)</H>
        <List>
          <li>The person who <b>created the couple</b> is its admin. The ⚙️ Setup tab on the couple home lets them choose, for all your couple games:</li>
          <li><b>Board</b>: exactly how many tiles of each type (27 in total). 0 turns a tile type off.</li>
          <li><b>Mini-games</b>: which ones the 🎮 PLAY tile can pick (at least one while there are PLAY tiles).</li>
          <li><b>Questions</b>: upload an Excel (.xlsx) or CSV file with the column names in the first row (Love, Dare, Memory, Gift, Guess, Timed, Together, Finish My Sentence, Never Have I Ever, Who&apos;s More Likely, This or That, Draw It) and one question per row. A list you upload <b>replaces</b> the built-in questions of that type; the others stay built-in. Up to 200 per list, 160 characters each; duplicates are skipped. This or That needs both options in one cell, like &quot;Beach / Mountains&quot;.</li>
          <li><b>⬇️ Download template</b> gives a sheet already filled with the current questions, ready to edit and upload back.</li>
          <li>Write cards for the player <b>whose turn it is</b> (&quot;you&quot;) and use <b>{"{partner}"}</b> for the other person: it&apos;s replaced with their name in the game. Guess questions are about the partner (&quot;What&apos;s {"{partner}"}&apos;s favourite food?&quot;).</li>
          <li><b>Theme</b>: the theme new games start with (the game&apos;s creator can still change it with 🎨 during the game).</li>
          <li>Changes apply to <b>new</b> games; a running game keeps its setup. Your partner can see the setup but not change it. &quot;Reset everything&quot; goes back to the built-in setup.</li>
        </List>

        <H>Theme</H>
        <List>
          <li>{THEMES.map((t) => t.label).join(", ")}. Changes the background and accent colours for both players; tile colours stay the same.</li>
          <li>Only the <b>room creator</b> sees the 🎨 button in the game header and can change the theme (and the room&apos;s accessibility) at any time; both screens update. If the creator leaves for good, the other player takes over.</li>
        </List>

        <H>🐻 Your piece</H>
        <List>
          <li>Your piece on the board is an emoji avatar in your colour. You start as 🐻 or 🐰; tap <b>your avatar on the scoreboard</b> (the ✏️ one) to pick another from over 140 animals, faces, fantasy characters, foods, love symbols and fun things, or hit 🎲 Surprise me for a random one.</li>
          <li>You can&apos;t take the one your partner has. Your pick is remembered: on this device for quick games, and on your account in couple games.</li>
        </List>

        <H>♿ Accessibility</H>
        <List>
          <li>The creator can turn on <b>Reduce motion</b>, <b>Larger text</b>, <b>High contrast</b> and <b>Colour-blind friendly</b> for the room.</li>
          <li>Each player can change any of them <b>just for themselves</b> with the ♿ button in the game header (remembered on that device; &quot;reset&quot; goes back to the room&apos;s setting).</li>
          <li>Reduce motion also turns on automatically if your device asks for less motion. It hides the floating hearts and emoji reactions (their sound still plays).</li>
          <li>Colour-blind mode uses blue and orange players, and the second player&apos;s avatar bubble is a rounded square instead of a circle.</li>
          <li>Everything works with a keyboard (visible focus ring), and the board and scores have screen-reader labels.</li>
        </List>
      </>
    ),
  },
  {
    id: "end",
    title: "Game over",
    icon: "🏁",
    body: (
      <>
        <List>
          <li>The results screen shows the scores, the love meter in co-op, the badges each player earned (<b>NEW</b> = first time ever, couple games only) and any dares still owed.</li>
          <li><b>📸 Share result card</b> makes an image with the date, scores, best moment and badges. It opens your phone&apos;s share sheet, or downloads the picture on a computer.</li>
          <li><b>Play again</b> (either player) starts a new game in the same room with the same settings. Scores, positions, coins, cards, 2× and saved dares/gifts reset; the creator goes first.</li>
          <li><b>Back to lobby</b> leaves the room.</li>
        </List>
      </>
    ),
  },
  {
    id: "connection",
    title: "Connection & app",
    icon: "📶",
    body: (
      <>
        <H>Refreshing & dropping out</H>
        <List>
          <li>Refreshing puts you straight back in your seat. Your seat is tied to <b>this browser tab</b> (a new tab is a new player), while your couple login is remembered for the whole device.</li>
          <li>If you lose connection, your partner sees you <b>offline</b> and the game waits. Come back within <b>60 seconds</b> and carry on.</li>
          <li>After 60 seconds you&apos;re removed, your partner goes back to the waiting screen and the game resets (a couple game left this way isn&apos;t saved).</li>
          <li>Games survive a server restart: open the page again within 60 seconds of it coming back.</li>
          <li><b>Leave</b> removes you right away. When both have left, the room is deleted and its code stops working. Idle rooms are deleted after a day.</li>
        </List>

        <H>📲 Install it like an app</H>
        <List>
          <li>Chrome, Edge and Android show an <b>📲 Install app</b> button (bottom right). On iPhone/iPad: Safari → Share → <b>Add to Home Screen</b>.</li>
          <li>The installed app opens full screen. You still need internet to play.</li>
        </List>

        <H>Messages you might see</H>
        <List>
          <li><b>Room not found</b> / <b>Room is full</b>: wrong code, the room is gone, or two players are already in it.</li>
          <li><b>This is a private couple game</b>: only the two accounts in that couple can join, each from their own account.</li>
          <li><b>Your partner hasn&apos;t joined your couple yet</b>: send them your couple code first.</li>
          <li><b>Not your turn</b> / <b>Finish the current challenge first</b>: wait for the glowing dice, or finish the open challenge.</li>
          <li><b>The shop opens when you pass START</b> / <b>Not enough coins</b> / <b>You can hold at most 3 cards</b>.</li>
          <li><b>Session expired</b>: log in again with your username and password.</li>
          <li><b>That username is taken</b> / <b>Wrong username or password</b>.</li>
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
      {open &&
        createPortal(
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
                <button onClick={() => setOpen(false)} className="rounded-full border border-line px-2.5 py-1 text-sm text-muted hover:text-white" aria-label="Close">
                  ✕
                </button>
              </div>

              {/* TABS */}
              <nav className="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2.5" role="tablist">
                {SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    role="tab"
                    aria-selected={s.id === active}
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
              <div key={section.id} className="flex-1 overflow-y-auto px-5 py-4" role="tabpanel">
                {section.body}
              </div>

              {/* FOOTER NAV */}
              <div className="flex items-center justify-between border-t border-line px-5 py-3">
                <button onClick={() => setActive(SECTIONS[index - 1].id)} disabled={index === 0} className="text-sm text-muted hover:text-white disabled:opacity-30">
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
