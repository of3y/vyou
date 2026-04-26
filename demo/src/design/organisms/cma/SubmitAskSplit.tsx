import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { tokens, fontStack } from "../../../tokens";
import {
  CLASSIFIER,
  RECONCILIATION,
  DEEP_RESEARCHER,
  CMACard,
  fadeIn,
  lift,
} from "./shared";

const W = 1920;
const H = 1080;

// Submit/Ask split — emphasises the temporal divide:
//   LEFT  "when you submit"  → Classifier + Reconciliation, stacked
//   RIGHT "when you ask"     → Deep Researcher + an "It inherits" callout
//
// Layout (no overlap):
//   Title:          x=240..1680, y=70..130
//   Subtitle:       x=240..1680, y=148..184
//   Vertical rule:  x=960..961,  y=220..950
//   Left section label:  x=240..920, y=210..240
//   Card Classifier:     x=240..920, y=270..600
//   Card Reconciliation: x=240..920, y=620..950
//   Right section label: x=1000..1680, y=210..240
//   Card Deep Researcher: x=1000..1680, y=270..600
//   Inheritance callout:  x=1000..1680, y=620..950

const Rule: React.FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      position: "absolute",
      left: 960,
      top: 220,
      width: 1,
      height: 730,
      background: tokens.hairline,
      opacity: fadeIn(frame, 30, 22),
    }}
  />
);

const SectionLabel: React.FC<{
  x: number;
  y: number;
  label: string;
  enterFrame: number;
  frame: number;
  tone: "emerald" | "ribbon";
}> = ({ x, y, label, enterFrame, frame, tone }) => {
  const o = fadeIn(frame, enterFrame, 22);
  const dotColor = tone === "emerald" ? tokens.emeraldBright : tokens.ribbon;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 680,
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: fontStack,
        fontSize: 13,
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
      {label}
    </div>
  );
};

const InheritanceCallout: React.FC<{ enterFrame: number; frame: number }> = ({
  enterFrame,
  frame,
}) => {
  const o = fadeIn(frame, enterFrame, 24);
  const ly = lift(frame, enterFrame, 24, 14);
  return (
    <div
      style={{
        position: "absolute",
        left: 1000,
        top: 620 + ly,
        width: 680,
        height: 330,
        background:
          "radial-gradient(120% 80% at 0% 100%, rgba(176,136,255,0.12) 0%, transparent 60%), rgba(20, 23, 29, 0.92)",
        border: `1px solid rgba(176, 136, 255, 0.35)`,
        borderRadius: 18,
        padding: 32,
        opacity: o,
        fontFamily: fontStack,
        color: tokens.ink,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: tokens.ribbon,
            opacity: fadeIn(frame, enterFrame + 8, 22),
          }}
        >
          The trade · for the user
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
            opacity: fadeIn(frame, enterFrame + 20, 26),
            transform: `translateY(${lift(frame, enterFrame + 20, 26, 10)}px)`,
          }}
        >
          It inherits.
        </div>
      </div>
      <div
        style={{
          fontSize: 18,
          color: tokens.inkDim,
          lineHeight: 1.55,
          opacity: fadeIn(frame, enterFrame + 36, 22),
          transform: `translateY(${lift(frame, enterFrame + 36, 22, 8)}px)`,
        }}
      >
        Deep Researcher reads your report, the reports of others nearby, your
        own history with the map — and composes the answer. Never re-derives
        what someone there already felt.
      </div>
    </div>
  );
};

export const CMASubmitAskSplit: React.FC = () => {
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
          left: 240,
          top: 70,
          width: 1440,
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
          left: 240,
          top: 95,
          width: 1440,
          fontSize: 44,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          opacity: fadeIn(frame, 8, 22),
          transform: `translateY(${lift(frame, 8, 22, 12)}px)`,
        }}
      >
        Two when you submit · one when you ask.
      </div>
      <div
        style={{
          position: "absolute",
          left: 240,
          top: 158,
          width: 1440,
          fontSize: 22,
          color: tokens.inkDim,
          opacity: fadeIn(frame, 22, 22),
          transform: `translateY(${lift(frame, 22, 22, 8)}px)`,
        }}
      >
        Three Claude Managed Agents — split across the share moment and the
        ask moment.
      </div>

      <Rule frame={frame} />

      <SectionLabel
        x={240}
        y={210}
        label="when you submit"
        enterFrame={40}
        frame={frame}
        tone="emerald"
      />
      <SectionLabel
        x={1000}
        y={210}
        label="when you ask"
        enterFrame={50}
        frame={frame}
        tone="ribbon"
      />

      <CMACard
        cma={CLASSIFIER}
        index={0}
        x={240}
        y={270}
        width={680}
        height={330}
        enterFrame={70}
        rowStaggerFrames={5}
        frame={frame}
      />
      <CMACard
        cma={RECONCILIATION}
        index={1}
        x={240}
        y={620}
        width={680}
        height={330}
        enterFrame={140}
        rowStaggerFrames={5}
        frame={frame}
      />
      <CMACard
        cma={DEEP_RESEARCHER}
        index={2}
        x={1000}
        y={270}
        width={680}
        height={330}
        enterFrame={210}
        rowStaggerFrames={5}
        frame={frame}
      />
      <InheritanceCallout enterFrame={290} frame={frame} />
    </AbsoluteFill>
  );
};
