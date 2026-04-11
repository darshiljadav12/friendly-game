"use client";

import { useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket";
import { gsap } from "gsap";
import { BOARD, BOARD_LAYOUT } from "./constants";
import Dice from "./Dice";

const tileColors = {
  love: "from-pink-500/30 to-red-500/30",
  dare: "from-yellow-400/30 to-orange-500/30",
  memory: "from-purple-500/30 to-indigo-500/30",
  gift: "from-green-400/30 to-emerald-500/30",
  start: "from-gray-500/30 to-gray-700/30",
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

  const isMyTurn = game?.players?.[game?.turn]?.id === socket.id;

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

  const animateSteps = (playerId, steps, callback) => {
    if (isAnimating.current) return;

    const playerEl = playerRefs.current[playerId];
    const boardRect = boardRef.current.getBoundingClientRect();

    if (!playerEl) return;

    isAnimating.current = true;

    const tl = gsap.timeline({
      onComplete: () => {
        isAnimating.current = false;
        callback && callback();
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

    return () => socket.off();
  }, []);

  const createRoom = () => {
    socket.emit("createRoom", { username });
  };

  const joinRoom = () => {
    socket.emit("joinRoom", { roomId, username });
  };

  const rollDice = () => {
    if (!isMyTurn) return; // 🚨 IMPORTANT FIX
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

  const playerStyles = [
    "bg-gradient-to-br from-pink-500 to-red-500 shadow-pink-500/50",
    "bg-gradient-to-br from-blue-500 to-cyan-400 shadow-blue-500/50",
  ];

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(".player-float", {
        y: "+=6",
        repeat: -1,
        yoyo: true,
        duration: 1,
        ease: "sine.inOut",
        overwrite: "auto",
      });
    });

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const tiles = gsap.utils.toArray(".tile");

    if (!tiles.length) return;

    gsap.from(tiles, {
      scale: 0,
      opacity: 0,
      stagger: 0.03,
      duration: 0.4,
      ease: "back.out(1.7)",
      overwrite: "auto",
    });

    return () => gsap.killTweensOf(tiles);
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

  // useEffect(() => {
  //   if (!game) return;

  //   const currentId = game.players?.[game.turn]?.id;
  //   const el = playerRefs.current[currentId];

  //   if (!el) return;

  //   // kill previous animations to avoid stacking
  //   gsap.killTweensOf(el);

  //   gsap.fromTo(
  //     el,
  //     {
  //       scale: 1,
  //       boxShadow: "0 0 0px rgba(255,255,255,0)",
  //     },
  //     {
  //       scale: 1.35,
  //       boxShadow: "0 0 20px rgba(255,255,255,0.8)",
  //       repeat: -1,
  //       yoyo: true,
  //       duration: 0.7,
  //       ease: "sine.inOut",
  //     },
  //   );
  // }, [game?.turn]);

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

  useEffect(() => {
    socket.on("diceRolling", ({ playerId }) => {
      // only animate if it's current player OR show global animation if you want
      setIsRolling(true);
    });

    socket.on("diceRolled", ({ dice, playerId }) => {
      setDiceValue(dice);
      setIsRolling(false);
    });

    return () => {
      socket.off("diceRolling");
      socket.off("diceRolled");
    };
  }, []);

  return (
    <div className="min-h-screen p-10 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-black text-white relative overflow-hidden">
      {/* ✅ FIX: pointer-events-none added */}
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,white,transparent)]" />

      {!game ? (
        <div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border p-2 text-black"
          />

          <div className="mt-4">
            <button onClick={createRoom} className="bg-blue-500 p-2">
              Create Room
            </button>
          </div>

          <div className="mt-4">
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="border p-2 text-black"
            />
            <button onClick={joinRoom} className="bg-green-500 p-2 ml-2">
              Join Room
            </button>
          </div>

          {roomId && <p>Room ID: {roomId}</p>}
        </div>
      ) : (
        <div>
          <div className="flex justify-center">
            <div
              ref={boardRef}
              className="relative grid grid-cols-5 w-[500px] h-[500px]"
            >
              {BOARD_LAYOUT.map((tileIndex, i) => {
                if (tileIndex === null) return <div key={i} />;

                const tile = BOARD[tileIndex];

                return (
                  <div
                    key={i}
                    ref={(el) => (tileRefs.current[tileIndex] = el)}
                    className={`tile hover:scale-105 transition-transform duration-200 relative flex items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br ${tileColors[tile.type]} shadow-[0_8px_20px_rgba(0,0,0,0.3)]`}
                  >
                    <span className="text-xs text-white/80 text-center px-1">
                      {tile.label}
                    </span>
                  </div>
                );
              })}

              <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                {game.players.map((p, idx) => (
                  <div
                    key={p.id}
                    ref={(el) => (playerRefs.current[p.id] = el)}
                    className={`player-float absolute w-9 h-9 rounded-full ${playerStyles[idx]} flex items-center justify-center`}
                  >
                    {p.username?.[0]?.toUpperCase()}
                  </div>
                ))}
              </div>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto">
                <div
                  className={`bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-xl flex flex-col items-center gap-2 transition ${
                    !isMyTurn
                      ? "opacity-40 cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                  onClick={rollDice}
                >
                  <Dice value={diceValue} rolling={isRolling} />
                </div>
                <p className="text-xs text-white/70 pt-4">
                  {isMyTurn ? "Your turn 🎯" : "Waiting for opponent..."}
                </p>
              </div>
            </div>
          </div>

          {/* PLAYERS */}
          <div className="mt-6">
            {game.players.map((p, i) => (
              <div key={p.id}>
                {p.username} - Pos: {game.positions[p.id]} - Score:{" "}
                {game.scores[p.id]} {game.turn === i && "👉"}
              </div>
            ))}
          </div>

          {/* <Dice value={diceValue} rolling={isRolling} /> */}

          {/* <button
            onClick={rollDice}
            disabled={!isMyTurn}
            className="bg-purple-500 p-3 mt-4"
          >
            Roll Dice 🎲
          </button> */}

          {currentTile && currentTile.type !== "start" && (
            <div className="question-card fixed top-10 left-40 -translate-x-1/2 w-[250px] p-6 rounded-2xl bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 text-white">
              <h2 className="text-xl font-bold mb-2">
                {currentTile.type.toUpperCase()}
              </h2>
              <p className="text-lg">{currentQuestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
