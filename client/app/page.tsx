"use client";

import { useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket";
import { gsap } from "gsap";
import { BOARD, BOARD_LAYOUT } from "./constants";
import Dice from "./Dice";

const tileColors = {
  love: {
    bg: "bg-pink-950/40",
    bar: "bg-pink-500",
    glow: "shadow-pink-500/20",
  },
  dare: {
    bg: "bg-orange-950/40",
    bar: "bg-orange-500",
    glow: "shadow-orange-500/20",
  },
  memory: {
    bg: "bg-indigo-950/40",
    bar: "bg-indigo-500",
    glow: "shadow-indigo-500/20",
  },
  gift: {
    bg: "bg-emerald-950/40",
    bar: "bg-emerald-500",
    glow: "shadow-emerald-500/20",
  },
  start: {
    bg: "bg-slate-800/60",
    bar: "bg-yellow-400",
    glow: "shadow-yellow-400/20",
  },
};

gsap.defaults({
  overwrite: "auto",
});

export default function Home() {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [game, setGame] = useState(null);
  const [currentTile, setCurrentTile] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [diceValue, setDiceValue] = useState(1);
  const [isRolling, setIsRolling] = useState(false);

  const tileRefs = useRef({});
  const playerRefs = useRef({});
  const boardRef = useRef(null);
  const isAnimating = useRef(false);
  const prevScores = useRef({});

  const isMyTurn = game?.players?.[game?.turn]?.id === socket.id;

  const playerStyles = [
    "bg-gradient-to-br from-pink-500 to-red-500 shadow-pink-500/50",
    "bg-gradient-to-br from-blue-500 to-cyan-400 shadow-blue-500/50",
  ];

  // ---------------------------
  // INIT POSITIONING
  // ---------------------------
  const setInitialPositions = (room) => {
    const boardRect = boardRef.current.getBoundingClientRect();

    room.players.forEach((p) => {
      const pos = room.positions[p.id];
      const tileEl = tileRefs.current[pos];
      const playerEl = playerRefs.current[p.id];

      if (!tileEl || !playerEl) return;

      const rect = tileEl.getBoundingClientRect();

      gsap.set(playerEl, {
        x: rect.left - boardRect.left,
        y: rect.top - boardRect.top,
      });
    });
  };

  // ---------------------------
  // MOVE ANIMATION
  // ---------------------------
  const animateSteps = (playerId, steps, callback) => {
    if (isAnimating.current) return;

    const playerEl = playerRefs.current[playerId];
    const boardRect = boardRef.current.getBoundingClientRect();

    if (!playerEl) return;

    isAnimating.current = true;

    const tl = gsap.timeline({
      onComplete: () => {
        isAnimating.current = false;
        callback?.();
      },
    });

    steps.forEach((step) => {
      const tileEl = tileRefs.current[step];
      if (!tileEl) return;

      const rect = tileEl.getBoundingClientRect();

      const x = rect.left - boardRect.left;
      const y = rect.top - boardRect.top;

      tl.to(playerEl, {
        x,
        y,
        duration: 0.35,
        ease: "power2.inOut",
      });

      tl.to(
        tileEl,
        {
          scale: 1.15,
          duration: 0.15,
          yoyo: true,
          repeat: 1,
          ease: "power1.out",
        },
        "<",
      );

      const lastTile = steps[steps.length - 1];
      const lastTileEl = tileRefs.current[lastTile];

      if (lastTileEl) {
        gsap.fromTo(
          lastTileEl,
          { boxShadow: "0 0 0px rgba(255,255,255,0)" },
          {
            boxShadow: "0 0 25px rgba(255,255,255,0.6)",
            duration: 0.4,
            yoyo: true,
            repeat: 1,
          },
        );
      }
    });
  };

  // ---------------------------
  // SOCKETS
  // ---------------------------

  useEffect(() => {
    if (!game) return;

    game.players.forEach((p) => {
      const prev = prevScores.current[p.id] || 0;
      const curr = game.scores[p.id];

      if (curr > prev) {
        const el = document.getElementById(`score-${p.id}`);

        if (el) {
          gsap.fromTo(
            el,
            { scale: 1, color: "#fde047" },
            {
              scale: 1.6,
              duration: 0.2,
              yoyo: true,
              repeat: 1,
              ease: "back.out(2)",
            },
          );
        }
      }

      prevScores.current[p.id] = curr;
    });
  }, [game?.scores]);

  useEffect(() => {
    socket.on("roomCreated", ({ roomId }) => {
      setRoomId(roomId);
    });

    socket.on("gameStart", (room) => {
      setGame(room);

      setTimeout(() => {
        setInitialPositions(room);
      }, 100);
    });

    socket.on("gameUpdate", ({ steps, playerId, question, tileType, room }) => {
      animateSteps(playerId, steps, () => {
        setGame(room);
        setCurrentTile({ type: tileType });
        setCurrentQuestion(question);
      });
    });

    socket.on("diceRolling", () => {
      setIsRolling(true);
    });

    socket.on("diceRolled", ({ dice }) => {
      setDiceValue(dice);
      setIsRolling(false);
    });

    return () => socket.off();
  }, []);

  // ---------------------------
  // ACTIONS
  // ---------------------------
  const createRoom = () => {
    socket.emit("createRoom", { username });
  };

  const joinRoom = () => {
    socket.emit("joinRoom", { roomId, username });
  };

  const rollDice = () => {
    if (!isMyTurn) return;
    if (isAnimating.current || isRolling) return;

    setIsRolling(true);

    const diceEl = document.querySelector(".dice");

    gsap.fromTo(
      diceEl,
      { rotate: 0, scale: 1 },
      {
        rotate: 720,
        scale: 1.2,
        duration: 0.6,
        ease: "power2.out",
      },
    );

    socket.emit("rollDice", { roomId });
  };

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(".player-float", {
        y: "+=4",
        repeat: -1,
        yoyo: true,
        duration: 1.4,
        ease: "sine.inOut",
        stagger: 0.1,
      });
    });

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!currentQuestion) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".question-card",
        { y: 200, opacity: 0, scale: 0.8 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.6,
          ease: "elastic.out(1, 0.5)",
        },
      );

      gsap.to(".question-card", {
        boxShadow: "0 0 30px rgba(255,0,150,0.4)",
        duration: 1,
        repeat: 3,
        yoyo: true,
      });
    });

    return () => ctx.revert();
  }, [currentQuestion]);

  useEffect(() => {
    if (!game) return;

    const currentId = game.players?.[game.turn]?.id;

    // 1. STOP animation on ALL players first
    Object.values(playerRefs.current).forEach((el) => {
      if (!el) return;

      gsap.killTweensOf(el);

      gsap.set(el, {
        scale: 1,
        boxShadow: "0 0 0px rgba(255,255,255,0)",
      });
    });

    // 2. Animate ONLY current player
    const currentEl = playerRefs.current[currentId];
    if (!currentEl) return;

    gsap.fromTo(
      currentEl,
      {
        scale: 1,
        boxShadow: "0 0 0px rgba(255,255,255,0)",
      },
      {
        scale: 1.35,
        boxShadow: "0 0 20px rgba(255,255,255,0.8)",
        repeat: -1,
        yoyo: true,
        duration: 0.7,
        ease: "sine.inOut",
      },
    );
  }, [game?.turn, game?.players]);

  // ---------------------------
  // RENDER
  // ---------------------------
  return (
    <div className="min-h-screen p-10 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-black text-white">
      {/* BACKGROUND GLOW */}
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,white,transparent)]" />

      {/* LOGIN SCREEN */}
      {!game ? (
        <div className="relative z-10 flex items-center justify-center">
          <div className="w-[380px] bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl space-y-4">
            <h1 className="text-2xl font-bold text-center">🎮 Game Lobby</h1>

            <p className="text-center text-white/60 text-sm">
              Enter your details to join the arena
            </p>

            {/* USERNAME */}
            <div>
              <label className="text-xs text-white/60">Player Name</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full mt-1 p-3 rounded-xl bg-white/10 border border-white/20 text-white outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="e.g. Alex"
              />
            </div>

            {/* CREATE ROOM */}
            <button
              onClick={createRoom}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 p-3 rounded-xl font-semibold hover:scale-[1.02] transition"
            >
              Create New Room
            </button>

            <div className="text-center text-white/40 text-xs">OR</div>

            {/* JOIN ROOM */}
            <div>
              <label className="text-xs text-white/60">Room Code</label>
              <input
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full mt-1 p-3 rounded-xl bg-white/10 border border-white/20 text-white outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter room ID"
              />
            </div>

            <button
              onClick={joinRoom}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 p-3 rounded-xl font-semibold hover:scale-[1.02] transition"
            >
              Join Room
            </button>

            {roomId && (
              <div className="text-center text-white/60 text-sm mt-2">
                Room: <span className="text-white font-mono">{roomId}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-6 relative z-10">
          {/* =========================
              LEFT SIDEBAR
          ========================== */}
          <div className="w-[280px] flex flex-col gap-4">
            {/* SCOREBOARD */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-xl">
              <h2 className="text-lg font-bold mb-3">🏆 Scoreboard</h2>

              <div className="space-y-3">
                {game.players.map((p, i) => {
                  const isActive = game.turn === i;

                  console.log({ isActive });

                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-2 rounded-xl transition ${
                        isActive ? "bg-white/20 scale-[1.02]" : "bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${playerStyles[i]}`}
                        >
                          {p.username?.[0]?.toUpperCase()}
                        </div>

                        <div className="text-sm">
                          <p>{p.username}</p>
                        </div>
                      </div>

                      <div
                        id={`score-${p.id}`}
                        className="text-yellow-300 font-bold transition-transform"
                      >
                        {game.scores[p.id]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* QUESTION PANEL */}
            {currentQuestion && (
              <div className="bg-gradient-to-br from-purple-600/30 via-pink-500/20 to-red-500/20 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-xl">
                <h3 className="text-xs text-white/60 mb-2">
                  🎯 Current Challenge
                </h3>

                <div className="text-white font-semibold text-sm">
                  {currentTile?.type?.toUpperCase()}
                </div>

                <div className="mt-2 text-white text-base">
                  {currentQuestion}
                </div>
              </div>
            )}
          </div>

          {/* =========================
              BOARD AREA
          ========================== */}
          <div className="flex-1 flex justify-center">
            <div
              ref={boardRef}
              className="
  relative grid grid-cols-5 
  w-[560px] h-[560px]
  p-2 gap-[2px]
  bg-black/40
  border border-white/10
  rounded-2xl
  shadow-2xl 
"
            >
              {BOARD_LAYOUT.map((tileIndex, i) => {
                if (tileIndex === null) return <div key={i} />;

                const tile = BOARD[tileIndex];

                return (
                  <div
                    key={i}
                    ref={(el) => (tileRefs.current[tileIndex] = el)}
                    className={`relative flex flex-col items-center justify-center 
  rounded-md border border-white/10 
  ${tileColors[tile.type].bg}
  ${tileColors[tile.type].glow}
  overflow-hidden`}
                  >
                    {/* TOP COLOR BAR */}
                    <div
                      className={`absolute top-0 left-0 right-0 h-2 ${tileColors[tile.type].bar}`}
                    />

                    {/* TILE CONTENT */}
                    <div className="flex flex-col items-center justify-center px-1 text-center mt-2">
                      <div className="text-[10px] font-bold tracking-widest text-white/90">
                        {tile.label}
                      </div>

                      <div className="text-[9px] text-white/50 mt-1">
                        {tile.sub}
                      </div>
                    </div>

                    {/* subtle grid texture */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] bg-[size:10px_10px]" />
                  </div>
                );
              })}

              {/* PLAYERS */}
              <div className="absolute inset-0 pointer-events-none">
                {game.players.map((p, idx) => (
                  <div
                    key={p.id}
                    ref={(el) => (playerRefs.current[p.id] = el)}
                    className={`absolute w-8 h-8 rounded-full flex items-center justify-center ${playerStyles[idx]} player-float`}
                  >
                    {p.username?.[0]?.toUpperCase()}
                  </div>
                ))}
              </div>

              {/* DICE CENTER */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className={`bg-black/40
  backdrop-blur-md
  p-5
  rounded-2xl
  border border-white/10
  shadow-xl
  hover:scale-105 transition cursor-pointer ${
    !isMyTurn ? "opacity-40 cursor-not-allowed" : ""
  }`}
                  onClick={rollDice}
                >
                  <Dice value={diceValue} rolling={isRolling} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
