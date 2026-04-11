"use client";

import { useEffect, useState } from "react";
import { socket } from "../lib/socket";

const BOARD = [
  { type: "start", label: "Start 🚀" },
  { type: "love", label: "Love ❤️" },
  { type: "dare", label: "Dare 🔥" },
  { type: "memory", label: "Memory 🧠" },
  { type: "gift", label: "Gift 🎁" },
  { type: "love", label: "Love ❤️" },
  { type: "dare", label: "Dare 🔥" },
  { type: "memory", label: "Memory 🧠" },
  { type: "gift", label: "Gift 🎁" },
  { type: "love", label: "Love ❤️" },
  { type: "dare", label: "Dare 🔥" },
  { type: "memory", label: "Memory 🧠" },
  { type: "gift", label: "Gift 🎁" },
  { type: "love", label: "Love ❤️" },
  { type: "dare", label: "Dare 🔥" },
  { type: "memory", label: "Memory 🧠" },
];

const BOARD_LAYOUT = [
  0,
  1,
  2,
  3,
  4,
  15,
  null,
  null,
  null,
  5,
  14,
  null,
  null,
  null,
  6,
  13,
  null,
  null,
  null,
  7,
  12,
  11,
  10,
  9,
  8,
];

export default function Home() {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [game, setGame] = useState(null);
  const [dice, setDice] = useState(null);
  const [currentTile, setCurrentTile] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState("");

  useEffect(() => {
    socket.on("roomCreated", ({ roomId }) => {
      setRoomId(roomId);
    });

    socket.on("gameStart", (room) => {
      setGame(room);
    });

    socket.on("gameUpdate", ({ dice, room, question }) => {
      setDice(dice);
      setGame(room);

      const lastPlayer =
        room.players[room.turn === 0 ? room.players.length - 1 : room.turn - 1];

      const pos = room.positions[lastPlayer.id];
      const tile = BOARD[pos];

      setCurrentTile(tile);

      // ✅ USE BACKEND QUESTION
      setCurrentQuestion(question);
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
    console.log({ roomId });
    socket.emit("rollDice", { roomId });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black-200 to-white-300 p-10">
      {!game ? (
        <div>
          <input
            placeholder="Your name"
            onChange={(e) => setUsername(e.target.value)}
            className="border p-2"
          />

          <div className="mt-4">
            <button onClick={createRoom} className="bg-blue-500 text-black p-2">
              Create Room
            </button>
          </div>

          <div className="mt-4">
            <input
              placeholder="Room ID"
              onChange={(e) => setRoomId(e.target.value)}
              className="border p-2"
            />
            <button
              onClick={joinRoom}
              className="bg-green-500 text-black p-2 ml-2"
            >
              Join Room
            </button>
          </div>

          {roomId && <p>Your Room ID: {roomId}</p>}
        </div>
      ) : (
        <div>
          {/* BOARD */}
          <div className="flex justify-center">
            <div className="grid grid-cols-5 w-[500px] h-[500px]">
              {BOARD_LAYOUT.map((tileIndex, i) => {
                if (tileIndex === null) {
                  return <div key={i} className="bg-transparent" />;
                }

                const tile = BOARD[tileIndex];

                return (
                  <div
                    key={i}
                    className="border bg-white flex items-center justify-center relative"
                  >
                    <span className="text-xs text-center">{tile.label}</span>

                    {/* Players */}
                    {game.players.map((p, idx) => {
                      if (game.positions[p.id] === tileIndex) {
                        return (
                          <div key={p.id} className="absolute bottom-1 text-lg">
                            {idx === 0 ? "🧍" : "🧑"}
                          </div>
                        );
                      }
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <h1 className="mt-2">{username}</h1>

          {/* PLAYERS */}
          <div className="mt-6">
            {game.players.map((p, i) => (
              <div key={p.id}>
                {p.username} - Position: {game.positions[p.id]} - Score:{" "}
                {game.scores[p.id]} {game.turn === i && "👉 Current Turn"}
              </div>
            ))}
          </div>

          <button
            onClick={rollDice}
            className="bg-purple-500 text-black p-3 mt-4"
          >
            Roll Dice 🎲
          </button>

          {/* QUESTION MODAL */}
          {currentTile && currentTile.type !== "start" && (
            <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-white p-6 rounded-xl shadow-xl">
              <h2 className="text-xl">{currentTile.label}</h2>
              <p className="mt-2">{currentQuestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
