import React from "react";
import { interpolate } from "remotion";
import { tokens, fontStack, monoStack } from "../../../tokens";

// Three Claude Managed Agents that ship in the VYU submission. Source of
// truth for every Beat-3 visualisation variant.

export type CMATiming = "submit" | "ask";

export type CMA = {
  id: "classifier" | "reconciliation" | "deep-researcher";
  name: string;
  model: string;            // e.g. "claude-opus-4-7"
  timing: CMATiming;        // when in the user flow this agent runs
  skills: string[];         // skill prefixes loaded into the agent
  role: string;             // the one-line job description
  beats: string[];          // 2–3 short bullets of behavior detail
};

export const CLASSIFIER: CMA = {
  id: "classifier",
  name: "Classifier",
  model: "claude-opus-4-7",
  timing: "submit",
  skills: ["severe-weather-reporting"],
  role: "Reads your photo.",
  beats: [
    "Names what is in your view.",
    "Decides if it belongs on the map.",
  ],
};

export const RECONCILIATION: CMA = {
  id: "reconciliation",
  name: "Reconciliation",
  model: "claude-opus-4-7",
  timing: "submit",
  skills: ["radar-reconciliation"],
  role: "Verifies your photo.",
  beats: [
    "Checks against radar, satellite, official forecast.",
    "Returns a verified report into a memory box.",
  ],
};

export const DEEP_RESEARCHER: CMA = {
  id: "deep-researcher",
  name: "Deep Researcher",
  model: "claude-opus-4-7",
  timing: "ask",
  skills: ["SWR", "RSR", "PRS"],
  role: "Composes your answer.",
  beats: [
    "Reads your report, others nearby, your own history.",
    "Inherits the cool wind off the lake — never re-derives it.",
  ],
};

export const ALL_CMAS: CMA[] = [CLASSIFIER, RECONCILIATION, DEEP_RESEARCHER];

// ───────── Animation helpers ─────────
export const fadeIn = (frame: number, start: number, dur = 24) =>
  interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const lift = (frame: number, start: number, dur = 24, dist = 12) =>
  interpolate(frame, [start, start + dur], [dist, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

// ───────── Atom: TimingPill ─────────
export const TimingPill: React.FC<{
  timing: CMATiming;
  enterFrame: number;
  frame: number;
}> = ({ timing, enterFrame, frame }) => {
  const o = fadeIn(frame, enterFrame, 18);
  const isSubmit = timing === "submit";
  const palette = isSubmit
    ? {
        bg: "rgba(16, 185, 129, 0.13)",
        border: "rgba(16, 185, 129, 0.45)",
        ink: "#a7f3d0",
        dot: tokens.emeraldBright,
      }
    : {
        bg: "rgba(176, 136, 255, 0.13)",
        border: "rgba(176, 136, 255, 0.45)",
        ink: "#d4bcff",
        dot: tokens.ribbon,
      };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 12px",
        borderRadius: 999,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.ink,
        fontFamily: fontStack,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        opacity: o,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: palette.dot,
        }}
      />
      {isSubmit ? "when you submit" : "when you ask"}
    </span>
  );
};

// ───────── Atom: SkillChip ─────────
export const SkillChip: React.FC<{
  label: string;
  enterFrame: number;
  frame: number;
}> = ({ label, enterFrame, frame }) => {
  const o = fadeIn(frame, enterFrame, 18);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 6,
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${tokens.hairline}`,
        color: tokens.inkDim,
        fontFamily: monoStack,
        fontSize: 12,
        fontWeight: 500,
        opacity: o,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
};

// ───────── Atom: Numbered glyph (01/02/03) ─────────
export const NumberGlyph: React.FC<{
  num: string;
  enterFrame: number;
  frame: number;
  size?: number;
}> = ({ num, enterFrame, frame, size = 14 }) => {
  const o = fadeIn(frame, enterFrame, 18);
  return (
    <span
      style={{
        fontFamily: monoStack,
        fontSize: size,
        fontWeight: 600,
        color: tokens.emeraldBright,
        letterSpacing: "0.08em",
        opacity: o,
      }}
    >
      {num}
    </span>
  );
};

// ───────── CMACard — the full agent card used by Triptych and SubmitAsk ─────────
export type CMACardProps = {
  cma: CMA;
  index: number; // 0/1/2 for "01"/"02"/"03"
  x: number;
  y: number;
  width: number;
  height?: number;
  enterFrame: number;
  frame: number;
  // Stagger inside the card. baseEnter=enterFrame; subsequent rows enter at
  // enterFrame + delta.
  rowStaggerFrames?: number;
};

export const CMACard: React.FC<CMACardProps> = ({
  cma,
  index,
  x,
  y,
  width,
  height,
  enterFrame,
  frame,
  rowStaggerFrames = 8,
}) => {
  const o = fadeIn(frame, enterFrame, 24);
  const ly = lift(frame, enterFrame, 24, 14);

  const numFrame = enterFrame + rowStaggerFrames * 0;
  const nameFrame = enterFrame + rowStaggerFrames * 1;
  const timingFrame = enterFrame + rowStaggerFrames * 2;
  const roleFrame = enterFrame + rowStaggerFrames * 3;
  const beatsBaseFrame = enterFrame + rowStaggerFrames * 4;
  const skillsBaseFrame = enterFrame + rowStaggerFrames * 5;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + ly,
        width,
        minHeight: height,
        background: tokens.surface,
        border: `1px solid ${tokens.hairline}`,
        borderRadius: 18,
        padding: "26px 28px",
        opacity: o,
        fontFamily: fontStack,
        color: tokens.ink,
        boxShadow: "0 18px 44px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <NumberGlyph
          num={String(index + 1).padStart(2, "0")}
          enterFrame={numFrame}
          frame={frame}
        />
        <span
          style={{
            fontFamily: monoStack,
            fontSize: 12,
            color: tokens.inkFaint,
          }}
        >
          {cma.model}
        </span>
      </div>

      <div
        style={{
          fontSize: 36,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          opacity: fadeIn(frame, nameFrame, 22),
          transform: `translateY(${lift(frame, nameFrame, 22, 8)}px)`,
        }}
      >
        {cma.name}
      </div>

      <div>
        <TimingPill
          timing={cma.timing}
          enterFrame={timingFrame}
          frame={frame}
        />
      </div>

      <div
        style={{
          fontSize: 22,
          color: tokens.ink,
          lineHeight: 1.35,
          fontWeight: 500,
          opacity: fadeIn(frame, roleFrame, 22),
          transform: `translateY(${lift(frame, roleFrame, 22, 8)}px)`,
        }}
      >
        {cma.role}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginTop: 4,
        }}
      >
        {cma.beats.map((b, i) => (
          <div
            key={b}
            style={{
              fontSize: 16,
              color: tokens.inkDim,
              lineHeight: 1.45,
              opacity: fadeIn(frame, beatsBaseFrame + i * 6, 18),
              transform: `translateY(${lift(frame, beatsBaseFrame + i * 6, 18, 6)}px)`,
              paddingLeft: 12,
              borderLeft: `2px solid ${tokens.hairlineStrong}`,
            }}
          >
            {b}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginTop: "auto",
          paddingTop: 8,
        }}
      >
        {cma.skills.map((s, i) => (
          <SkillChip
            key={s}
            label={`skill · ${s}`}
            enterFrame={skillsBaseFrame + i * 6}
            frame={frame}
          />
        ))}
      </div>
    </div>
  );
};
