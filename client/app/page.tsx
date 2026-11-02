"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { gsap } from "gsap";
import { socket, adoptPlayerId, getPlayerId, getSavedRoom, saveRoom, subscribePlayerId } from "../lib/socket";
import { sound, vibrate } from "../lib/sound";
import { accountSession, request } from "../lib/couple";
import { a11yPrefs, effectiveA11y, prefersReducedMotion } from "../lib/prefs";
import {
  BOARD_LAYOUT,
  DEFAULT_NEW_GAME,
  POWER_UP_INFO,
  TILE_INFO,
  TILE_THEMES,
  needsMyAction,
  playerTheme,
  setColorBlindPalette,
  sphereStyle,
  tileStyle,
} from "./constants";
import type {
  AccountSession,
  AccountView,
  CoupleOverview,
  GameEvent,
  GameState,
  Meta,
  Move,
  NewGameSettings,
  PowerUp,
  Reaction,
  RoomUpdate,
  Settings,
} from "./types";
import Dice from "./Dice";
import Lobby from "./components/Lobby";
import HowToPlay from "./components/HowToPlay";
import ChallengeCard, { type ChallengeAction } from "./components/ChallengeCard";
import ActivityLog from "./components/ActivityLog";
import Shop from "./components/Shop";
import Invite from "./components/Invite";
import PrefsMenu from "./components/PrefsMenu";
import ThemeMenu from "./components/ThemeMenu";
import GameOver from "./components/GameOver";
import { IouWallet } from "./components/CoupleTabs";
import { FloatingReactions, ReactionBar, type FloatingReaction } from "./components/Reactions";

gsap.defaults({
  overwrite: "auto",
});

const TOKEN_SIZE = 24;
const DICE_SETTLE_MS = 600; // let the dice land before the token starts moving
const STEP_DURATION = 0.3;
const TOAST_MS = 4000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The player id never changes during a session, so nothing to subscribe to
const noopSubscribe = () => () => {};

// Invite links land on /?join=CODE; read it once and clean the URL
let inviteCode: string | null = null;
function getInviteCode() {
  if (inviteCode === null) {
    const params = new URLSearchParams(window.location.search);
    inviteCode = (params.get("join") ?? "").toUpperCase().slice(0, 5);
    if (params.has("join")) window.history.replaceState(null, "", window.location.pathname);
  }
  return inviteCode;
}

const reduceMotionNow = () => document.documentElement.hasAttribute("data-reduce-motion");

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
  // Browser-only values via useSyncExternalStore: the server snapshot is used while
  // hydrating, so the first client render matches the server HTML exactly
  const myId = useSyncExternalStore(subscribePlayerId, getPlayerId, () => "");
  const muted = useSyncExternalStore(sound.subscribe, sound.isMuted, () => false);
  const session = useSyncExternalStore(accountSession.subscribe, accountSession.get, () => null);
  const localA11y = useSyncExternalStore(a11yPrefs.subscribe, a11yPrefs.get, a11yPrefs.getServer);
  const joinCode = useSyncExternalStore(noopSubscribe, getInviteCode, () => "");

  const [game, setGame] = useState<GameState | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [account, setAccount] = useState<AccountView | null>(null);
  const overview = account?.overview ?? null;
  const mySlot = account?.slot ?? null;
  const mySlotRef = useRef<0 | 1 | null>(null);
  const [newGame, setNewGame] = useState<NewGameSettings>(DEFAULT_NEW_GAME);
  const [diceValue, setDiceValue] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<GameEvent | null>(null);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [shopOpen, setShopOpen] = useState(false);
  const [teleporting, setTeleporting] = useState(false);

  const tileRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const tokenRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hopRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const challengeRef = useRef<HTMLElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const queue = useRef<RoomUpdate[]>([]);
  const prevScores = useRef<Record<string, number>>({});
  const autoJoined = useRef(false);

  // ---------------------------
  // THEME + ACCESSIBILITY
  // ---------------------------
  // In a room: what the creator picked. In the lobby: a live preview of the settings form.
  const roomA11y = game?.settings.a11y ?? newGame.a11y;
  const a11y = effectiveA11y(roomA11y, localA11y);
  const theme = game?.settings.theme ?? newGame.theme;
  setColorBlindPalette(a11y.colorBlind);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    // Phone status bar / browser bar follows the theme too
    const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => bg && meta.setAttribute("content", bg));
    root.toggleAttribute("data-reduce-motion", a11y.reduceMotion || prefersReducedMotion());
    root.toggleAttribute("data-large-text", a11y.largeText);
    root.toggleAttribute("data-high-contrast", a11y.highContrast);
    root.toggleAttribute("data-colorblind", a11y.colorBlind);
  }, [theme, a11y.reduceMotion, a11y.largeText, a11y.highContrast, a11y.colorBlind]);

  // Couple players keep the same colour across games (by seat), quick games use join order
  const colorIndex = useCallback(
    (playerId: string) => {
      const players = game?.players ?? [];
      const index = players.findIndex((p) => p.id === playerId);
      const slot = players[index]?.slot;
      return slot === 0 || slot === 1 ? slot : Math.max(0, index);
    },
    [game?.players],
  );

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

      if (animate && !reduceMotionNow()) gsap.to(el, { ...point, duration: 0.35, ease: "power2.out" });
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
    // "" during hydration; connect only once the real id is known, otherwise
    // the rejoin would be rejected and the saved room forgotten
    if (!myId) return;

    let processing = false;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;

    const animateMove = (move: Move) =>
      new Promise<void>((resolve) => {
        const el = tokenRefs.current[move.playerId];
        const hop = hopRefs.current[move.playerId];
        if (!el) return resolve();

        const fast = reduceMotionNow();
        const step = fast ? 0.05 : move.dice === null ? 0.6 : STEP_DURATION; // teleport is one long jump
        const tl = gsap.timeline({ onComplete: () => resolve() });

        move.steps.forEach((index) => {
          const tile = tileRefs.current[index];
          const point = tokenPoint(tile);
          if (!tile || !point) return;

          tl.call(() => sound.step());
          tl.to(el, { ...point, duration: step, ease: "power1.inOut" });
          // little jump on every step
          if (hop && !fast) {
            tl.to(hop, { y: move.dice === null ? -40 : -14, scale: 1.15, duration: step / 2, yoyo: true, repeat: 1, ease: "power1.out" }, "<");
          }
          if (!fast) tl.to(tile, { y: 3, duration: 0.1, yoyo: true, repeat: 1, ease: "power1.out" }, `<${step * 0.8}`);
        });

        const lastTile = tileRefs.current[move.steps[move.steps.length - 1]];
        if (lastTile && !fast) {
          tl.fromTo(lastTile, { filter: "brightness(1)" }, { filter: "brightness(1.5)", duration: 0.3, yoyo: true, repeat: 1 });
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

      // The challenge card now waits for me (skip it when I just landed on my own challenge: I'm already looking)
      const c = next.challenge;
      const justLandedMyself = !prev.challenge && c?.ownerId === myId;
      if (needsMyAction(c, myId) && !needsMyAction(prev.challenge, myId) && !justLandedMyself) {
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
          if (move.dice !== null) setDiceValue(move.dice);
          setIsRolling(false);
          setIsMoving(true);
          if (move.dice !== null) await wait(reduceMotionNow() ? 100 : DICE_SETTLE_MS);
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

    // Re-validates the saved account session and subscribes to live couple updates
    const authAccount = async () => {
      const s = accountSession.get();
      if (!s) return;
      const res = await request<AccountView>("accountAuth", s);
      if (res.error) {
        // Only forget the session when the server says it's invalid, not on a timeout
        if (!res.error.includes("didn't answer")) accountSession.set(null);
        setAccount(null);
      } else setAccount(res);
    };

    const onConnect = () => {
      setConnected(true);
      const savedRoom = getSavedRoom();
      if (savedRoom) socket.emit("rejoinRoom", { roomId: savedRoom, playerId: myId, couple: accountSession.get() });
      authAccount();
    };

    const onDisconnect = () => setConnected(false);

    const onJoined = ({ roomId, playerId }: { roomId: string; playerId: string }) => {
      saveRoom(roomId);
      setError(null);
      adoptPlayerId(playerId); // differs only when this browser took over a seat (reconnects as that seat)
    };

    // The same account continued this game in another browser: this one is signed out
    const onSeatMoved = () => {
      resetToLobby();
      accountSession.set(null);
      setAccount(null);
      setError("You continued this game in another browser, so you were logged out here");
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
      const players = gameRef.current?.players ?? [];
      const index = players.findIndex((p) => p.id === reaction.playerId);
      const slot = players[index]?.slot;
      const item: FloatingReaction = {
        id: reaction.id,
        emoji: reaction.emoji,
        left: 8 + Math.random() * 84,
        color: playerTheme(slot === 0 || slot === 1 ? slot : Math.max(0, index)).base,
      };
      sound.pop();
      setReactions((list) => [...list, item]);
      setTimeout(() => setReactions((list) => list.filter((r) => r.id !== item.id)), 2300);
    };

    const onError = (message: string) => {
      setError(message);
      setIsRolling(false);
    };

    // Partner joined, IOU done, game saved… (only arrives once this account is in a couple)
    const onCoupleUpdate = (next: CoupleOverview) => setAccount((a) => (a ? { ...a, overview: next } : a));

    const onUnlocked = ({ slot, ids }: { slot: number; ids: string[] }) => {
      if (slot !== mySlotRef.current) return;
      showToast({ id: Date.now(), playerId: "", text: `🏅 New badge${ids.length > 1 ? "s" : ""} unlocked!` });
      sound.win();
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("meta", setMeta);
    socket.on("joined", onJoined);
    socket.on("rejoinFailed", resetToLobby);
    socket.on("seatMoved", onSeatMoved);
    socket.on("roomState", onRoomState);
    socket.on("diceRolling", onDiceRolling);
    socket.on("reaction", onReaction);
    socket.on("errorMessage", onError);
    socket.on("coupleUpdate", onCoupleUpdate);
    socket.on("achievementsUnlocked", onUnlocked);

    socket.connect();

    return () => {
      clearTimeout(toastTimer);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("meta", setMeta);
      socket.off("joined", onJoined);
      socket.off("rejoinFailed", resetToLobby);
      socket.off("seatMoved", onSeatMoved);
      socket.off("roomState", onRoomState);
      socket.off("diceRolling", onDiceRolling);
      socket.off("reaction", onReaction);
      socket.off("errorMessage", onError);
      socket.off("coupleUpdate", onCoupleUpdate);
      socket.off("achievementsUnlocked", onUnlocked);
      socket.disconnect();
    };
  }, [myId]);

  useEffect(() => {
    mySlotRef.current = mySlot;
  }, [mySlot]);

  // Invite link + logged in to a complete couple: join automatically, as yourself
  useEffect(() => {
    if (!joinCode || !session || !account?.overview || account.overview.members.length < 2 || game || autoJoined.current || !connected) return;
    autoJoined.current = true;
    socket.emit("joinRoom", { roomId: joinCode, playerId: myId, couple: session, username: account.user.name });
  }, [joinCode, session, account, game, connected, myId]);

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
        if (el && !reduceMotionNow()) {
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
    if (!challengeQuestion || !card || reduceMotionNow()) return;

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

  const waitingForMe = needsMyAction(game?.challenge, myId);
  useEffect(() => {
    if (!waitingForMe) return;
    const id = setTimeout(() => challengeRef.current?.scrollIntoView({ block: "nearest", behavior: reduceMotionNow() ? "auto" : "smooth" }), 650);
    return () => clearTimeout(id);
  }, [waitingForMe, challengeQuestion]);

  // ---------------------------
  // DERIVED STATE
  // ---------------------------
  const currentPlayer = game?.players[game.turn];
  const me = game?.players.find((p) => p.id === myId);
  const partner = game?.players.find((p) => p.id !== myId);
  const challenge = game?.challenge ?? null;
  const isMyTurn = game?.phase === "playing" && currentPlayer?.id === myId;
  const canRoll = isMyTurn && !challenge && !isRolling && !isMoving && connected;
  const activeColor = currentPlayer ? playerTheme(colorIndex(currentPlayer.id)).base : "var(--rose)";
  const isCoop = game?.settings.mode === "coop";
  const teamScore = game?.players.reduce((sum, p) => sum + p.score, 0) ?? 0;
  const shopIsMine = game?.phase === "playing" && Boolean(me?.shopOpen);
  const definitions = meta?.achievements ?? [];
  const inCoupleGame = Boolean(game?.isCouple && session && overview && mySlot !== null);
  const myCouplePartner = overview?.members.find((m) => m.slot !== mySlot)?.name;
  const isCreator = Boolean(game && game.creatorId === myId);

  const round =
    game?.settings.rounds != null
      ? Math.min(Math.min(...game.players.map((p) => p.turnsTaken)) + 1, game.settings.rounds)
      : 0;

  let status = "";
  if (!connected) status = "Reconnecting to server…";
  else if (partner && !partner.connected) status = `${partner.username} lost connection, waiting for them to come back…`;
  else if (teleporting) status = "🎯 Pick any tile to teleport to";
  else if (isRolling || isMoving) status = "Rolling…";
  else if (challenge) status = waitingForMe ? "👉 Your move on the challenge card" : `Waiting for ${partner?.username ?? "your partner"} on the challenge…`;
  else if (isMyTurn) status = game?.freeRoll ? "Bonus roll! Tap the dice again 🎲" : "Your turn: tap the dice";
  else if (currentPlayer) status = `Waiting for ${currentPlayer.username}…`;

  const savedDares = game?.players.flatMap((p) => p.savedDares.map((dare) => ({ ...dare, owner: p }))) ?? [];
  const boardTypes = game ? [...new Set(game.board)] : [];

  // ---------------------------
  // ACTIONS
  // ---------------------------
  const createRoom = (username: string) => {
    socket.emit("createRoom", { username, playerId: myId, settings: newGame });
  };

  const joinRoom = (username: string, roomCode: string) => {
    socket.emit("joinRoom", { roomId: roomCode, username, playerId: myId, couple: overview ? session : undefined });
  };

  const startCoupleGame = () => {
    if (!session) return;
    socket.emit("createRoom", { playerId: myId, settings: newGame, couple: session });
  };

  const joinCoupleGame = (roomId: string) => {
    if (!session || !account) return;
    socket.emit("joinRoom", { roomId, playerId: myId, couple: session, username: account.user.name });
  };

  const login = (s: AccountSession, view: AccountView) => {
    accountSession.set(s);
    setAccount(view);
    setError(null);
  };

  const linked = (view: AccountView) => {
    setAccount(view);
    setError(null);
  };

  const logout = () => {
    socket.emit("accountLogout", session);
    accountSession.set(null);
    setAccount(null);
  };

  const changeLook = (patch: { theme?: string; a11y?: Partial<Settings["a11y"]> }) => socket.emit("updateLook", patch);

  const rollDice = () => {
    if (!canRoll) return;
    setError(null);
    setTeleporting(false);
    setIsRolling(true);
    socket.emit("rollDice");
  };

  const challengeAction = (action: ChallengeAction, extra: { hearts?: number; text?: string; note?: string } = {}) => {
    setError(null);
    socket.emit("challengeAction", { action, ...extra });
  };

  const usePowerUp = (card: PowerUp) => {
    setError(null);
    socket.emit("usePowerUp", { card });
  };

  const teleportTo = (target: number) => {
    setTeleporting(false);
    setError(null);
    socket.emit("usePowerUp", { card: "teleport", target });
  };

  const buyCard = (card: PowerUp) => socket.emit("buyCard", { card });

  const completeSavedDare = (dareId: string) => {
    socket.emit("completeSavedDare", { dareId });
  };

  const react = (emoji: string) => socket.emit("react", { emoji });

  const toggleMute = () => sound.setMuted(!muted);

  const playAgain = () => socket.emit("playAgain");

  const leaveRoom = () => {
    socket.emit("leaveRoom");
    saveRoom(null);
    queue.current = [];
    gameRef.current = null;
    setGame(null);
    setShopOpen(false);
    setTeleporting(false);
  };

  // Esc cancels tile picking
  useEffect(() => {
    if (!teleporting) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setTeleporting(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [teleporting]);

  const canTeleport = isMyTurn && !challenge && !isRolling && !isMoving && connected;

  const errorBanner = error && (
    <div role="alert" className="flex items-center justify-between gap-2 rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose-100">
      <span>{error}</span>
      <button onClick={() => setError(null)} className="text-rose-200 hover:text-white" aria-label="Dismiss">
        ✕
      </button>
    </div>
  );

  const logo = (
    <div className="text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 border border-line text-3xl shadow-[0_4px_0_var(--sunken)]" aria-hidden>
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
        <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4" role="status" aria-live="polite">
          <div key={toast.id} className="toast-in panel max-w-lg px-4 py-2.5 text-center text-sm font-semibold border-gold/40">
            {toast.text}
          </div>
        </div>
      )}

      {shopOpen && me && shopIsMine && <Shop me={me} meta={meta} onBuy={buyCard} onClose={() => setShopOpen(false)} />}

      <div className="relative z-10">
        {!game ? (
          <Lobby
            key={joinCode}
            connected={connected}
            logo={logo}
            errorBanner={errorBanner}
            onError={setError}
            settings={newGame}
            onSettingsChange={setNewGame}
            initialJoinCode={joinCode}
            onCreate={createRoom}
            onJoin={joinRoom}
            session={session}
            account={account}
            definitions={definitions}
            onLogin={login}
            onLinked={linked}
            onCoupleStart={startCoupleGame}
            onCoupleJoin={joinCoupleGame}
            onCoupleLogout={logout}
          />
        ) : game.phase === "waiting" ? (
          /* WAITING FOR PARTNER */
          <div className="flex min-h-[85vh] items-center justify-center">
            <div className="panel w-full max-w-[400px] p-7 space-y-5 text-center">
              {logo}

              <div>
                <h2 className="text-lg font-bold">Waiting for {game.isCouple && myCouplePartner ? myCouplePartner : "your partner"}</h2>
                <p className="mt-1 text-muted text-sm">Share this invite with them</p>
              </div>

              <Invite roomId={game.id} isCouple={game.isCouple} partnerName={myCouplePartner} />

              <p className="inline-block rounded-full border border-line bg-sunken px-3 py-1 text-xs text-muted">
                {game.isCouple ? "💑 Couple game · " : ""}
                {settingsLabel(game.settings)}
              </p>

              <div className="flex justify-center gap-1.5" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-2 h-2 rounded-full bg-rose animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
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
                <span className="text-2xl" aria-hidden>
                  💞
                </span>
                <span className="text-xl font-black title-gradient">Friendly Game</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="hidden sm:inline rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
                  {game.isCouple ? "💑 " : ""}
                  {settingsLabel(game.settings)}
                </span>
                <span className="rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs text-muted">
                  Room <span className="text-gold">{game.id}</span>
                </span>
                <HowToPlay />
                {isCreator && <ThemeMenu theme={game.settings.theme} a11y={game.settings.a11y} onChange={changeLook} />}
                <PrefsMenu room={game.settings.a11y} local={localA11y} effective={a11y} />
                {muteButton}
                <button onClick={leaveRoom} className="text-xs text-muted hover:text-white underline">
                  Leave
                </button>
              </div>
            </header>

            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:items-start">
              {/* =========================
                  SIDEBAR
              ========================== */}
              {/* On phones the aside is display:contents so its sections can sit around the board (challenge right under it) */}
              <aside className="contents lg:flex lg:w-[340px] lg:flex-col lg:gap-4 lg:order-1">
                {/* SCOREBOARD */}
                <section className="panel p-4 order-3 lg:order-none" aria-label="Scoreboard">
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
                      <div
                        className="mt-1.5 h-3 overflow-hidden rounded-full bg-sunken shadow-inner"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={game.settings.coopGoal}
                        aria-valuenow={teamScore}
                        aria-label="Love meter"
                      >
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
                      const themeColors = playerTheme(colorIndex(p.id));

                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-xl border p-2.5 transition-colors duration-300"
                          style={{
                            background: isActive ? "var(--surface-2)" : "var(--sunken)",
                            borderColor: isActive ? themeColors.base : "transparent",
                          }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-9 h-9 flex items-center justify-center font-black text-sm text-[#1b1020] ${p.connected ? "" : "opacity-40 grayscale"}`}
                              style={sphereStyle(colorIndex(p.id))}
                            >
                              {p.username[0]?.toUpperCase()}
                            </div>

                            <div className="text-sm">
                              <p className="font-semibold">
                                {p.username}
                                {p.id === myId && <span className="font-normal text-muted"> (you)</span>}
                                {isActive && <span className="sr-only"> (playing now)</span>}
                              </p>
                              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                                {p.connected
                                  ? game.settings.rounds
                                    ? `${p.turnsTaken}/${game.settings.rounds} turns`
                                    : `${p.turnsTaken} turns`
                                  : "offline"}
                                <span title="Coins">🪙{p.coins}</span>
                                {p.powerUps.length > 0 && <span title="Power-up cards">🃏{p.powerUps.length}</span>}
                                {p.doubleNext && (
                                  <span className="rounded bg-gold px-1 text-[10px] font-black text-[#451a03]" title="Next challenge doubled">
                                    2×
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div id={`score-${p.id}`} className="text-xl font-black" style={{ color: themeColors.base }}>
                            {p.score}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* STATUS */}
                {game.phase === "playing" && status && (
                  <section className="panel flex items-center gap-3 px-4 py-3 text-sm order-2 lg:order-none" role="status" aria-live="polite">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full animate-pulse" style={{ background: activeColor }} aria-hidden />
                    <span>{status}</span>
                    {teleporting && (
                      <button onClick={() => setTeleporting(false)} className="ml-auto text-xs text-muted underline hover:text-white">
                        Cancel
                      </button>
                    )}
                  </section>
                )}

                {/* SHOP */}
                {shopIsMine && (
                  <button onClick={() => setShopOpen(true)} className="btn btn-gold w-full p-3 order-2 lg:order-none">
                    🛒 The shop is open · 🪙 {me?.coins}
                  </button>
                )}

                {error && <div className="order-2 lg:order-none">{errorBanner}</div>}

                {/* CHALLENGE CARD */}
                {challenge && (
                  <div className="order-2 lg:order-none">
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
                  </div>
                )}

                {/* MY POWER-UP CARDS */}
                <section className="panel p-4 order-4 lg:order-none" aria-label="Your cards">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="panel-label">🃏 Your cards</h2>
                    <span className="text-xs text-muted">
                      {me?.powerUps.length ?? 0} / 3 · 🪙 {me?.coins ?? 0}
                    </span>
                  </div>
                  {me && me.powerUps.length > 0 ? (
                    <ul className="space-y-1.5">
                      {me.powerUps.map((card, i) => (
                        <li key={`${card}-${i}`} className="flex items-center gap-2.5 rounded-xl bg-sunken px-3 py-2">
                          <span className="text-lg" aria-hidden>
                            {POWER_UP_INFO[card].icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{POWER_UP_INFO[card].name}</p>
                            <p className="text-[11px] text-muted">{POWER_UP_INFO[card].desc}</p>
                          </div>
                          {card === "teleport" && (
                            <button
                              onClick={() => setTeleporting((v) => !v)}
                              disabled={!canTeleport}
                              className="btn btn-secondary shrink-0 px-2.5 py-1 text-xs"
                              title={canTeleport ? "Pick a tile on the board" : "Use on your turn instead of rolling"}
                            >
                              {teleporting ? "Cancel" : "Use"}
                            </button>
                          )}
                          {card === "shield" && <span className="shrink-0 text-[10px] text-muted">automatic</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted">Cards are only sold in the shop, which opens when you pass START. Play cards from the challenge card.</p>
                  )}
                </section>

                {/* SAVED DARES (this game) */}
                {savedDares.length > 0 && (
                  <section className="panel p-4 order-4 lg:order-none" aria-label="Saved for later">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="panel-label">⏳ Saved for later</h2>
                      <span className="rounded-full bg-sunken px-2 py-0.5 text-xs font-semibold text-muted">{savedDares.length}</span>
                    </div>

                    <ul className="space-y-2">
                      {savedDares.map((dare) => (
                        <li key={dare.id} className="rounded-xl bg-sunken p-3 border-l-4" style={{ borderLeftColor: playerTheme(colorIndex(dare.owner.id)).base }}>
                          <p className="text-sm leading-snug">
                            <span aria-label={TILE_INFO[dare.type ?? "dare"].label}>{TILE_THEMES[dare.type ?? "dare"].icon}</span> {dare.question}
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-xs text-muted">
                              {dare.owner.id === myId ? "You" : dare.owner.username} · +{dare.points} pts
                            </span>
                            {dare.owner.id === myId && game.phase === "playing" && (
                              <button onClick={() => completeSavedDare(dare.id)} className="btn btn-primary px-3 py-1 text-xs">
                                Done
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {game.isCouple && <p className="mt-2 text-[11px] text-muted">Not done by the end? They move to your 💌 IOU wallet.</p>}
                  </section>
                )}

                {/* IOU WALLET (earlier games) */}
                {inCoupleGame && overview!.iou.length > 0 && (
                  <section className="panel p-4 order-4 lg:order-none" aria-label="IOU wallet">
                    <h2 className="panel-label mb-3">💌 IOU wallet (earlier games)</h2>
                    <IouWallet session={session!} slot={mySlot!} overview={overview!} compact />
                  </section>
                )}

                {/* ACTIVITY */}
                <div className="order-4 lg:order-none">
                  <ActivityLog game={game} myId={myId} colorIndex={colorIndex} />
                </div>

                {/* LEGEND */}
                <details className="panel p-4 group order-4 lg:order-none">
                  <summary className="panel-label cursor-pointer list-none flex items-center justify-between">
                    Tiles on this board
                    <span className="transition-transform group-open:rotate-180" aria-hidden>
                      ▾
                    </span>
                  </summary>
                  <div className="mt-3 space-y-1.5">
                    {boardTypes.map((type) => (
                      <div key={type} className="flex items-center gap-2.5 rounded-lg bg-sunken px-2 py-1.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm" style={tileStyle(type)}>
                          {TILE_THEMES[type].icon}
                        </span>
                        <div className="leading-tight">
                          <p className="text-xs font-bold">
                            {TILE_INFO[type].label} <span className="font-normal text-muted">× {game.board.filter((t) => t === type).length}</span>
                          </p>
                          <p className="text-[11px] text-muted">{TILE_INFO[type].sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </aside>

              {/* =========================
                  BOARD
              ========================== */}
              <div className="flex-1 flex flex-col items-center gap-4 order-1 lg:order-2">
                <div
                  className="board-frame relative grid grid-cols-8 w-full max-w-160 aspect-square p-2 sm:p-3 gap-1 sm:gap-1.5 rounded-2xl"
                  role="group"
                  aria-label="Game board"
                >
                  {BOARD_LAYOUT.map((tileIndex, i) => {
                    const type = tileIndex === null ? undefined : game.board[tileIndex];
                    if (tileIndex === null || !type) return <div key={i} />;

                    const here = game.players.filter((p) => p.position === tileIndex).map((p) => p.username);
                    const label = `Tile ${tileIndex + 1}: ${TILE_INFO[type].label}${here.length ? `, ${here.join(" and ")} here` : ""}`;
                    const pickable = teleporting && me && tileIndex !== me.position;

                    return (
                      <div
                        key={i}
                        ref={(el) => {
                          tileRefs.current[tileIndex] = el;
                        }}
                        className={`relative flex flex-col items-center justify-center rounded-md sm:rounded-lg text-center leading-none ${pickable ? "tile-pick" : ""}`}
                        style={tileStyle(type)}
                        title={`${TILE_INFO[type].label}: ${TILE_INFO[type].sub}`}
                        aria-label={label}
                        role={pickable ? "button" : undefined}
                        tabIndex={pickable ? 0 : undefined}
                        onClick={pickable ? () => teleportTo(tileIndex) : undefined}
                        onKeyDown={pickable ? (e) => (e.key === "Enter" || e.key === " ") && teleportTo(tileIndex) : undefined}
                      >
                        <div className="text-sm sm:text-lg" aria-hidden>
                          {TILE_THEMES[type].icon}
                        </div>
                        <div className="mt-0.5 sm:mt-1 text-[6px] sm:text-[8px] font-bold tracking-widest text-white/85" aria-hidden>
                          {TILE_INFO[type].label}
                        </div>
                      </div>
                    );
                  })}

                  {/* PLAYERS */}
                  <div className="absolute inset-0 pointer-events-none z-10" aria-hidden>
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
                            className={`w-full h-full flex items-center justify-center text-[10px] font-black text-[#1b1020] border-2 border-[#fdf2f8] ${
                              game.phase === "playing" && game.turn === idx && !isMoving ? "token-active" : ""
                            } ${p.connected ? "" : "opacity-40 grayscale"}`}
                            style={sphereStyle(colorIndex(p.id))}
                          >
                            {p.username[0]?.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* CENTER: DICE */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                    <button
                      onClick={rollDice}
                      disabled={!canRoll}
                      aria-label={canRoll ? "Roll the dice" : "Dice (not your turn)"}
                      className={`pointer-events-auto rounded-2xl border-4 bg-surface p-5 sm:p-6 transition-[transform,border-color] duration-300 ${
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
                      <div className="rounded-full border bg-surface px-3 py-1 text-[11px] sm:text-xs font-bold" style={{ borderColor: activeColor, color: activeColor }}>
                        {game.freeRoll ? "🎲 Bonus roll · " : ""}
                        {isMyTurn ? "Your turn" : `${currentPlayer.username}'s turn`}
                      </div>
                    )}
                  </div>

                  {/* GAME OVER */}
                  {game.phase === "finished" && (
                    <GameOver game={game} myId={myId} definitions={definitions} colorIndex={colorIndex} onPlayAgain={playAgain} onLeave={leaveRoom} />
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
