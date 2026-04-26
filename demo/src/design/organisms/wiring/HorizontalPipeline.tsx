import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { tokens } from "../../../tokens";
import {
  WireArrow,
  WireCard,
  WireChip,
  WireGrid,
  WireLaneLabel,
  WireMemoryCylinder,
  WireNode,
  WireRibbon,
} from "./shared";

const W = 1920;
const H = 1080;

// Layout grid — 3 lanes, 2 gutters, 80px side margins.
//   Lane A (Classifier):       x=80..580
//   Gutter 1:                  x=580..710
//   Lane B (Reconciliation):   x=710..1210
//   Gutter 2:                  x=1210..1340
//   Lane C (Deep Researcher):  x=1340..1840
//
// Vertical bands:
//   Kicker row:        y=70..100
//   Input row:         y=130..360
//   Node row:          y=420..530  (h=110)
//   Skill chip row:    y=555..587
//   Output row:        y=625..865
//   Ribbon row:        y=910..950
//
// Every primitive below is placed inside its band — no item overflows
// vertically into another band's window, and nothing crosses lane edges
// except the inter-lane arrows (which sit at y=475 on the node row).

// Lane geometry
const LANE_A_X = 80;
const LANE_B_X = 710;
const LANE_C_X = 1340;
const LANE_W = 500;

const NODE_Y = 420;
const NODE_H = 110;
const NODE_MID_Y = NODE_Y + NODE_H / 2;

export const WiringHorizontalPipeline: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: tokens.bg }}>
      <WireGrid frame={frame} width={W} height={H} />

      {/* ─── Kicker labels ─── */}
      <WireLaneLabel
        x={LANE_A_X}
        y={70}
        width={LANE_W}
        text="Capture"
        enterFrame={6}
        frame={frame}
      />
      <WireLaneLabel
        x={LANE_B_X}
        y={70}
        width={LANE_W}
        text="Reconcile"
        enterFrame={10}
        frame={frame}
      />
      <WireLaneLabel
        x={LANE_C_X}
        y={70}
        width={LANE_W}
        text="Personalise"
        enterFrame={14}
        frame={frame}
      />

      {/* ═══ LANE A — input row ═══ */}
      <WireChip
        x={LANE_A_X + 65}
        y={150}
        width={LANE_W - 130}
        label="JPG · 4032×3024"
        enterFrame={30}
        frame={frame}
        monospace
      />
      <WireChip
        x={LANE_A_X + 65}
        y={200}
        width={LANE_W - 130}
        label="heading 320° · NE"
        enterFrame={50}
        frame={frame}
        monospace
      />
      <WireChip
        x={LANE_A_X + 65}
        y={250}
        width={LANE_W - 130}
        label="48.18°N · 11.59°E"
        enterFrame={70}
        frame={frame}
        monospace
      />
      <WireArrow
        x1={LANE_A_X + LANE_W / 2}
        y1={290}
        x2={LANE_A_X + LANE_W / 2}
        y2={NODE_Y - 6}
        enterFrame={100}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={22}
        tone="emerald"
      />

      {/* ═══ LANE A — node + skill ═══ */}
      <WireNode
        x={LANE_A_X}
        y={NODE_Y}
        width={LANE_W}
        label="Classifier"
        sublabel="claude-opus-4-7"
        enterFrame={130}
        frame={frame}
      />
      <WireChip
        x={LANE_A_X + 65}
        y={555}
        width={LANE_W - 130}
        label="skill · severe-weather-reporting"
        enterFrame={170}
        frame={frame}
        tone="emerald"
      />

      {/* ═══ LANE A → LANE B arrow ═══ */}
      <WireArrow
        x1={LANE_A_X + LANE_W + 6}
        y1={NODE_MID_Y}
        x2={LANE_B_X - 6}
        y2={NODE_MID_Y}
        enterFrame={220}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={36}
      />

      {/* ═══ LANE B — input row (4 evidence chips, fly in from right) ═══ */}
      <WireChip
        x={LANE_B_X + 50}
        y={150}
        width={LANE_W - 100}
        label="RADOLAN · radar mosaic"
        enterFrame={300}
        frame={frame}
        flyFromX={W + 80}
      />
      <WireChip
        x={LANE_B_X + 50}
        y={200}
        width={LANE_W - 100}
        label="MTG IR · 10.5 µm"
        enterFrame={325}
        frame={frame}
        flyFromX={W + 80}
      />
      <WireChip
        x={LANE_B_X + 50}
        y={250}
        width={LANE_W - 100}
        label="MTG LI · lightning"
        enterFrame={350}
        frame={frame}
        flyFromX={W + 80}
      />
      <WireChip
        x={LANE_B_X + 50}
        y={300}
        width={LANE_W - 100}
        label="Open-Meteo · ground obs"
        enterFrame={375}
        frame={frame}
        flyFromX={W + 80}
      />
      {/* Converging arrows from each chip bottom → node top, slight fan. */}
      <WireArrow
        x1={LANE_B_X + LANE_W / 2}
        y1={186}
        x2={LANE_B_X + 130}
        y2={NODE_Y - 6}
        enterFrame={330}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={24}
        strokeWidth={1.5}
      />
      <WireArrow
        x1={LANE_B_X + LANE_W / 2}
        y1={236}
        x2={LANE_B_X + 250}
        y2={NODE_Y - 6}
        enterFrame={355}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={24}
        strokeWidth={1.5}
      />
      <WireArrow
        x1={LANE_B_X + LANE_W / 2}
        y1={286}
        x2={LANE_B_X + 370}
        y2={NODE_Y - 6}
        enterFrame={380}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={24}
        strokeWidth={1.5}
      />
      <WireArrow
        x1={LANE_B_X + LANE_W / 2}
        y1={336}
        x2={LANE_B_X + 410}
        y2={NODE_Y - 6}
        enterFrame={405}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={24}
        strokeWidth={1.5}
      />

      {/* ═══ LANE B — node + skill ═══ */}
      <WireNode
        x={LANE_B_X}
        y={NODE_Y}
        width={LANE_W}
        label="Reconciliation"
        sublabel="claude-opus-4-7"
        enterFrame={250}
        frame={frame}
      />
      <WireChip
        x={LANE_B_X + 65}
        y={555}
        width={LANE_W - 130}
        label="skill · radar-reconciliation"
        enterFrame={290}
        frame={frame}
        tone="emerald"
      />

      {/* ═══ LANE B — output row ═══ */}
      <WireCard
        x={LANE_B_X}
        y={625}
        width={LANE_W - 110}
        height={210}
        enterFrame={450}
        frame={frame}
        title="Verified report"
        body="Photo classification overlaps RADOLAN return inside the cone. Confidence 0.86."
        chips={["radar match", "MTG concur", "fresh"]}
      />
      <WireMemoryCylinder
        x={LANE_B_X + LANE_W - 100}
        y={645}
        width={90}
        height={140}
        label="per location"
        enterFrame={500}
        fillStart={540}
        frame={frame}
      />

      {/* ═══ LANE B → LANE C arrow ═══ */}
      <WireArrow
        x1={LANE_B_X + LANE_W + 6}
        y1={NODE_MID_Y}
        x2={LANE_C_X - 6}
        y2={NODE_MID_Y}
        enterFrame={620}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={36}
      />

      {/* ═══ LANE C — input row (user context) ═══ */}
      <WireChip
        x={LANE_C_X + 65}
        y={200}
        width={LANE_W - 130}
        label="user · Daniel · Munich"
        enterFrame={680}
        frame={frame}
        tone="ribbon"
      />
      <WireChip
        x={LANE_C_X + 65}
        y={250}
        width={LANE_W - 130}
        label="goal · 6h trip preview"
        enterFrame={705}
        frame={frame}
        tone="ribbon"
      />
      <WireArrow
        x1={LANE_C_X + LANE_W / 2}
        y1={290}
        x2={LANE_C_X + LANE_W / 2}
        y2={NODE_Y - 6}
        enterFrame={730}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={22}
        tone="ribbon"
      />

      {/* ═══ LANE C — node + skills ═══ */}
      <WireNode
        x={LANE_C_X}
        y={NODE_Y}
        width={LANE_W}
        label="Deep Researcher"
        sublabel="claude-opus-4-7"
        enterFrame={680}
        frame={frame}
      />
      <WireChip
        x={LANE_C_X + 65}
        y={555}
        width={140}
        label="SWR"
        enterFrame={720}
        frame={frame}
        tone="emerald"
      />
      <WireChip
        x={LANE_C_X + 215}
        y={555}
        width={140}
        label="RSR"
        enterFrame={735}
        frame={frame}
        tone="emerald"
      />
      <WireChip
        x={LANE_C_X + 365}
        y={555}
        width={70}
        label="PRS"
        enterFrame={750}
        frame={frame}
        tone="emerald"
      />

      {/* ═══ LANE C — output row ═══ */}
      <WireCard
        x={LANE_C_X}
        y={625}
        width={LANE_W - 110}
        height={210}
        enterFrame={790}
        frame={frame}
        title="Answer"
        body="South route is clear for 2 h. A line moves in from the west around 16:30 — head back over the Heiliger Berg before then."
        chips={["sources cited", "no hallucination", "fresh", "scoped"]}
      />
      <WireMemoryCylinder
        x={LANE_C_X + LANE_W - 100}
        y={645}
        width={90}
        height={140}
        label="per user"
        enterFrame={840}
        fillStart={880}
        frame={frame}
      />

      {/* ═══ Ribbon footer (centered) ═══ */}
      <WireRibbon
        x={760}
        y={910}
        width={400}
        enterFrame={920}
        frame={frame}
        label="Memory · persists across sessions"
      />
    </AbsoluteFill>
  );
};
