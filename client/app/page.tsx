"use client";

import { useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket";
import { gsap } from "gsap";
import { BOARD, BOARD_LAYOUT } from "./constants";

export default function Home() {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [game, setGame] = useState(null);
  const [currentTile, setCurrentTile] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState("");

  const tileRefs = useRef({});
  const playerRefs = useRef({});
  const boardRef = useRef(null);
  const isAnimating = useRef(false);

  /* =========================
     INITIAL POSITION SET
  ========================= */
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

  /* =========================
     ANIMATION (LUDO STYLE)
  ========================= */
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
    });
  };

  /* =========================
     SOCKET EVENTS
  ========================= */
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
      // animate first → then update UI
      animateSteps(playerId, steps, () => {
        setGame(room);
        setCurrentTile({ type: tileType });
        setCurrentQuestion(question);
      });
    });

    return () => socket.off();
  }, []);

  /* =========================
     ACTIONS
  ========================= */
  const createRoom = () => {
    socket.emit("createRoom", { username });
  };

  const joinRoom = () => {
    socket.emit("joinRoom", { roomId, username });
  };

  const rollDice = () => {
    if (isAnimating.current) return;

    gsap.to(".dice", {
      rotate: 720,
      duration: 0.6,
    });

    setTimeout(() => {
      socket.emit("rollDice", { roomId });
    }, 500);
  };

  /* =========================
     QUESTION ANIMATION
  ========================= */
  useEffect(() => {
    if (currentQuestion) {
      gsap.fromTo(
        ".question-card",
        { y: 100, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5 },
      );
    }
  }, [currentQuestion]);

  /* =========================
     UI
  ========================= */
  return (
    <div className="min-h-screen p-10">
      {!game ? (
        <div>
          <input
            placeholder="Your name"
            onChange={(e) => setUsername(e.target.value)}
            className="border p-2"
          />

          <div className="mt-4">
            <button onClick={createRoom} className="bg-blue-500 p-2">
              Create Room
            </button>
          </div>

          <div className="mt-4">
            <input
              placeholder="Room ID"
              onChange={(e) => setRoomId(e.target.value)}
              className="border p-2"
            />
            <button onClick={joinRoom} className="bg-green-500 p-2 ml-2">
              Join Room
            </button>
          </div>

          {roomId && <p>Room ID: {roomId}</p>}
        </div>
      ) : (
        <div>
          {/* BOARD */}
          <div className="flex justify-center">
            <div
              ref={boardRef}
              className="relative grid grid-cols-5 w-[500px] h-[500px]"
            >
              {BOARD_LAYOUT.map((tileIndex, i) => {
                if (tileIndex === null) {
                  return <div key={i} />;
                }

                const tile = BOARD[tileIndex];

                return (
                  <div
                    key={i}
                    ref={(el) => (tileRefs.current[tileIndex] = el)}
                    className="border flex items-center justify-center"
                  >
                    <span className="text-xs">{tile.label}</span>
                  </div>
                );
              })}

              {/* ✅ PLAYERS LAYER (ONLY ONCE) */}
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                {game.players.map((p, idx) => (
                  <div
                    key={p.id}
                    ref={(el) => (playerRefs.current[p.id] = el)}
                    className="absolute text-2xl"
                  >
                    {idx === 0 ? "🧍" : "🧑"}
                  </div>
                ))}
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

          <button onClick={rollDice} className="bg-purple-500 p-3 mt-4">
            Roll Dice 🎲
          </button>

          {/* QUESTION */}
          {currentTile && currentTile.type !== "start" && (
            <div className="question-card fixed bottom-10 left-1/2 -translate-x-1/2 bg-white p-6 shadow-xl">
              <h2>{currentTile.type}</h2>
              <p>{currentQuestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
