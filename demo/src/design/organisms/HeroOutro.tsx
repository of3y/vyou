import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { tokens, fontStack } from "../../tokens";
import { enterSpring } from "../motion";

// Hero outro slide.
//
// Warm-white canvas, no chrome — just the VYU mark (top centre) where the
// "V" is the brand cone in golden, and the YU letters are ink-black. The
// claim "What's in your view?" animates in below; the VYU stays put.

const W = 1920;
const H = 1080;
const WARM_WHITE = "#f5ede0";        // warm cream — palette-adjacent
const GOLDEN = tokens.amber;         // #f59e0b
const INK_BLACK = tokens.bg;         // #0f1115

// Letter / glyph height for the wordmark.
const CAP = 360;

export const HeroOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // VYU enters first, as one piece, and then stays static.
  const tWord = enterSpring(frame, fps, 6);

  // The claim animates in after VYU has settled (~36 frames later).
  const tClaimRise = enterSpring(frame, fps, 50);
  const tClaimSettle = enterSpring(frame, fps, 70);

  return (
    <AbsoluteFill
      style={{
        background: WARM_WHITE,
        color: INK_BLACK,
        fontFamily: fontStack,
      }}
    >
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 80,
        }}
      >
        {/* ─── VYU wordmark — V is typographic in golden, YU in ink ─── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 0,
            opacity: tWord,
            transform: `translateY(${(1 - tWord) * 24}px)`,
            fontFamily: fontStack,
            fontSize: CAP * 1.42,
            fontWeight: 600,
            letterSpacing: "-0.06em",
            lineHeight: 0.78,
          }}
        >
          <span style={{ color: GOLDEN }}>V</span>
          <span style={{ color: INK_BLACK }}>Y</span>
          <span style={{ color: INK_BLACK }}>U</span>
        </div>

        {/* ─── Claim ─── */}
        <div
          style={{
            fontSize: 84,
            fontWeight: 500,
            letterSpacing: "-0.025em",
            color: INK_BLACK,
            opacity: tClaimSettle,
            transform: `translateY(${(1 - tClaimRise) * 36}px)`,
            lineHeight: 1.05,
            textAlign: "center",
          }}
        >
          What's in your view?
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
