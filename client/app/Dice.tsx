"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

const faceMap = {
  1: "face1",
  2: "face2",
  3: "face3",
  4: "face4",
  5: "face5",
  6: "face6",
};

export default function Dice({ value = 1, rolling }) {
  const cubeRef = useRef(null);

  const rotateToFace = (val) => {
    const cube = cubeRef.current;
    if (!cube) return;

    const rotations = {
      1: [0, 0],
      2: [0, -90],
      3: [90, 0],
      4: [-90, 0],
      5: [0, 90],
      6: [180, 0],
    };

    const [x, y] = rotations[val];

    gsap.to(cube, {
      rotateX: x,
      rotateY: y,
      duration: 0.6,
      ease: "power3.out",
    });
  };

  useEffect(() => {
    if (!rolling) {
      rotateToFace(value);
    }
  }, [value, rolling]);

  useEffect(() => {
    if (rolling) {
      gsap.to(cubeRef.current, {
        rotateX: "+=720",
        rotateY: "+=720",
        duration: 0.8,
        ease: "power2.inOut",
      });
    }
  }, [rolling]);

  return (
    <div className="perspective w-20 h-20">
      <div
        ref={cubeRef}
        className="dice-cube relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* FRONT (1) */}
        <Face dots={1} transform="rotateY(0deg) translateZ(40px)" />

        {/* BACK (6) */}
        <Face dots={6} transform="rotateY(180deg) translateZ(40px)" />

        {/* RIGHT (2) */}
        <Face dots={2} transform="rotateY(90deg) translateZ(40px)" />

        {/* LEFT (5) */}
        <Face dots={5} transform="rotateY(-90deg) translateZ(40px)" />

        {/* TOP (3) */}
        <Face dots={3} transform="rotateX(90deg) translateZ(40px)" />

        {/* BOTTOM (4) */}
        <Face dots={4} transform="rotateX(-90deg) translateZ(40px)" />
      </div>
    </div>
  );
}

function Face({ dots, transform }) {
  return (
    <div
      className="absolute w-20 h-20 bg-white rounded-xl shadow-lg flex items-center justify-center"
      style={{
        transform,
        backfaceVisibility: "hidden",
      }}
    >
      <Dots count={dots} />
    </div>
  );
}

function Dots({ count }) {
  const layout = {
    1: ["center"],
    2: ["top-left", "bottom-right"],
    3: ["top-left", "center", "bottom-right"],
    4: ["top-left", "top-right", "bottom-left", "bottom-right"],
    5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
    6: [
      "top-left",
      "middle-left",
      "bottom-left",
      "top-right",
      "middle-right",
      "bottom-right",
    ],
  };

  return (
    <div className="relative w-full h-full">
      {layout[count].map((pos, i) => (
        <span key={i} className={`dot dot-${pos}`} />
      ))}
    </div>
  );
}
