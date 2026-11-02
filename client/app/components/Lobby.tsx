"use client";

import { useState, type ReactNode } from "react";
import GameSettings from "./GameSettings";
import AccountAuth from "./AccountAuth";
import CoupleLink from "./CoupleLink";
import CoupleHome from "./CoupleHome";
import HowToPlay from "./HowToPlay";
import type { AccountSession, AccountView, AchievementDef, NewGameSettings } from "../types";

type Props = {
  connected: boolean;
  logo: ReactNode;
  errorBanner: ReactNode;
  onError: (message: string) => void;
  settings: NewGameSettings;
  onSettingsChange: (s: NewGameSettings) => void;
  // quick game
  initialJoinCode: string;
  onCreate: (username: string) => void;
  onJoin: (username: string, roomCode: string) => void;
  // account + couple
  session: AccountSession | null;
  account: AccountView | null;
  definitions: AchievementDef[];
  onLogin: (session: AccountSession, view: AccountView) => void;
  onLinked: (view: AccountView) => void;
  onCoupleStart: () => void;
  onCoupleJoin: (roomId: string) => void;
  onCoupleLogout: () => void;
};

export default function Lobby(props: Props) {
  const { connected, logo, errorBanner, onError, settings, onSettingsChange, initialJoinCode, session, account } = props;
  const overview = account?.overview ?? null;

  // An invite link opens the quick-join form, unless you're logged in as a couple
  const [tab, setTab] = useState<"couple" | "quick">(initialJoinCode && !session ? "quick" : session ? "couple" : "couple");
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState(initialJoinCode);
  const [showSettings, setShowSettings] = useState(false);

  const create = () => {
    if (!username.trim()) return onError("Please enter your name");
    props.onCreate(username);
  };

  const join = () => {
    if (!username.trim()) return onError("Please enter your name");
    if (!roomCode.trim()) return onError("Please enter a room code");
    props.onJoin(username, roomCode);
  };

  return (
    <div className="flex min-h-[85vh] items-center justify-center py-6">
      <div className="panel w-full max-w-[460px] p-6 sm:p-7 space-y-5">
        {logo}

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-sunken p-1" role="tablist" aria-label="How to play">
          {(
            [
              ["couple", "💑 Couple"],
              ["quick", "⚡ Quick game"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-lg py-2 text-sm font-bold transition-colors ${tab === id ? "bg-surface-2 text-white shadow" : "text-muted hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "couple" ? (
          session && account && overview && account.slot !== null ? (
            <CoupleHome
              session={session}
              slot={account.slot}
              overview={overview}
              definitions={props.definitions}
              connected={connected}
              settings={settings}
              onSettingsChange={onSettingsChange}
              onStart={props.onCoupleStart}
              onJoin={props.onCoupleJoin}
              onLogout={props.onCoupleLogout}
              errorBanner={errorBanner}
            />
          ) : session && account ? (
            <>
              {errorBanner}
              <CoupleLink session={session} name={account.user.name} connected={connected} onLinked={props.onLinked} onLogout={props.onCoupleLogout} />
            </>
          ) : session ? (
            <p className="py-6 text-center text-sm text-muted">Loading your account…</p>
          ) : (
            <>
              {errorBanner}
              <AccountAuth connected={connected} onDone={props.onLogin} />
            </>
          )
        ) : (
          <>
            <p className="text-center text-muted text-sm">A one-off game with anyone. Nothing is saved after it ends.</p>

            {errorBanner}

            <div>
              <label className="panel-label" htmlFor="quick-name">
                Your name
              </label>
              <input
                id="quick-name"
                value={username}
                maxLength={20}
                onChange={(e) => setUsername(e.target.value)}
                className="field w-full mt-1.5 p-3"
                placeholder="e.g. Alex"
                autoFocus={Boolean(initialJoinCode)}
              />
            </div>

            {/* JOIN (first when arriving from an invite link) */}
            {initialJoinCode && (
              <button onClick={join} disabled={!connected} className="btn btn-gold w-full p-3">
                Join room {roomCode}
              </button>
            )}

            <div className="rounded-2xl bg-sunken/60 border border-line p-3 space-y-3">
              <button onClick={() => setShowSettings((v) => !v)} className="flex w-full items-center justify-between" aria-expanded={showSettings}>
                <span className="panel-label">New game settings</span>
                <span className="text-xs text-muted">{showSettings ? "Hide ▴" : "Customise ▾"}</span>
              </button>
              {showSettings && <GameSettings value={settings} onChange={onSettingsChange} />}
              <button onClick={create} disabled={!connected} className="btn btn-primary w-full p-3">
                Create new room
              </button>
            </div>

            {!initialJoinCode && (
              <>
                <div className="flex items-center gap-3 text-muted/60 text-xs">
                  <div className="h-px flex-1 bg-line" />
                  or join one
                  <div className="h-px flex-1 bg-line" />
                </div>
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
              </>
            )}
          </>
        )}

        {!connected && <p className="text-center text-xs text-muted">Connecting to server…</p>}

        <div className="text-center">
          <HowToPlay />
        </div>
      </div>
    </div>
  );
}
