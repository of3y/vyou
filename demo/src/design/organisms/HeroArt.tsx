import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { tokens } from "../../tokens";
import { enterSpring, pulseLoop, SPRING_FIRM } from "../motion";
import { Pill } from "../atoms/Pill";

export type HeroArtProps = {
  topLeftPill?: React.ReactNode;
  topRightPill?: React.ReactNode;
  bottomRightPill?: React.ReactNode;
  // Cone sweep duration in frames.
  sweepFrames?: number;
  // Frame at which the sweep begins.
  startFrame?: number;
  delayFrames?: number;
};

// HeroArt — pulsing emerald view-cone over a subtle topo grid. Layout-agnostic:
// expands to fill its parent. Use inside a sized wrapper or AbsoluteFill.
export const HeroArt: React.FC<HeroArtProps> = ({
  topLeftPill,
  topRightPill,
  bottomRightPill,
  sweepFrames = 24,
  startFrame = 0,
  delayFrames = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cone sweep — drives clip + opacity for the cone fill/edges.
  const sweepLocal = Math.max(0, frame - startFrame - delayFrames);
  const sweepT = enterSpring(sweepLocal, fps, 0, SPRING_FIRM);
  // Once sweep is mostly done, the pulse takes over.
  const pulseT = sweepT > 0.85 ? pulseLoop(frame - startFrame, Math.round(fps * 2.4)) : 0;

  // Clip rectangle expands upward from the pin to fully reveal the cone.
  // Pin is at y=312 in viewBox; cone apex at y=60. We grow a rect from
  // y=312 (height 0) up to y=60 (height 252) as sweepT goes 0→1.
  const clipHeight = 252 * sweepT;
  const clipY = 312 - clipHeight;
  const coneOpacity = sweepT;

  return (
    <AbsoluteFill
      style={{
        borderRadius: 24,
        overflow: "hidden",
        background:
          "radial-gradient(140% 90% at 50% 110%, rgba(16, 185, 129, 0.25) 0%, transparent 55%), linear-gradient(180deg, #1a1f29 0%, #0f1115 100%)",
        border: `1px solid ${tokens.hairline}`,
      }}
    >
      {/* topo grid */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(70% 70% at 50% 55%, #000 30%, transparent 95%)",
          WebkitMaskImage:
            "radial-gradient(70% 70% at 50% 55%, #000 30%, transparent 95%)",
        }}
      />

      {/* corner pills */}
      {topLeftPill && (
        <div style={{ position: "absolute", top: 14, left: 14 }}>
          {topLeftPill}
        </div>
      )}
      {topRightPill && (
        <div style={{ position: "absolute", top: 14, right: 14 }}>
          {topRightPill}
        </div>
      )}
      {bottomRightPill && (
        <div style={{ position: "absolute", bottom: 14, right: 14 }}>
          {bottomRightPill}
        </div>
      )}

      {/* cone */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          viewBox="0 0 400 400"
          style={{ width: "78%", height: "auto", opacity: coneOpacity }}
        >
          <defs>
            <linearGradient id="coneGradHero" x1="0.5" y1="1" x2="0.5" y2="0">
              <stop offset="0%" stopColor={tokens.emerald} stopOpacity={0.65} />
              <stop offset="60%" stopColor={tokens.emerald} stopOpacity={0.18} />
              <stop offset="100%" stopColor={tokens.emerald} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="coneEdgeHero" x1="0.5" y1="1" x2="0.5" y2="0">
              <stop offset="0%" stopColor={tokens.emeraldBright} stopOpacity={0.9} />
              <stop offset="100%" stopColor={tokens.emeraldBright} stopOpacity={0.05} />
            </linearGradient>
            <clipPath id="coneSweepClip">
              <rect x={0} y={clipY} width={400} height={clipHeight} />
            </clipPath>
          </defs>
          <g clipPath="url(#coneSweepClip)">
            <path d="M 200 312 L 60 60 L 340 60 Z" fill="url(#coneGradHero)" />
            <path
              d="M 200 312 L 60 60"
              stroke="url(#coneEdgeHero)"
              strokeWidth={1.5}
              fill="none"
            />
            <path
              d="M 200 312 L 340 60"
              stroke="url(#coneEdgeHero)"
              strokeWidth={1.5}
              fill="none"
            />
            <path
              d="M 130 200 A 90 90 0 0 1 270 200"
              stroke={tokens.emeraldBright}
              strokeOpacity={0.45}
              strokeWidth={1}
              fill="none"
              strokeDasharray="2 4"
            />
          </g>
          <circle cx={200} cy={312} r={8} fill={tokens.emerald} />
          <circle
            cx={200}
            cy={312}
            r={14}
            fill="none"
            stroke={tokens.emerald}
            strokeOpacity={0.55}
            strokeWidth={1.5}
          />
        </svg>
      </AbsoluteFill>

      {/* pulse dot at the reporter pin (78% down vertically, centered) */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "78%",
          width: 14,
          height: 14,
          marginLeft: -7,
          marginTop: -7,
          borderRadius: "50%",
          background: tokens.emerald,
          boxShadow: `0 0 0 ${pulseT * 24}px rgba(16, 185, 129, ${0.55 * (1 - pulseT)})`,
          opacity: sweepT,
        }}
      />
    </AbsoluteFill>
  );
};

// Convenience wrapper: drops in default corner pills matching the design slate.
export const HeroArtDefault: React.FC<{ delayFrames?: number }> = ({
  delayFrames = 0,
}) => (
  <HeroArt
    delayFrames={delayFrames}
    topLeftPill={
      <Pill showDot delayFrames={delayFrames + 6}>
        VYU
      </Pill>
    }
    topRightPill={<Pill delayFrames={delayFrames + 10}>Reports</Pill>}
    bottomRightPill={
      <Pill showDot delayFrames={delayFrames + 30}>
        verified · 2 min ago
      </Pill>
    }
  />
);
