"use client";

import { useState, type ReactNode } from "react";
import GameSettings from "./GameSettings";
import { AchievementsTab, HistoryTab, IouWallet, MemoryBook, StatsTab } from "./CoupleTabs";
import { playerTheme } from "../constants";
import type { AccountSession, AchievementDef, CoupleOverview, NewGameSettings } from "../types";

type Tab = "play" | "history" | "memories" | "stats" | "achievements" | "iou";

type Props = {
  session: AccountSession;
  slot: 0 | 1;
  overview: CoupleOverview;
  definitions: AchievementDef[];
  connected: boolean;
  settings: NewGameSettings;
  onSettingsChange: (s: NewGameSettings) => void;
  onStart: () => void;
  onJoin: (roomId: string) => void;
  onLogout: () => void;
  errorBanner: ReactNode;
};

export default function CoupleHome({ session, slot, overview, definitions, connected, settings, onSettingsChange, onStart, onJoin, onLogout, errorBanner }: Props) {
  const [tab, setTab] = useState<Tab>("play");
  const [copied, setCopied] = useState(false);
  const me = overview.members.find((m) => m.slot === slot);
  const partner = overview.members.find((m) => m.slot !== slot);
  const owed = overview.iou.length;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(overview.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard needs https or localhost; the code is visible anyway
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "play", label: "🎲 Play" },
    { id: "history", label: "📜 History" },
    { id: "memories", label: "📖 Memories" },
    { id: "stats", label: "📊 Stats" },
    { id: "achievements", label: "🏅 Badges" },
    { id: "iou", label: `💌 IOU${owed ? ` (${owed})` : ""}` },
  ];

  return (
    <div className="space-y-4">
      {/* WHO */}
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-sunken p-3">
        <div>
          <p className="text-sm">
            Hi <b style={{ color: playerTheme(slot).base }}>{me?.name}</b> 💞
          </p>
          <p className="text-[11px] text-muted">
            {partner ? `${me?.name} & ${partner.name}` : "Waiting for your partner"} · <span className="font-mono">{overview.code}</span> ·{" "}
            <span>@{session.username}</span>
          </p>
        </div>
        <button onClick={onLogout} className="text-[11px] text-muted underline hover:text-white" title="Log out on this device">
          Log out
        </button>
      </div>

      {/* PARTNER NOT LINKED YET */}
      {!partner ? (
        <div className="space-y-3 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-center">
          <p className="text-sm">Send this couple code to your partner. They sign up, then choose <b>Join your partner</b> and enter it:</p>
          <button onClick={copyCode} className="w-full rounded-xl bg-sunken py-3 font-mono text-3xl font-black tracking-[0.2em] text-gold" title="Copy code">
            {overview.code}
          </button>
          <p className="text-[11px] text-muted">{copied ? "✅ Copied!" : "Tap to copy. This page updates as soon as they join."}</p>
        </div>
      ) : (
        <>
          {/* PARTNER WAITING IN A GAME */}
          {overview.activeRoomId && (
            <button onClick={() => onJoin(overview.activeRoomId!)} disabled={!connected} className="btn btn-gold w-full p-3">
              💌 Join your game ({overview.activeRoomId})
            </button>
          )}

          <nav className="flex gap-1 overflow-x-auto rounded-xl bg-sunken p-1" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${tab === t.id ? "bg-surface-2 text-white" : "text-muted hover:text-white"}`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {errorBanner}

          <div role="tabpanel">
            {tab === "play" && (
              <div className="space-y-4">
                <GameSettings value={settings} onChange={onSettingsChange} />
                <button onClick={onStart} disabled={!connected} className="btn btn-primary w-full p-3">
                  Start a new game
                </button>
                <p className="text-center text-[11px] text-muted">
                  {partner.name} joins from their own account: they log in and tap <b>Join your game</b>, or open your invite link.
                </p>
              </div>
            )}
            {tab === "history" && <HistoryTab session={session} overview={overview} />}
            {tab === "memories" && <MemoryBook session={session} overview={overview} />}
            {tab === "stats" && <StatsTab overview={overview} />}
            {tab === "achievements" && <AchievementsTab overview={overview} definitions={definitions} />}
            {tab === "iou" && <IouWallet session={session} slot={slot} overview={overview} />}
          </div>
        </>
      )}
    </div>
  );
}
