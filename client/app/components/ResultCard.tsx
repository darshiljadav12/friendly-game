"use client";

import { useState } from "react";
import { playerTheme } from "../constants";
import type { AchievementDef, GameState } from "../types";

const W = 1080;
const H = 1350;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// The nicest moment of the game for the card: a match, a 3-heart answer, a beaten timer…
function bestMoment(game: GameState) {
  const log = [...game.log].reverse();
  const pick =
    log.find((e) => e.icon === "🔮") ??
    log.find((e) => e.icon === "❤️" && e.text.includes("❤️❤️❤️")) ??
    log.find((e) => e.icon === "💑" && e.text.startsWith("Together challenge done")) ??
    log.find((e) => e.icon === "⏱️" && e.text.includes("in time")) ??
    log.find((e) => e.icon === "✅");
  return pick ? { text: pick.text, detail: pick.detail } : null;
}

function drawCard(game: GameState, definitions: AchievementDef[], colorIndex: (id: string) => number) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const font = (weight: number, size: number) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue("--rose").trim() || "#fb7185";
  const gold = styles.getPropertyValue("--gold").trim() || "#fbbf24";

  // background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#3d1531");
  bg.addColorStop(0.5, "#2b1238");
  bg.addColorStop(1, "#170c2b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(150, 0, 0, 150, 0, 700);
  glow.addColorStop(0, "rgba(251,113,133,0.35)");
  glow.addColorStop(1, "rgba(251,113,133,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#fdf2f8";
  ctx.font = font(900, 64);
  ctx.fillText("💞 Friendly Game", W / 2, 130);
  ctx.font = font(500, 30);
  ctx.fillStyle = "#c4a3b8";
  const mode = game.settings.mode === "coop" ? "Co-op" : "Competitive";
  const length = game.settings.rounds ? `${game.settings.rounds} rounds` : `First to ${game.settings.target}`;
  ctx.fillText(`${new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })} · ${mode} · ${length}`, W / 2, 185);

  // headline
  const isCoop = game.settings.mode === "coop";
  const winners = game.players.filter((p) => game.winnerIds.includes(p.id));
  const headline = isCoop
    ? game.coopWon
      ? "We did it together!"
      : "So close!"
    : winners.length > 1
      ? "It's a tie!"
      : `${winners[0]?.username} wins!`;
  ctx.font = font(900, 92);
  const grad = ctx.createLinearGradient(200, 0, W - 200, 0);
  grad.addColorStop(0, accent);
  grad.addColorStop(1, gold);
  ctx.fillStyle = grad;
  ctx.fillText(headline, W / 2, 330);

  // players
  const cardW = 440;
  game.players.forEach((p, i) => {
    const x = i === 0 ? 80 : W - 80 - cardW;
    const y = 400;
    const t = playerTheme(colorIndex(p.id));
    roundRect(ctx, x, y, cardW, 330, 36);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fill();
    ctx.strokeStyle = t.base;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = t.base;
    ctx.font = font(800, 44);
    ctx.fillText(`${p.avatar ?? ""} ${p.username}`.trim(), x + cardW / 2, y + 75);
    ctx.font = font(900, 120);
    ctx.fillText(String(p.score), x + cardW / 2, y + 205);
    ctx.font = font(500, 26);
    ctx.fillStyle = "#c4a3b8";
    ctx.fillText(`✅ ${p.tally.done} done · ❤️ ${p.tally.heartsReceived} · 🔮 ${p.tally.guessMatches}`, x + cardW / 2, y + 265);
    ctx.fillText(`🃏 ${p.tally.cardsUsed} cards · 🎲 ${p.tally.sixes} sixes`, x + cardW / 2, y + 302);
  });

  if (isCoop && game.settings.coopGoal) {
    const total = game.players.reduce((s, p) => s + p.score, 0);
    ctx.font = font(700, 34);
    ctx.fillStyle = "#fdf2f8";
    ctx.fillText(`💞 Love meter ${total} / ${game.settings.coopGoal}`, W / 2, 790);
  }

  // best moment
  const moment = bestMoment(game);
  let y = 860;
  if (moment) {
    roundRect(ctx, 80, y, W - 160, 230, 32);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fill();
    ctx.font = font(700, 26);
    ctx.fillStyle = gold;
    ctx.fillText("✨ BEST MOMENT", W / 2, y + 55);
    ctx.fillStyle = "#fdf2f8";
    ctx.font = font(600, 34);
    wrap(ctx, moment.text, W - 240)
      .slice(0, 2)
      .forEach((line, i) => ctx.fillText(line, W / 2, y + 108 + i * 44));
    if (moment.detail) {
      ctx.font = font(400, 26);
      ctx.fillStyle = "#c4a3b8";
      ctx.fillText(`“${wrap(ctx, moment.detail, W - 260)[0]}”`, W / 2, y + 200);
    }
    y += 260;
  }

  // badges earned this game
  const ids = [...new Set(Object.values(game.results?.achievements ?? {}).flat())];
  const badges = ids.map((id) => definitions.find((d) => d.id === id)).filter(Boolean) as AchievementDef[];
  if (badges.length) {
    ctx.font = font(500, 52);
    ctx.fillText(badges.slice(0, 8).map((b) => b.icon).join("  "), W / 2, y + 55);
    ctx.font = font(500, 24);
    ctx.fillStyle = "#c4a3b8";
    ctx.fillText(badges.slice(0, 4).map((b) => b.name).join(" · "), W / 2, y + 100);
  }

  return canvas;
}

export default function ResultCard({ game, definitions, colorIndex }: { game: GameState; definitions: AchievementDef[]; colorIndex: (id: string) => number }) {
  const [busy, setBusy] = useState(false);

  const make = () =>
    new Promise<Blob | null>((resolve) => drawCard(game, definitions, colorIndex).toBlob(resolve, "image/png"));

  const share = async () => {
    setBusy(true);
    try {
      const blob = await make();
      if (!blob) return;
      const file = new File([blob], "friendly-game-result.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Friendly Game", text: "Our game tonight 💞" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    } catch {
      // share cancelled
    } finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={share} disabled={busy} className="btn btn-gold w-full p-3">
      {busy ? "Making your card…" : "📸 Share result card"}
    </button>
  );
}
