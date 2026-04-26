import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { tokens, fontStack } from "../../../tokens";
import { ALL_CMAS, CMACard, fadeIn, lift } from "./shared";

const W = 1920;
const H = 1080;

// Triptych — three full CMA cards side by side, numbered 01/02/03.
// Layout (no overlap):
//   Title:          x=260..1660, y=70..130
//   Subtitle:       x=260..1660, y=148..184
//   Card 1:         x=260..700,  y=220..960
//   Card 2:         x=740..1180, y=220..960
//   Card 3:         x=1220..1660, y=220..960
//   Footer line:    x=260..1660, y=992..1018

export const CMATriptych: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background: tokens.bg,
        color: tokens.ink,
        fontFamily: fontStack,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 260,
          top: 70,
          width: 1400,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: tokens.inkFaint,
          opacity: fadeIn(frame, 0, 18),
        }}
      >
        Beat 3 · the agents
      </div>

      <div
        style={{
          position: "absolute",
          left: 260,
          top: 95,
          width: 1400,
          fontSize: 44,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          opacity: fadeIn(frame, 8, 22),
          transform: `translateY(${lift(frame, 8, 22, 12)}px)`,
        }}
      >
        Three Claude Managed Agents do the work.
      </div>

      <div
        style={{
          position: "absolute",
          left: 260,
          top: 158,
          width: 1400,
          fontSize: 22,
          color: tokens.inkDim,
          opacity: fadeIn(frame, 22, 22),
          transform: `translateY(${lift(frame, 22, 22, 8)}px)`,
        }}
      >
        Two when you submit · one when you ask.
      </div>

      {ALL_CMAS.map((cma, i) => (
        <CMACard
          key={cma.id}
          cma={cma}
          index={i}
          x={260 + i * (440 + 40)}
          y={220}
          width={440}
          height={740}
          enterFrame={60 + i * 30}
          rowStaggerFrames={6}
          frame={frame}
        />
      ))}

      <div
        style={{
          position: "absolute",
          left: 260,
          top: 992,
          width: 1400,
          textAlign: "center",
          fontSize: 13,
          color: tokens.inkFaint,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          opacity: fadeIn(frame, 220, 22),
        }}
      >
        VYU · Beat 3 — the photo, the verification, the answer
      </div>
    </AbsoluteFill>
  );
};
