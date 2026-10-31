"use client";

import { useState, type ReactNode } from "react";
import { LENGTH_OPTIONS } from "../constants";
import HowToPlay from "./HowToPlay";
import type { GameLength, GameMode } from "../types";

type Props = {
  connected: boolean;
  logo: ReactNode;
  errorBanner: ReactNode;
  onError: (message: string) => void;
  onCreate: (username: string, settings: { mode: GameMode; length: GameLength }) => void;
  onJoin: (username: string, roomCode: string) => void;
};

const MODES: { value: GameMode; icon: string; label: string; desc: string }[] = [
  { value: "competitive", icon: "🏆", label: "Competitive", desc: "Highest score wins" },
  { value: "coop", icon: "💞", label: "Co-op", desc: "Fill the love meter together" },
];

export default function Lobby({ connected, logo, errorBanner, onError, onCreate, onJoin }: Props) {
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [mode, setMode] = useState<GameMode>("competitive");
  const [length, setLength] = useState<GameLength>("10");

  const chooseMode = (value: GameMode) => {
    setMode(value);
    // "First to N points" has no end in co-op, so fall back to rounds
    if (value === "coop" && !LENGTH_OPTIONS.find((o) => o.value === length)?.coop) setLength("10");
  };

  const create = () => {
    if (!username.trim()) return onError("Please enter your name");
    onCreate(username, { mode, length });
  };

  const join = () => {
    if (!username.trim()) return onError("Please enter your name");
    if (!roomCode.trim()) return onError("Please enter a room code");
    onJoin(username, roomCode);
  };

  return (
    <div className="flex min-h-[85vh] items-center justify-center">
      <div className="panel w-full max-w-[420px] p-7 space-y-5">
        {logo}

        <p className="text-center text-muted text-sm">
          Roll the dice, move around the board and take on love, dares, memories and gifts together.
        </p>

        {errorBanner}

        {/* USERNAME */}
        <div>
          <label className="panel-label">Your name</label>
          <input
            value={username}
            maxLength={20}
            onChange={(e) => setUsername(e.target.value)}
            className="field w-full mt-1.5 p-3"
            placeholder="e.g. Alex"
          />
        </div>

        {/* NEW GAME SETTINGS */}
        <div className="rounded-2xl bg-sunken/60 border border-line p-3 space-y-3">
          <p className="panel-label">New game</p>

          <div className="grid grid-cols-2 gap-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => chooseMode(m.value)}
                className={`rounded-xl border p-2.5 text-left transition-colors ${
                  mode === m.value ? "border-rose bg-rose/15" : "border-line bg-surface hover:border-line-strong"
                }`}
              >
                <div className="text-sm font-bold">
                  {m.icon} {m.label}
                </div>
                <div className="text-[11px] text-muted mt-0.5">{m.desc}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {LENGTH_OPTIONS.map((o) => {
              const disabled = mode === "coop" && !o.coop;
              return (
                <button
                  key={o.value}
                  onClick={() => setLength(o.value)}
                  disabled={disabled}
                  title={disabled ? "Co-op games use rounds" : undefined}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
                    length === o.value ? "border-gold bg-gold/15 text-gold" : "border-line text-muted hover:text-white"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>

          <button onClick={create} disabled={!connected} className="btn btn-primary w-full p-3">
            Create new room
          </button>
        </div>

        <div className="flex items-center gap-3 text-muted/60 text-xs">
          <div className="h-px flex-1 bg-line" />
          or join one
          <div className="h-px flex-1 bg-line" />
        </div>

        {/* JOIN ROOM */}
        <div className="flex gap-2">
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && join()}
            className="field min-w-0 flex-1 p-3 font-mono tracking-[0.3em]"
            placeholder="CODE"
            aria-label="Room code"
          />
          <button onClick={join} disabled={!connected} className="btn btn-secondary px-5">
            Join
          </button>
        </div>

        {!connected && <p className="text-center text-xs text-muted">Connecting to server…</p>}

        <div className="text-center">
          <HowToPlay />
        </div>
      </div>
    </div>
  );
}
