"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;

// Cube rotation [rotateX, rotateY] that brings each face to the front
const ROTATIONS: Record<DiceValue, [number, number]> = {
  1: [0, 0],
  2: [0, -90],
  3: [-90, 0],
  4: [90, 0],
  5: [0, 90],
  6: [180, 0],
};

export default function Dice({
  value = 1,
  rolling,
  color = "#ffffff",
}: {
  value?: number;
  rolling: boolean;
  color?: string;
}) {
  const cubeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cube = cubeRef.current;
    if (!cube) return;

    if (rolling) {
      gsap.to(cube, {
        rotateX: "+=720",
        rotateY: "+=720",
        duration: 0.8,
        ease: "power2.inOut",
      });
      return;
    }

    const [x, y] = ROTATIONS[value as DiceValue] ?? ROTATIONS[1];

    gsap.to(cube, {
      rotateX: x,
      rotateY: y,
      duration: 0.6,
      ease: "power3.out",
    });
  }, [value, rolling]);

  return (
    // pointer-events-none: a face turned edge-on in 3D projects a huge invisible hit
    // area that would swallow taps on things below the board (e.g. the challenge card
    // on phones). The surrounding button still receives the click.
    <div className="perspective w-20 h-20 pointer-events-none">
      <div
        ref={cubeRef}
        className="dice-cube relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* FRONT (1) */}
        <Face dots={1} color={color} transform="rotateY(0deg) translateZ(40px)" />

        {/* BACK (6) */}
        <Face dots={6} color={color} transform="rotateY(180deg) translateZ(40px)" />

        {/* RIGHT (2) */}
        <Face dots={2} color={color} transform="rotateY(90deg) translateZ(40px)" />

        {/* LEFT (5) */}
        <Face dots={5} color={color} transform="rotateY(-90deg) translateZ(40px)" />

        {/* TOP (3) */}
        <Face dots={3} color={color} transform="rotateX(90deg) translateZ(40px)" />

        {/* BOTTOM (4) */}
        <Face dots={4} color={color} transform="rotateX(-90deg) translateZ(40px)" />
      </div>
    </div>
  );
}

function Face({ dots, color, transform }: { dots: DiceValue; color: string; transform: string }) {
  return (
    <div
      className="absolute w-20 h-20 rounded-xl flex items-center justify-center"
      style={{
        transform,
        backfaceVisibility: "hidden",
        background: "linear-gradient(145deg, #fffaf5 0%, #fbeee6 60%, #ead6cc 100%)",
        border: `3px solid ${color}`,
        boxShadow: "inset 0 0 10px rgba(80,30,50,0.18)",
        transition: "border-color 0.4s ease, box-shadow 0.4s ease",
      }}
    >
      <Dots count={dots} />
    </div>
  );
}

const DOT_LAYOUT: Record<DiceValue, string[]> = {
  1: ["center"],
  2: ["top-left", "bottom-right"],
  3: ["top-left", "center", "bottom-right"],
  4: ["top-left", "top-right", "bottom-left", "bottom-right"],
  5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
  6: ["top-left", "middle-left", "bottom-left", "top-right", "middle-right", "bottom-right"],
};

function Dots({ count }: { count: DiceValue }) {
  return (
    <div className="relative w-full h-full">
      {DOT_LAYOUT[count].map((pos) => (
        <span key={pos} className={`dot dot-${pos}`} />
      ))}
    </div>
  );
}
