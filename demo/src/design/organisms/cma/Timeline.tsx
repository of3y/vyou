import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { tokens, fontStack, monoStack } from "../../../tokens";
import {
  ALL_CMAS,
  CLASSIFIER,
  RECONCILIATION,
  DEEP_RESEARCHER,
  CMACard,
  fadeIn,
  lift,
} from "./shared";

const W = 1920;
const H = 1080;

// Timeline-centric — emphasises the temporal structure of "two when you
// submit, one when you ask" by placing a literal time axis above the cards.
//
// Layout (no overlap):
//   Title:           x=160..1760, y=70..130
//   Subtitle:        x=160..1760, y=148..184
//   Time axis rail:  x=160..1760, y=300..302  (1px line)
//   "share" label:   x=200..520,  y=232..262
//   "ask" label:     x=1400..1720, y=232..262
//   Share marker dot: cx=380, cy=300 (green)
//   Ask marker dot:   cx=1540, cy=300 (ribbon)
//   Card Classifier:    x=160..720,   y=360..960
//   Card Reconciliation: x=760..1320, y=360..960
//   Card Deep Researcher: x=1360..1760, y=360..960  (narrower, distinct on the right)

const TimeAxis: React.FC<{ frame: number }> = ({ frame }) => {
  const o = fadeIn(frame, 30, 24);
  return (
    <>
      {/* rail */}
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 300,
          width: 1600,
          height: 2,
          background: tokens.hairlineStrong,
          opacity: o,
        }}
      />
      {/* dotted span between the markers */}
      <div
        style={{
          position: "absolute",
          left: 380,
          top: 297,
          width: 1160,
          height: 8,
          backgroundImage: `radial-gradient(circle, ${tokens.inkFaint} 1px, transparent 1.5px)`,
          backgroundSize: "12px 8px",
          backgroundRepeat: "repeat-x",
          opacity: fadeIn(frame, 80, 26),
        }}
      />

      {/* markers */}
      <Marker x={380} color={tokens.emeraldBright} enterFrame={50} frame={frame} />
      <Marker x={1540} color={tokens.ribbon} enterFrame={140} frame={frame} />

      {/* labels above */}
      <AxisLabel
        x={200}
        text="share moment"
        enterFrame={20}
        frame={frame}
        tone="emerald"
      />
      <AxisLabel
        x={1400}
        text="ask moment"
        enterFrame={120}
        frame={frame}
        tone="ribbon"
      />

      {/* small "Δt" hint mid-axis */}
      <div
        style={{
          position: "absolute",
          left: 920,
          top: 268,
          width: 80,
          textAlign: "center",
          fontFamily: monoStack,
          fontSize: 12,
          color: tokens.inkFaint,
          opacity: fadeIn(frame, 100, 26),
        }}
      >
        Δt — minutes to days
      </div>
    </>
  );
};

const Marker: React.FC<{
  x: number;
  color: string;
  enterFrame: number;
  frame: number;
}> = ({ x, color, enterFrame, frame }) => {
  const o = fadeIn(frame, enterFrame, 18);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x - 8,
          top: 293,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 12px ${color}`,
          opacity: o,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x - 14,
          top: 287,
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: `1px solid ${color}`,
          opacity: o * 0.6,
        }}
      />
    </>
  );
};

const AxisLabel: React.FC<{
  x: number;
  text: string;
  enterFrame: number;
  frame: number;
  tone: "emerald" | "ribbon";
}> = ({ x, text, enterFrame, frame, tone }) => {
  const o = fadeIn(frame, enterFrame, 22);
  const dotColor = tone === "emerald" ? tokens.emeraldBright : tokens.ribbon;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 232,
        width: 320,
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: fontStack,
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: tokens.inkDim,
        opacity: o,
        transform: `translateY(${lift(frame, enterFrame, 22, 6)}px)`,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: dotColor,
        }}
      />
      {text}
    </div>
  );
};

// A vertical connector from the axis marker down to the card top edge.
const Connector: React.FC<{
  x: number;
  enterFrame: number;
  frame: number;
  tone: "emerald" | "ribbon";
}> = ({ x, enterFrame, frame, tone }) => {
  const length = interpolate(frame, [enterFrame, enterFrame + 22], [0, 58], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 300,
        width: 1,
        height: length,
        background: tone === "emerald" ? tokens.emerald : tokens.ribbon,
        opacity: 0.55,
      }}
    />
  );
};

export const CMATimeline: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background: tokens.bg,
        color: tokens.ink,
        fontFamily: fontStack,
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 70,
          width: 1600,
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
          left: 160,
          top: 95,
          width: 1600,
          fontSize: 44,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          opacity: fadeIn(frame, 8, 22),
          transform: `translateY(${lift(frame, 8, 22, 12)}px)`,
        }}
      >
        Three Managed Agents · two moments in time.
      </div>
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 158,
          width: 1600,
          fontSize: 22,
          color: tokens.inkDim,
          opacity: fadeIn(frame, 22, 22),
          transform: `translateY(${lift(frame, 22, 22, 8)}px)`,
        }}
      >
        Classifier and Reconciliation fire when you share. Deep Researcher
        fires when you ask.
      </div>

      <TimeAxis frame={frame} />

      {/* Vertical connectors from axis markers to card tops */}
      <Connector x={380} enterFrame={170} frame={frame} tone="emerald" />
      <Connector x={1040} enterFrame={185} frame={frame} tone="emerald" />
      <Connector x={1540} enterFrame={210} frame={frame} tone="ribbon" />

      {/* Cards */}
      <CMACard
        cma={CLASSIFIER}
        index={0}
        x={160}
        y={360}
        width={560}
        height={600}
        enterFrame={180}
        rowStaggerFrames={5}
        frame={frame}
      />
      <CMACard
        cma={RECONCILIATION}
        index={1}
        x={760}
        y={360}
        width={560}
        height={600}
        enterFrame={210}
        rowStaggerFrames={5}
        frame={frame}
      />
      <CMACard
        cma={DEEP_RESEARCHER}
        index={2}
        x={1360}
        y={360}
        width={400}
        height={600}
        enterFrame={250}
        rowStaggerFrames={5}
        frame={frame}
      />
    </AbsoluteFill>
  );
};
