import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { tokens, fontStack, monoStack } from "../../../tokens";
import { ALL_CMAS, type CMA, fadeIn, lift } from "./shared";

const W = 1920;
const H = 1080;

// Carousel — one CMA on screen at a time, sequenced. Cleanest readability,
// best for a Beat-3 voiceover that names each agent in order.
//
// Slide timing (frames):
//   Slide 0 (Classifier):       0..150   in 0..30,  hold 30..120, out 120..150
//   Slide 1 (Reconciliation):   140..290 in 140..170, hold 170..260, out 260..290
//   Slide 2 (Deep Researcher):  280..450 in 280..310, hold 310..400, out 400..430

const SLIDE_LEN = 150;
const SLIDE_OFFSET = 140;

const slideOpacity = (frame: number, slideStart: number) => {
  const local = frame - slideStart;
  if (local < 0) return 0;
  if (local <= 30) return interpolate(local, [0, 30], [0, 1]);
  if (local <= 120) return 1;
  if (local <= 150) return interpolate(local, [120, 150], [1, 0]);
  return 0;
};

const Slide: React.FC<{ cma: CMA; index: number; slideStart: number; frame: number }> = ({
  cma,
  index,
  slideStart,
  frame,
}) => {
  const o = slideOpacity(frame, slideStart);
  if (o <= 0) return null;

  const local = Math.max(0, frame - slideStart);
  const scale = interpolate(local, [0, 30], [0.96, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ly = interpolate(local, [0, 30], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const isAsk = cma.timing === "ask";
  const accentColor = isAsk ? tokens.ribbon : tokens.emeraldBright;

  const nL = slideStart + 6;     // model line
  const nN = slideStart + 12;    // name
  const nT = slideStart + 22;    // timing pill
  const nR = slideStart + 32;    // role
  const nB = slideStart + 44;    // beats base
  const nS = slideStart + 64;    // skills base

  return (
    <AbsoluteFill
      style={{
        opacity: o,
        transform: `scale(${scale}) translateY(${ly}px)`,
        transformOrigin: "center center",
      }}
    >
      {/* Numeral, large, top-left */}
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 140,
          fontFamily: monoStack,
          fontSize: 220,
          fontWeight: 600,
          color: tokens.surface,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          textShadow: `0 0 1px ${tokens.hairlineStrong}`,
          WebkitTextStroke: `1px ${tokens.hairlineStrong}`,
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>

      {/* Inline kicker — model + counter */}
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 380,
          width: 1600,
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontFamily: monoStack,
          fontSize: 16,
          color: tokens.inkFaint,
          opacity: fadeIn(frame, nL, 18),
        }}
      >
        <span>Agent {index + 1} / 3</span>
        <span style={{ color: tokens.hairlineStrong }}>·</span>
        <span>{cma.model}</span>
      </div>

      {/* Name */}
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 420,
          width: 1600,
          fontSize: 144,
          fontWeight: 600,
          letterSpacing: "-0.035em",
          lineHeight: 1.0,
          color: tokens.ink,
          opacity: fadeIn(frame, nN, 22),
          transform: `translateY(${lift(frame, nN, 22, 12)}px)`,
        }}
      >
        {cma.name}
      </div>

      {/* Timing pill */}
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 600,
          opacity: fadeIn(frame, nT, 22),
          transform: `translateY(${lift(frame, nT, 22, 8)}px)`,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 18px",
            borderRadius: 999,
            background: isAsk
              ? "rgba(176, 136, 255, 0.13)"
              : "rgba(16, 185, 129, 0.13)",
            border: `1px solid ${isAsk ? "rgba(176, 136, 255, 0.45)" : "rgba(16, 185, 129, 0.45)"}`,
            color: accentColor,
            fontFamily: fontStack,
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: accentColor,
            }}
          />
          {isAsk ? "when you ask" : "when you submit"}
        </span>
      </div>

      {/* Role — large prose line */}
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 680,
          width: 1300,
          fontSize: 44,
          fontWeight: 500,
          letterSpacing: "-0.015em",
          color: tokens.ink,
          lineHeight: 1.2,
          opacity: fadeIn(frame, nR, 22),
          transform: `translateY(${lift(frame, nR, 22, 10)}px)`,
        }}
      >
        {cma.role}
      </div>

      {/* Beats */}
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 770,
          width: 1300,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {cma.beats.map((b, i) => (
          <div
            key={b}
            style={{
              fontSize: 22,
              color: tokens.inkDim,
              lineHeight: 1.4,
              paddingLeft: 16,
              borderLeft: `2px solid ${tokens.hairlineStrong}`,
              opacity: fadeIn(frame, nB + i * 8, 22),
              transform: `translateY(${lift(frame, nB + i * 8, 22, 6)}px)`,
            }}
          >
            {b}
          </div>
        ))}
      </div>

      {/* Skills */}
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 940,
          width: 1600,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {cma.skills.map((s, i) => (
          <span
            key={s}
            style={{
              fontFamily: monoStack,
              fontSize: 14,
              color: tokens.inkDim,
              padding: "6px 12px",
              borderRadius: 6,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${tokens.hairline}`,
              opacity: fadeIn(frame, nS + i * 6, 22),
            }}
          >
            skill · {s}
          </span>
        ))}
      </div>

      {/* Bottom progress strip — 3 segments */}
      <div
        style={{
          position: "absolute",
          left: 160,
          bottom: 60,
          width: 1600,
          display: "flex",
          gap: 8,
        }}
      >
        {ALL_CMAS.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background:
                i === index
                  ? accentColor
                  : i < index
                    ? tokens.hairlineStrong
                    : tokens.hairline,
              opacity: i === index ? 1 : 0.7,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const CMACarousel: React.FC = () => {
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
          left: 160,
          top: 70,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: tokens.inkFaint,
        }}
      >
        Beat 3 · the agents
      </div>
      {ALL_CMAS.map((cma, i) => (
        <Slide
          key={cma.id}
          cma={cma}
          index={i}
          slideStart={i * SLIDE_OFFSET}
          frame={frame}
        />
      ))}
    </AbsoluteFill>
  );
};
