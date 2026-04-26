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
} from "./shared";

const W = 1920;
const H = 1080;

// Three columns:
//   Left   (memory cylinders):  x=200..420
//   Center (pipeline column):   x=660..1260   (w=600)
//   Right  (evidence chips):    x=1500..1810
//
// Center column vertical bands (height-conscious to fit 1080):
//   Kicker:              y=50..80
//   Photo card:          y=100..200
//   Arrow:               y=210..260
//   Classifier:          y=275..375
//   Arrow:               y=385..420
//   Reconciliation:      y=435..535
//   Arrow:               y=545..585
//   Verified report:     y=600..740
//   Arrow:               y=750..785
//   Deep Researcher:     y=800..900
//   Arrow:               y=910..945
//   Answer:              y=960..1060
//
// Memory cylinders sit in the left column at y matching their owning node:
//   per location: y=440..580 (next to Reconciliation)
//   per user:     y=805..945 (next to Deep Researcher)
// Evidence chips sit in the right column at y matching Reconciliation:
//   y=440..540 (4 chips × 22h)

const COL_X = 660;
const COL_W = 600;

export const WiringVerticalFlow: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: tokens.bg }}>
      <WireGrid frame={frame} width={W} height={H} />

      {/* Kicker */}
      <WireLaneLabel
        x={COL_X}
        y={55}
        width={COL_W}
        text="VYU agent topology — vertical"
        enterFrame={6}
        frame={frame}
      />

      {/* ═══ Photo card ═══ */}
      <WireCard
        x={COL_X}
        y={100}
        width={COL_W}
        height={100}
        enterFrame={20}
        frame={frame}
        title="Capture"
        body="JPG · 4032×3024 · heading 320° NE · 48.18°N 11.59°E"
      />
      <WireArrow
        x1={COL_X + COL_W / 2}
        y1={210}
        x2={COL_X + COL_W / 2}
        y2={269}
        enterFrame={70}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={20}
      />

      {/* ═══ Classifier ═══ */}
      <WireNode
        x={COL_X}
        y={275}
        width={COL_W}
        height={100}
        label="Classifier"
        sublabel="claude-opus-4-7 · skill: severe-weather-reporting"
        enterFrame={100}
        frame={frame}
      />
      <WireArrow
        x1={COL_X + COL_W / 2}
        y1={385}
        x2={COL_X + COL_W / 2}
        y2={429}
        enterFrame={170}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={18}
      />

      {/* ═══ Reconciliation ═══ */}
      <WireNode
        x={COL_X}
        y={435}
        width={COL_W}
        height={100}
        label="Reconciliation"
        sublabel="claude-opus-4-7 · skill: radar-reconciliation"
        enterFrame={210}
        frame={frame}
      />

      {/* Evidence chips on the right column, fly in from right edge */}
      <WireChip
        x={1500}
        y={440}
        width={310}
        height={22}
        label="RADOLAN · radar mosaic"
        enterFrame={260}
        frame={frame}
        flyFromX={W + 80}
      />
      <WireChip
        x={1500}
        y={468}
        width={310}
        height={22}
        label="MTG IR · 10.5 µm"
        enterFrame={285}
        frame={frame}
        flyFromX={W + 80}
      />
      <WireChip
        x={1500}
        y={496}
        width={310}
        height={22}
        label="MTG LI · lightning"
        enterFrame={310}
        frame={frame}
        flyFromX={W + 80}
      />
      <WireChip
        x={1500}
        y={524}
        width={310}
        height={22}
        label="Open-Meteo · ground obs"
        enterFrame={335}
        frame={frame}
        flyFromX={W + 80}
      />
      {/* converge from right column → Reconciliation right edge */}
      <WireArrow
        x1={1495}
        y1={451}
        x2={COL_X + COL_W + 6}
        y2={460}
        enterFrame={290}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={20}
        strokeWidth={1.5}
      />
      <WireArrow
        x1={1495}
        y1={479}
        x2={COL_X + COL_W + 6}
        y2={478}
        enterFrame={315}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={20}
        strokeWidth={1.5}
      />
      <WireArrow
        x1={1495}
        y1={507}
        x2={COL_X + COL_W + 6}
        y2={496}
        enterFrame={340}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={20}
        strokeWidth={1.5}
      />
      <WireArrow
        x1={1495}
        y1={535}
        x2={COL_X + COL_W + 6}
        y2={514}
        enterFrame={365}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={20}
        strokeWidth={1.5}
      />

      {/* per-location memory cylinder in left column, lined up with Reconciliation */}
      <WireMemoryCylinder
        x={285}
        y={440}
        width={110}
        height={140}
        label="Memory · per location"
        enterFrame={400}
        fillStart={440}
        frame={frame}
      />
      {/* small arrow from cylinder → Reconciliation left edge */}
      <WireArrow
        x1={395 + 6}
        y1={485}
        x2={COL_X - 6}
        y2={485}
        enterFrame={430}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={26}
        tone="ribbon"
        strokeWidth={1.5}
      />

      {/* arrow from Reconciliation → Verified report */}
      <WireArrow
        x1={COL_X + COL_W / 2}
        y1={545}
        x2={COL_X + COL_W / 2}
        y2={594}
        enterFrame={480}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={20}
      />

      {/* ═══ Verified report card ═══ */}
      <WireCard
        x={COL_X}
        y={600}
        width={COL_W}
        height={140}
        enterFrame={510}
        frame={frame}
        title="Verified report"
        body="Photo classification overlaps RADOLAN return inside the cone. Confidence 0.86."
        chips={["radar match", "MTG concur", "fresh"]}
      />
      <WireArrow
        x1={COL_X + COL_W / 2}
        y1={750}
        x2={COL_X + COL_W / 2}
        y2={794}
        enterFrame={580}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={18}
      />

      {/* ═══ Deep Researcher ═══ */}
      <WireNode
        x={COL_X}
        y={800}
        width={COL_W}
        height={100}
        label="Deep Researcher"
        sublabel="claude-opus-4-7 · skills: SWR · RSR · PRS"
        enterFrame={620}
        frame={frame}
      />

      {/* per-user memory cylinder lined up with DR */}
      <WireMemoryCylinder
        x={285}
        y={805}
        width={110}
        height={140}
        label="Memory · per user"
        enterFrame={660}
        fillStart={700}
        frame={frame}
      />
      <WireArrow
        x1={395 + 6}
        y1={850}
        x2={COL_X - 6}
        y2={850}
        enterFrame={700}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={26}
        tone="ribbon"
        strokeWidth={1.5}
      />

      {/* arrow → Answer */}
      <WireArrow
        x1={COL_X + COL_W / 2}
        y1={910}
        x2={COL_X + COL_W / 2}
        y2={954}
        enterFrame={760}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={18}
      />

      {/* ═══ Answer ═══ */}
      <WireCard
        x={COL_X}
        y={960}
        width={COL_W}
        height={100}
        enterFrame={800}
        frame={frame}
        title="Answer"
        body="South route is clear for 2 h. A line moves in around 16:30 — head back over the Heiliger Berg before then."
      />
    </AbsoluteFill>
  );
};
