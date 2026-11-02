"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { POWER_UP_INFO } from "../constants";
import type { Meta, Player, PowerUp } from "../types";

const MAX_CARDS = 3;

export default function Shop({ me, meta, onBuy, onClose }: { me: Player; meta: Meta | null; onBuy: (card: PowerUp) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const full = me.powerUps.length >= MAX_CARDS;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Shop">
      <div className="panel w-full max-w-md rounded-b-none sm:rounded-[1.25rem] p-5" style={{ background: "var(--surface)" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black title-gradient">🛒 Shop</h2>
            <p className="text-xs text-muted">Open until your next roll (or Teleport)</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl font-black text-gold">🪙 {me.coins}</p>
            <p className="text-[11px] text-muted">
              {me.powerUps.length}/{MAX_CARDS} cards
            </p>
          </div>
        </div>

        {full && <p className="mb-3 rounded-xl bg-rose/10 px-3 py-2 text-xs text-rose-100">Your hand is full (3 cards). Play one to buy more.</p>}

        <ul className="space-y-2">
          {(Object.keys(POWER_UP_INFO) as PowerUp[]).map((card) => {
            const info = POWER_UP_INFO[card];
            const price = meta?.powerUps[card]?.price ?? info.price;
            const canAfford = me.coins >= price;
            return (
              <li key={card} className="flex items-center gap-3 rounded-xl bg-sunken p-3">
                <span className="text-2xl" aria-hidden>
                  {info.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{info.name}</p>
                  <p className="text-[11px] leading-snug text-muted">{info.desc}</p>
                </div>
                <button
                  onClick={() => onBuy(card)}
                  disabled={full || !canAfford}
                  className="btn btn-gold shrink-0 px-3 py-1.5 text-xs"
                  aria-label={`Buy ${info.name} for ${price} coins`}
                >
                  🪙 {price}
                </button>
              </li>
            );
          })}
        </ul>

        <button onClick={onClose} className="mt-4 w-full text-sm text-muted underline hover:text-white">
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}
