"use client";

import { useEffect, useRef, useState } from "react";
import { socket } from "../../lib/socket";
import type { Stroke } from "../types";

const COLORS = ["#1f1a24", "#e11d48", "#f59e0b", "#0ea5e9", "#16a34a", "#a855f7"];
const SIZES = [4, 10];
const PAPER = "#fdf6ee";
const SEND_EVERY_MS = 80; // live strokes go out in small chunks

type Point = [number, number];

const clamp = (n: number) => Math.min(1, Math.max(0, n));

// Line width is relative to a 300px canvas so both screens look the same
function paint(ctx: CanvasRenderingContext2D, stroke: Stroke, width: number) {
  const [first, ...rest] = stroke.points;
  if (!first) return;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = (stroke.size * width) / 300;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(first[0] * width, first[1] * width);
  if (rest.length === 0) ctx.lineTo(first[0] * width + 0.01, first[1] * width);
  for (const [x, y] of rest) ctx.lineTo(x * width, y * width);
  ctx.stroke();
}

// Draw It canvas: the drawer draws, everyone else sees it live. Also shows the finished drawing.
export default function DrawPad({ canDraw, onWord }: { canDraw: boolean; onWord?: (word: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<{ stroke: Stroke; sent: number; lastSend: number } | null>(null);
  const onWordRef = useRef(onWord);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[0]);

  useEffect(() => {
    onWordRef.current = onWord;
  }, [onWord]);

  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    strokes.current.forEach((s) => paint(ctx, s, canvas.width));
  };

  // Square canvas at the screen's pixel density, redrawn when the card resizes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      // offsetWidth is the layout size: unlike getBoundingClientRect it ignores transforms, so a card
      // that is still flipping in (3D rotated, nearly 0px wide on screen) can't give a tiny, blurry canvas
      const px = Math.round(canvas.offsetWidth * (window.devicePixelRatio || 1));
      if (px === 0) return;
      if (px === canvas.width) return;
      canvas.width = px;
      canvas.height = px;
      redraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Strokes so far (after a refresh), the word if I'm drawing, then live updates
  useEffect(() => {
    let alive = true;
    const sync = () =>
      socket.emit("drawSync", null, (res: { strokes?: Stroke[]; word?: string | null }) => {
        if (!alive) return;
        strokes.current = res.strokes ?? [];
        redraw();
        onWordRef.current?.(res.word ?? null);
      });
    const onStroke = (stroke: Stroke) => {
      strokes.current.push(stroke);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) paint(ctx, stroke, canvas.width);
    };
    const onClear = () => {
      strokes.current = [];
      redraw();
    };

    sync();
    socket.on("drawStroke", onStroke);
    socket.on("drawClear", onClear);
    socket.on("connect", sync);
    return () => {
      alive = false;
      socket.off("drawStroke", onStroke);
      socket.off("drawClear", onClear);
      socket.off("connect", sync);
    };
  }, []);

  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [clamp((e.clientX - rect.left) / rect.width), clamp((e.clientY - rect.top) / rect.height)];
  };

  // Sends the points added since the last chunk (plus the previous one, so chunks join up)
  const flush = () => {
    const cur = current.current;
    if (!cur) return;
    const fresh = cur.stroke.points.slice(Math.max(0, cur.sent - 1));
    if (fresh.length === 0 || (cur.sent > 0 && fresh.length < 2)) return;
    socket.emit("drawStroke", { points: fresh, color: cur.stroke.color, size: cur.stroke.size });
    cur.sent = cur.stroke.points.length;
    cur.lastSend = Date.now();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const stroke: Stroke = { points: [pointFrom(e)], color, size };
    strokes.current.push(stroke);
    current.current = { stroke, sent: 0, lastSend: Date.now() };
    const ctx = e.currentTarget.getContext("2d");
    if (ctx) paint(ctx, stroke, e.currentTarget.width);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cur = current.current;
    if (!cur) return;
    const prev = cur.stroke.points[cur.stroke.points.length - 1];
    const next = pointFrom(e);
    cur.stroke.points.push(next);
    const ctx = e.currentTarget.getContext("2d");
    if (ctx) paint(ctx, { ...cur.stroke, points: [prev, next] }, e.currentTarget.width);
    if (Date.now() - cur.lastSend > SEND_EVERY_MS) flush();
  };

  const onPointerUp = () => {
    flush();
    current.current = null;
  };

  const clear = () => {
    strokes.current = [];
    redraw();
    socket.emit("drawClear");
  };

  return (
    <div className="mt-3">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // capped so the word and timer above stay on screen while drawing on a phone
        className={`mx-auto block aspect-square w-full max-w-[300px] rounded-xl border border-line ${canDraw ? "cursor-crosshair touch-none" : ""}`}
        aria-label={canDraw ? "Drawing area: draw your word here" : "Your partner's drawing"}
      />
      {canDraw && (
        <div className="mx-auto mt-2 flex max-w-[300px] flex-wrap items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Colour ${c}`}
              aria-pressed={color === c}
              className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-white scale-110" : "border-transparent"}`}
              style={{ background: c }}
            />
          ))}
          <button
            onClick={() => setSize(size === SIZES[0] ? SIZES[1] : SIZES[0])}
            className="btn btn-secondary px-2.5 py-1 text-xs"
            aria-label="Brush size"
          >
            {size === SIZES[0] ? "✏️ Thin" : "🖌️ Thick"}
          </button>
          <button onClick={clear} className="btn btn-secondary ml-auto px-2.5 py-1 text-xs">
            🧽 Clear
          </button>
        </div>
      )}
    </div>
  );
}
