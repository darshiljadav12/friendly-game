"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { socket, getPlayerId, getSavedRoom, saveRoom } from "../lib/socket";
import { sound, vibrate } from "../lib/sound";
import {
  BOARD_LAYOUT,
  POWER_UP_INFO,
  TILE_INFO,
  TILE_THEMES,
  playerTheme,
  sphereStyle,
  tileStyle,
} from "./constants";
import type { GameEvent, GameLength, GameMode, GameState, Move, PowerUp, Reaction, RoomUpdate, Settings } from "./types";
import Dice from "./Dice";
import Lobby from "./components/Lobby";
import HowToPlay from "./components/HowToPlay";
import ChallengeCard, { type ChallengeAction } from "./components/ChallengeCard";
import { FloatingReactions, ReactionBar, type FloatingReaction } from "./components/Reactions";

gsap.defaults({
  overwrite: "auto",
});

const TOKEN_SIZE = 24;
const DICE_SETTLE_MS = 600; // let the dice land before the token starts moving
const STEP_DURATION = 0.3;
const TOAST_MS = 4000;

const LEGEND_TILES = ["love", "memory", "dare", "gift", "guess", "timed", "wild", "start"] as const;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Position (relative to the board) that centers a token on a tile.
// Uses layout offsets rather than screen rects so tile animations don't skew it.
function tokenPoint(tile: HTMLElement | null | undefined, offset = 0) {
  if (!tile) return null;

  return {
    x: tile.offsetLeft + tile.offsetWidth / 2 - TOKEN_SIZE / 2 + offset,
    y: tile.offsetTop + tile.offsetHeight / 2 - TOKEN_SIZE / 2 + 2,
  };
}

function settingsLabel(settings: Settings) {
  const mode = settings.mode === "coop" ? "💞 Co-op" : "🏆 Competitive";
  const length = settings.rounds ? `${settings.rounds} rounds` : `First to ${settings.target}`;
  return `${mode} · ${length}`;
}

// Fixed values (not random) so server and client render the same markup
const FLOATING_HEARTS = [
  { left: "6%", size: 18, duration: 22, delay: 0 },
  { left: "18%", size: 12, duration: 28, delay: -9 },
  { left: "34%", size: 22, duration: 25, delay: -16 },
  { left: "52%", size: 14, duration: 30, delay: -4 },
  { left: "68%", size: 20, duration: 24, delay: -12 },
  { left: "82%", size: 12, duration: 27, delay: -20 },
  { left: "93%", size: 16, duration: 23, delay: -7 },
];

function FloatingHearts() {
  return (
    <div aria-hidden>
      {FLOATING_HEARTS.map((h, i) => (
        <span
          key={i}
          className="float-heart text-rose"
          style={{ left: h.left, fontSize: h.size, animationDuration: `${h.duration}s`, animationDelay: `${h.delay}s` }}
        >
          ♥
        </span>
      ))}
    </div>
  );
}

export default function Home() {
  const [myId] = useState(() => (typeof window === "undefined" ? "" : getPlayerId()));
  const [game, setGame] = useState<GameState | null>(null);
  const [diceValue, setDiceValue] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<GameEvent | null>(null);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [muted, setMuted] = useState(() => (typeof window === "undefined" ? false : sound.isMuted()));

  const tileRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const tokenRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hopRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const challengeRef = useRef<HTMLElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const queue = useRef<RoomUpdate[]>([]);
  const prevScores = useRef<Record<string, number>>({});

  // ---------------------------
  // TOKEN POSITIONING
  // ---------------------------
  const placeTokens = (state: GameState | null, animate: boolean) => {
    if (!state) return;

    state.players.forEach((p) => {
      // Spread tokens out when players share a tile
      const sharing = state.players.filter((o) => o.position === p.position);
      const slot = sharing.findIndex((o) => o.id === p.id);
      const offset = (slot - (sharing.length - 1) / 2) * TOKEN_SIZE * 0.8;

      const el = tokenRefs.current[p.id];
      const point = tokenPoint(tileRefs.current[p.position], offset);
      if (!el || !point) return;

      if (animate) gsap.to(el, { ...point, duration: 0.35, ease: "power2.out" });
      else gsap.set(el, point);
    });
  };

  useLayoutEffect(() => {
    placeTokens(game, true);
  }, [game]);

  useEffect(() => {
    const onResize = () => placeTokens(gameRef.current, false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ---------------------------
  // SOCKETS
  // ---------------------------
  useEffect(() => {
    let processing = false;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;

    const animateMove = (move: Move) =>
      new Promise<void>((resolve) => {
        const el = tokenRefs.current[move.playerId];
        const hop = hopRefs.current[move.playerId];
        if (!el) return resolve();

        const tl = gsap.timeline({ onComplete: () => resolve() });

        move.steps.forEach((step) => {
          const tile = tileRefs.current[step];
          const point = tokenPoint(tile);
          if (!tile || !point) return;

          tl.call(() => sound.step());
          tl.to(el, { ...point, duration: STEP_DURATION, ease: "power1.inOut" });
          // little jump on every step
          if (hop) {
            tl.to(hop, { y: -14, scale: 1.15, duration: STEP_DURATION / 2, yoyo: true, repeat: 1, ease: "power1.out" }, "<");
          }
          tl.to(tile, { y: 3, duration: 0.1, yoyo: true, repeat: 1, ease: "power1.out" }, `<${STEP_DURATION * 0.8}`);
        });

        const lastTile = tileRefs.current[move.steps[move.steps.length - 1]];
        if (lastTile) {
          tl.fromTo(
            lastTile,
            { filter: "brightness(1)" },
            { filter: "brightness(1.5)", duration: 0.3, yoyo: true, repeat: 1 },
          );
        }

        if (tl.duration() === 0) resolve();
      });

    const showToast = (event: GameEvent) => {
      clearTimeout(toastTimer);
      setToast(event);
      toastTimer = setTimeout(() => setToast(null), TOAST_MS);
    };

    // Sounds, vibration and toasts for what changed between two states
    const notify = (prev: GameState | null, next: GameState) => {
      if (!prev) return;

      if (next.event && next.event.id !== prev.event?.id) {
        showToast(next.event);
        sound.event();
      }

      const prevTurn = prev.phase === "playing" ? prev.players[prev.turn]?.id : null;
      const nextTurn = next.phase === "playing" ? next.players[next.turn]?.id : null;
      if (nextTurn === myId && prevTurn !== myId) {
        sound.turn();
        vibrate(120);
      }

      const c = next.challenge;
      if (c?.stage === "rating" && prev.challenge?.stage !== "rating" && c.playerId !== myId) {
        sound.turn();
        vibrate([80, 60, 80]);
      }
      if (c?.stage === "reveal" && prev.challenge?.stage !== "reveal") sound.event();

      if (next.phase === "finished" && prev.phase !== "finished") sound.win();
    };

    // Updates are applied one at a time so a move animation is never skipped
    const processQueue = async () => {
      if (processing) return;
      processing = true;

      while (queue.current.length > 0) {
        const { state, move } = queue.current.shift()!;

        if (move && gameRef.current) {
          setDiceValue(move.dice);
          setIsRolling(false);
          setIsMoving(true);
          await wait(DICE_SETTLE_MS);
          await animateMove(move);
          setIsMoving(false);
        }

        notify(gameRef.current, state);

        const remaining = state.challenge?.remainingMs;
        setTimerEndsAt(remaining == null ? null : Date.now() + remaining);

        gameRef.current = state;
        setGame(state);
      }

      processing = false;
    };

    const resetToLobby = () => {
      saveRoom(null);
      queue.current = [];
      gameRef.current = null;
      setGame(null);
    };

    const onConnect = () => {
      setConnected(true);
      const savedRoom = getSavedRoom();
      if (savedRoom) socket.emit("rejoinRoom", { roomId: savedRoom, playerId: myId });
    };

    const onDisconnect = () => setConnected(false);

    const onJoined = ({ roomId }: { roomId: string }) => {
      saveRoom(roomId);
      setError(null);
    };

    const onRoomState = (update: RoomUpdate) => {
      queue.current.push(update);
      processQueue();
    };

    const onDiceRolling = () => {
      setIsRolling(true);
      sound.roll();
    };

    const onReaction = (reaction: Reaction) => {
      const index = gameRef.current?.players.findIndex((p) => p.id === reaction.playerId) ?? 0;
      const item: FloatingReaction = {
        id: reaction.id,
        emoji: reaction.emoji,
        left: 8 + Math.random() * 84,
        color: playerTheme(Math.max(0, index)).base,
      };
      sound.pop();
      setReactions((list) => [...list, item]);
      setTimeout(() => setReactions((list) => list.filter((r) => r.id !== item.id)), 2300);
    };

    const onError = (message: string) => {
      setError(message);
      setIsRolling(false);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("joined", onJoined);
    socket.on("rejoinFailed", resetToLobby);
    socket.on("roomState", onRoomState);
    socket.on("diceRolling", onDiceRolling);
    socket.on("reaction", onReaction);
    socket.on("errorMessage", onError);

    socket.connect();

    return () => {
      clearTimeout(toastTimer);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("joined", onJoined);
      socket.off("rejoinFailed", resetToLobby);
      socket.off("roomState", onRoomState);
      socket.off("diceRolling", onDiceRolling);
      socket.off("reaction", onReaction);
      socket.off("errorMessage", onError);
      socket.disconnect();
    };
  }, [myId]);

  // ---------------------------
  // ANIMATIONS
  // ---------------------------
  useEffect(() => {
    if (!game) return;

    let gained = false;
    game.players.forEach((p) => {
      const prev = prevScores.current[p.id] ?? 0;

      if (p.score > prev) {
        gained = true;
        const el = document.getElementById(`score-${p.id}`);
        if (el) {
          gsap.fromTo(el, { scale: 1 }, { scale: 1.5, duration: 0.2, yoyo: true, repeat: 1, ease: "back.out(2)" });
        }
      }

      prevScores.current[p.id] = p.score;
    });

    if (gained) sound.points();
  }, [game]);

  const challengeQuestion = game?.challenge?.question;

  useEffect(() => {
    const card = challengeRef.current;
    if (!challengeQuestion || !card) return;

    // card flips in like it's being turned over
    const tl = gsap.timeline();
    tl.fromTo(
      card,
      { rotateY: -90, opacity: 0, transformPerspective: 800 },
      { rotateY: 0, opacity: 1, duration: 0.6, ease: "back.out(1.4)" },
    );

    return () => {
      tl.kill();
    };
  }, [challengeQuestion]);

  // ---------------------------
  // DERIVED STATE
  // ---------------------------
  const currentPlayer = game?.players[game.turn];
  const me = game?.players.find((p) => p.id === myId);
  const partner = game?.players.find((p) => p.id !== myId);
  const challenge = game?.challenge ?? null;
  const isMyTurn = game?.phase === "playing" && currentPlayer?.id === myId;
  const canRoll = isMyTurn && !challenge && !isRolling && !isMoving && connected;
  const activeColor = game ? playerTheme(game.turn).base : "#fb7185";
  const isCoop = game?.settings.mode === "coop";
  const teamScore = game?.players.reduce((sum, p) => sum + p.score, 0) ?? 0;

  const round =
    game?.settings.rounds != null
      ? Math.min(Math.min(...game.players.map((p) => p.turnsTaken)) + 1, game.settings.rounds)
      : 0;

  let status = "";
  if (!connected) status = "Reconnecting to server…";
  else if (partner && !partner.connected) status = `${partner.username} lost connection, waiting for them to come back…`;
  else if (isRolling || isMoving) status = "Rolling…";
  else if (challenge) status = challenge.playerId === myId || challenge.type === "together" ? "Your move on the challenge card" : `${game?.players.find((p) => p.id === challenge.playerId)?.username} is on a challenge…`;
  else if (isMyTurn) status = game?.freeRoll ? "Bonus roll! Tap the dice again 🎲" : "Your turn: tap the dice";
  else if (currentPlayer) status = `Waiting for ${currentPlayer.username}…`;

  const savedDares =
    game?.players.flatMap((p, i) => p.savedDares.map((dare) => ({ ...dare, owner: p, ownerIndex: i }))) ?? [];

  // ---------------------------
  // ACTIONS
  // ---------------------------
  const createRoom = (username: string, settings: { mode: GameMode; length: GameLength }) => {
    socket.emit("createRoom", { username, playerId: myId, settings });
  };

  const joinRoom = (username: string, roomCode: string) => {
    socket.emit("joinRoom", { roomId: roomCode, username, playerId: myId });
  };

  const rollDice = () => {
    if (!canRoll) return;
    setError(null);
    setIsRolling(true);
    socket.emit("rollDice");
  };

  const challengeAction = (action: ChallengeAction, extra: { hearts?: number; text?: string } = {}) => {
    setError(null);
    socket.emit("challengeAction", { action, ...extra });
  };

  const usePowerUp = (card: PowerUp) => {
    setError(null);
    socket.emit("usePowerUp", { card });
  };

  const completeSavedDare = (dareId: string) => {
    socket.emit("completeSavedDare", { dareId });
  };

  const react = (emoji: string) => socket.emit("react", { emoji });

  const toggleMute = () => {
    sound.setMuted(!muted);
    setMuted(!muted);
  };

  const playAgain = () => socket.emit("playAgain");

  const leaveRoom = () => {
    socket.emit("leaveRoom");
    saveRoom(null);
    queue.current = [];
    gameRef.current = null;
    setGame(null);
  };

  const copyCode = async () => {
    if (!game) return;
    try {
      await navigator.clipboard.writeText(game.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard is unavailable on plain http; the code is visible anyway
    }
  };

  const errorBanner = error && (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose-100">
      <span>{error}</span>
      <button onClick={() => setError(null)} className="text-rose-200 hover:text-white" aria-label="Dismiss">
        ✕
      </button>
    </div>
  );

  const logo = (
    <div className="text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 border border-line text-3xl shadow-[0_4px_0_var(--sunken)]">
        💞
      </div>
      <h1 className="text-3xl font-black tracking-tight title-gradient">Friendly Game</h1>
    </div>
  );

  const muteButton = (
    <button
      onClick={toggleMute}
      className="rounded-full border border-line bg-surface px-2.5 py-1 text-sm hover:border-line-strong"
      aria-label={muted ? "Unmute" : "Mute"}
      title={muted ? "Sound off" : "Sound on"}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );

  // ---------------------------
  // RENDER
  // ---------------------------
  return (
    <div className="relative min-h-screen p-4 sm:p-8">
      <FloatingHearts />
      <FloatingReactions items={reactions} />

      {/* ANNOUNCEMENT TOAST */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4">
          <div
            key={toast.id}
            className="toast-in panel max-w-lg px-4 py-2.5 text-center text-sm font-semibold border-gold/40"
          >
            {toast.text}
          </div>
        </div>
      )}

      <div className="relative z-10">
        {!game ? (
          <Lobby
            connected={connected}
            logo={logo}
            errorBanner={errorBanner}
            onError={setError}
            onCreate={createRoom}
            onJoin={joinRoom}
          />
        ) : game.phase === "waiting" ? (
          /* WAITING FOR PARTNER */
          <div className="flex min-h-[85vh] items-center justify-center">
            <div className="panel w-full max-w-[400px] p-7 space-y-5 text-center">
              {logo}

              <div>
                <h2 className="text-lg font-bold">Waiting for your partner</h2>
                <p className="mt-1 text-muted text-sm">Share this room code with them</p>
              </div>

              <button
                onClick={copyCode}
                className="btn btn-secondary w-full py-4 font-mono text-4xl tracking-[0.35em] text-gold"
                title="Copy code"
              >
                {game.id}
              </button>
              <p className="text-xs text-muted">{copied ? "✅ Copied!" : "Tap the code to copy it"}</p>

              <p className="inline-block rounded-full border border-line bg-sunken px-3 py-1 text-xs text-muted">
                {settingsLabel(game.settings)}
              </p>

              <div className="flex justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-rose animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>

              {errorBanner}

              <div className="flex items-center justify-center gap-4">
                <HowToPlay variant="link" />
                <button onClick={leaveRoom} className="text-sm text-muted hover:text-white underline">
                  Leave room
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* GAME */
          <div className="mx-auto max-w-6xl">
            {/* HEADER */}
            <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💞</span>
                <span className="text-xl font-black title-gradient">Friendly Game</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="hidden sm:inline rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
                  {settingsLabel(game.settings)}
                </span>
                <span className="rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs text-muted">
                  Room <span className="text-gold">{game.id}</span>
                </span>
                <HowToPlay />
                {muteButton}
                <button onClick={leaveRoom} className="text-xs text-muted hover:text-white underline">
                  Leave
                </button>
              </div>
            </header>

            <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
              {/* =========================
                  SIDEBAR
              ========================== */}
              <aside className="w-full lg:w-[320px] flex flex-col gap-4">
                {/* SCOREBOARD */}
                <section className="panel p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="panel-label">{isCoop ? "Team" : "Scoreboard"}</h2>
                    <span className="rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold text-muted">
                      {game.settings.rounds ? `Round ${round} / ${game.settings.rounds}` : `First to ${game.settings.target}`}
                    </span>
                  </div>

                  {/* CO-OP LOVE METER */}
                  {isCoop && game.settings.coopGoal && (
                    <div className="mb-3">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-semibold">💞 Love meter</span>
                        <span className="text-muted">
                          <span className="font-black text-rose">{teamScore}</span> / {game.settings.coopGoal}
                        </span>
                      </div>
                      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-sunken shadow-inner">
                        <div
                          className="h-full rounded-full transition-[width] duration-700"
                          style={{
                            width: `${Math.min(100, (teamScore / game.settings.coopGoal) * 100)}%`,
                            background: "linear-gradient(90deg, var(--rose), var(--gold))",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {game.players.map((p, i) => {
                      const isActive = game.phase === "playing" && game.turn === i;
                      const theme = playerTheme(i);

                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-xl border p-2.5 transition-colors duration-300"
                          style={{
                            background: isActive ? "var(--surface-2)" : "var(--sunken)",
                            borderColor: isActive ? theme.base : "transparent",
                          }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-[#1b1020] ${
                                p.connected ? "" : "opacity-40 grayscale"
                              }`}
                              style={sphereStyle(i)}
                            >
                              {p.username[0]?.toUpperCase()}
                            </div>

                            <div className="text-sm">
                              <p className="font-semibold">
                                {p.username}
                                {p.id === myId && <span className="font-normal text-muted"> (you)</span>}
                              </p>
                              <p className="flex items-center gap-1.5 text-xs text-muted">
                                {p.connected
                                  ? game.settings.rounds
                                    ? `${p.turnsTaken}/${game.settings.rounds} turns`
                                    : `${p.turnsTaken} turns`
                                  : "offline"}
                                {p.powerUps.length > 0 && <span title="Power-up cards">🃏{p.powerUps.length}</span>}
                                {p.doubleNext && (
                                  <span className="rounded bg-gold px-1 text-[10px] font-black text-[#451a03]" title="Next challenge doubled">
                                    2×
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div id={`score-${p.id}`} className="text-xl font-black" style={{ color: theme.base }}>
                            {p.score}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* STATUS */}
                {game.phase === "playing" && status && (
                  <section className="panel flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full animate-pulse" style={{ background: activeColor }} />
                    <span>{status}</span>
                  </section>
                )}

                {errorBanner}

                {/* CHALLENGE CARD */}
                {challenge && (
                  <ChallengeCard
                    key={`${challenge.question}-${challenge.ownerId}`}
                    ref={challengeRef}
                    game={game}
                    challenge={challenge}
                    myId={myId}
                    timerEndsAt={timerEndsAt}
                    onAction={challengeAction}
                    onUsePowerUp={usePowerUp}
                  />
                )}

                {/* MY POWER-UP CARDS */}
                <section className="panel p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="panel-label">🃏 Your cards</h2>
                    <span className="text-xs text-muted">{me?.powerUps.length ?? 0} / 3</span>
                  </div>
                  {me && me.powerUps.length > 0 ? (
                    <ul className="space-y-1.5">
                      {me.powerUps.map((card, i) => (
                        <li key={`${card}-${i}`} className="flex items-center gap-2.5 rounded-xl bg-sunken px-3 py-2">
                          <span className="text-lg">{POWER_UP_INFO[card].icon}</span>
                          <div>
                            <p className="text-sm font-semibold">{POWER_UP_INFO[card].name}</p>
                            <p className="text-[11px] text-muted">{POWER_UP_INFO[card].desc}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted">Pass START to earn a card. Play cards from the challenge card.</p>
                  )}
                </section>

                {/* SAVED DARES */}
                {savedDares.length > 0 && (
                  <section className="panel p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="panel-label">⏳ Saved dares</h2>
                      <span className="rounded-full bg-sunken px-2 py-0.5 text-xs font-semibold text-muted">
                        {savedDares.length}
                      </span>
                    </div>

                    <ul className="space-y-2">
                      {savedDares.map((dare) => (
                        <li
                          key={dare.id}
                          className="rounded-xl bg-sunken p-3 border-l-4"
                          style={{ borderLeftColor: playerTheme(dare.ownerIndex).base }}
                        >
                          <p className="text-sm leading-snug">{dare.question}</p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-xs text-muted">
                              {dare.owner.id === myId ? "You" : dare.owner.username} · +{dare.points} pts
                            </span>
                            {dare.owner.id === myId && game.phase === "playing" && (
                              <button
                                onClick={() => completeSavedDare(dare.id)}
                                className="btn btn-primary px-3 py-1 text-xs"
                              >
                                Done
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* HOW TO PLAY */}
                <details className="panel p-4 group">
                  <summary className="panel-label cursor-pointer list-none flex items-center justify-between">
                    Tiles &amp; rules
                    <span className="transition-transform group-open:rotate-180">▾</span>
                  </summary>
                  <div className="mt-3 space-y-1.5">
                    {LEGEND_TILES.map((type) => (
                      <div key={type} className="flex items-center gap-2.5 rounded-lg bg-sunken px-2 py-1.5">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm"
                          style={tileStyle(type)}
                        >
                          {TILE_THEMES[type].icon}
                        </span>
                        <div className="leading-tight">
                          <p className="text-xs font-bold">{TILE_INFO[type].label}</p>
                          <p className="text-[11px] text-muted">{TILE_INFO[type].sub}</p>
                        </div>
                      </div>
                    ))}
                    <ul className="mt-2 space-y-1 text-[11px] text-muted list-disc pl-4">
                      <li>Roll a 6 for a bonus roll.</li>
                      <li>Land on your partner for a 💑 together challenge.</li>
                    </ul>
                  </div>
                </details>
              </aside>

              {/* =========================
                  BOARD
              ========================== */}
              <div className="flex-1 flex flex-col items-center gap-4">
                <div className="board-frame relative grid grid-cols-8 w-full max-w-160 aspect-square p-2 sm:p-3 gap-1 sm:gap-1.5 rounded-2xl">
                  {BOARD_LAYOUT.map((tileIndex, i) => {
                    const type = tileIndex === null ? undefined : game.board[tileIndex];
                    if (tileIndex === null || !type) return <div key={i} />;

                    return (
                      <div
                        key={i}
                        ref={(el) => {
                          tileRefs.current[tileIndex] = el;
                        }}
                        className="relative flex flex-col items-center justify-center rounded-md sm:rounded-lg text-center leading-none"
                        style={tileStyle(type)}
                        title={`${TILE_INFO[type].label}: ${TILE_INFO[type].sub}`}
                      >
                        <div className="text-sm sm:text-lg">{TILE_THEMES[type].icon}</div>
                        <div className="mt-0.5 sm:mt-1 text-[6px] sm:text-[8px] font-bold tracking-widest text-white/85">
                          {TILE_INFO[type].label}
                        </div>
                      </div>
                    );
                  })}

                  {/* PLAYERS */}
                  <div className="absolute inset-0 pointer-events-none z-10">
                    {game.players.map((p, idx) => (
                      <div
                        key={p.id}
                        ref={(el) => {
                          tokenRefs.current[p.id] = el;
                        }}
                        className="absolute top-0 left-0"
                        style={{ width: TOKEN_SIZE, height: TOKEN_SIZE }}
                      >
                        <div
                          ref={(el) => {
                            hopRefs.current[p.id] = el;
                          }}
                          className="w-full h-full"
                        >
                          <div
                            className={`w-full h-full rounded-full flex items-center justify-center text-[10px] font-black text-[#1b1020] border-2 border-[#fdf2f8] ${
                              game.phase === "playing" && game.turn === idx && !isMoving ? "token-active" : ""
                            } ${p.connected ? "" : "opacity-40 grayscale"}`}
                            style={sphereStyle(idx)}
                          >
                            {p.username[0]?.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* CENTER: DICE */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <button
                      onClick={rollDice}
                      disabled={!canRoll}
                      aria-label="Roll dice"
                      className={`rounded-2xl border-4 bg-surface p-5 sm:p-6 transition-[transform,border-color] duration-300 ${
                        canRoll ? "dice-ready hover:scale-105 cursor-pointer" : "cursor-not-allowed"
                      }`}
                      style={
                        {
                          borderColor: activeColor,
                          "--glow": `${activeColor}66`,
                          boxShadow: "0 6px 0 var(--sunken)",
                        } as React.CSSProperties
                      }
                    >
                      <Dice value={diceValue} rolling={isRolling} color={activeColor} />
                    </button>

                    {game.phase === "playing" && currentPlayer && (
                      <div
                        className="rounded-full border bg-surface px-3 py-1 text-[11px] sm:text-xs font-bold"
                        style={{ borderColor: activeColor, color: activeColor }}
                      >
                        {game.freeRoll ? "🎲 Bonus roll · " : ""}
                        {isMyTurn ? "Your turn" : `${currentPlayer.username}'s turn`}
                      </div>
                    )}
                  </div>

                  {/* GAME OVER */}
                  {game.phase === "finished" && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-[#1b1020]/85 backdrop-blur-sm">
                      <div className="panel w-[min(320px,90%)] max-h-[92%] overflow-y-auto p-6 text-center space-y-4">
                        <div className="text-5xl animate-bounce">
                          {isCoop ? (game.coopWon ? "💞" : "🥺") : game.winnerIds.length > 1 ? "💞" : "🏆"}
                        </div>
                        <h2 className="text-2xl font-black title-gradient">
                          {isCoop
                            ? game.coopWon
                              ? "You did it together!"
                              : "So close!"
                            : game.winnerIds.length > 1
                              ? "It's a tie!"
                              : game.winnerIds[0] === myId
                                ? "You win!"
                                : `${game.players.find((p) => p.id === game.winnerIds[0])?.username} wins!`}
                        </h2>

                        {isCoop && (
                          <p className="text-sm text-muted">
                            Love meter: <span className="font-black text-rose">{teamScore}</span> / {game.settings.coopGoal}
                          </p>
                        )}

                        <div className="space-y-1.5 text-sm">
                          {game.players
                            .map((p, i) => ({ p, i }))
                            .sort((a, b) => b.p.score - a.p.score)
                            .map(({ p, i }) => (
                              <div key={p.id} className="flex items-center justify-between rounded-xl bg-sunken px-3 py-2">
                                <span className="flex items-center gap-2">
                                  <span className="w-4 h-4 rounded-full" style={sphereStyle(i)} />
                                  {p.username}
                                </span>
                                <span className="font-black" style={{ color: playerTheme(i).base }}>
                                  {p.score}
                                </span>
                              </div>
                            ))}
                        </div>

                        {savedDares.length > 0 && (
                          <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-left">
                            <p className="panel-label text-gold">⏳ Dares still owed</p>
                            <ul className="mt-2 space-y-1 text-xs">
                              {savedDares.map((dare) => (
                                <li key={dare.id}>
                                  <span className="font-semibold" style={{ color: playerTheme(dare.ownerIndex).base }}>
                                    {dare.owner.username}:
                                  </span>{" "}
                                  {dare.question}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <button onClick={playAgain} className="btn btn-primary w-full p-3">
                          Play again
                        </button>
                        <button onClick={leaveRoom} className="text-sm text-muted hover:text-white underline">
                          Back to lobby
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* REACTIONS */}
                <div className="w-full max-w-sm">
                  <ReactionBar onReact={react} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
