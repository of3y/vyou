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

// Hub-and-spoke topology — Reconciliation in the centre, evidence streams
// arriving from the four corners. Photo flows in from the left through the
// Classifier; verdict flows out to the right through Deep Researcher.
//
// Bounding boxes (no overlap):
//   Kicker:                      x=760..1160, y=50..70
//   TL evidence  (RADOLAN):      x=460..680,  y=160..196
//   TR evidence  (MTG IR):       x=1180..1400, y=160..196
//   BL evidence  (MTG LI):       x=460..680,  y=720..756
//   BR evidence  (Open-Meteo):   x=1180..1400, y=720..756
//   Photo card:                  x=80..360,   y=480..600
//   Classifier:                  x=420..680,  y=480..600
//   Reconciliation hub:          x=760..1100, y=450..630
//   Verified inline chip:        x=1110..1230, y=524..556
//   Deep Researcher:             x=1260..1520, y=480..600
//   Answer card:                 x=1560..1840, y=440..680
//   per-location cylinder:       x=80..170,   y=720..880
//   per-user cylinder:           x=1670..1760, y=720..880

export const WiringHubSpoke: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: tokens.bg }}>
      <WireGrid frame={frame} width={W} height={H} />

      {/* Kicker */}
      <WireLaneLabel
        x={760}
        y={50}
        width={400}
        text="Hub-and-spoke topology"
        enterFrame={6}
        frame={frame}
      />

      {/* ═══ Evidence spokes (corners) ═══ */}
      <WireChip
        x={460}
        y={160}
        width={220}
        label="RADOLAN · radar"
        enterFrame={50}
        frame={frame}
      />
      <WireChip
        x={1180}
        y={160}
        width={220}
        label="MTG IR · 10.5 µm"
        enterFrame={70}
        frame={frame}
      />
      <WireChip
        x={460}
        y={720}
        width={220}
        label="MTG LI · lightning"
        enterFrame={90}
        frame={frame}
      />
      <WireChip
        x={1180}
        y={720}
        width={220}
        label="Open-Meteo · ground"
        enterFrame={110}
        frame={frame}
      />

      {/* ═══ Left flow: Photo → Classifier → Hub ═══ */}
      <WireCard
        x={80}
        y={480}
        width={280}
        height={120}
        enterFrame={150}
        frame={frame}
        title="Capture"
        body="JPG · heading 320° NE · 48.18°N 11.59°E"
      />
      <WireArrow
        x1={360}
        y1={540}
        x2={414}
        y2={540}
        enterFrame={210}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={20}
      />
      <WireNode
        x={420}
        y={480}
        width={260}
        height={120}
        label="Classifier"
        sublabel="opus-4-7"
        enterFrame={240}
        frame={frame}
      />
      <WireArrow
        x1={680}
        y1={540}
        x2={754}
        y2={540}
        enterFrame={310}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={22}
      />

      {/* ═══ Hub ═══ */}
      <WireNode
        x={760}
        y={450}
        width={340}
        height={180}
        label="Reconciliation"
        sublabel="opus-4-7 · radar-reconciliation"
        enterFrame={340}
        frame={frame}
      />

      {/* Spoke arrows (each evidence chip → nearest hub corner) */}
      <WireArrow
        x1={680}
        y1={196}
        x2={820}
        y2={450}
        enterFrame={400}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={26}
        strokeWidth={1.5}
      />
      <WireArrow
        x1={1180}
        y1={196}
        x2={1040}
        y2={450}
        enterFrame={420}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={26}
        strokeWidth={1.5}
      />
      <WireArrow
        x1={680}
        y1={720}
        x2={820}
        y2={630}
        enterFrame={440}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={26}
        strokeWidth={1.5}
      />
      <WireArrow
        x1={1180}
        y1={720}
        x2={1040}
        y2={630}
        enterFrame={460}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={26}
        strokeWidth={1.5}
      />

      {/* ═══ Right flow: Hub → Verified → DR → Answer ═══ */}
      <WireChip
        x={1110}
        y={524}
        width={120}
        label="verified · 0.86"
        enterFrame={500}
        frame={frame}
        tone="emerald"
      />
      <WireArrow
        x1={1100}
        y1={540}
        x2={1108}
        y2={540}
        enterFrame={490}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={6}
      />
      <WireArrow
        x1={1230}
        y1={540}
        x2={1254}
        y2={540}
        enterFrame={530}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={10}
      />
      <WireNode
        x={1260}
        y={480}
        width={260}
        height={120}
        label="Deep Researcher"
        sublabel="opus-4-7 · SWR · RSR · PRS"
        enterFrame={550}
        frame={frame}
      />
      <WireArrow
        x1={1520}
        y1={540}
        x2={1554}
        y2={540}
        enterFrame={620}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={14}
      />
      <WireCard
        x={1560}
        y={440}
        width={280}
        height={240}
        enterFrame={650}
        frame={frame}
        title="Answer"
        body="South route is clear for 2 h. A line moves in around 16:30 — head back over the Heiliger Berg before then."
        chips={["sources cited", "fresh", "scoped"]}
      />

      {/* ═══ Memory cylinders (bottom corners, ribbon-toned arrows in) ═══ */}
      <WireMemoryCylinder
        x={80}
        y={720}
        width={110}
        height={140}
        label="Memory · per location"
        enterFrame={720}
        fillStart={760}
        frame={frame}
      />
      <WireArrow
        x1={190}
        y1={790}
        x2={754}
        y2={610}
        enterFrame={780}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={36}
        tone="ribbon"
        strokeWidth={1.5}
      />
      <WireMemoryCylinder
        x={1670}
        y={720}
        width={110}
        height={140}
        label="Memory · per user"
        enterFrame={830}
        fillStart={870}
        frame={frame}
      />
      <WireArrow
        x1={1670}
        y1={790}
        x2={1390}
        y2={606}
        enterFrame={890}
        frame={frame}
        canvasWidth={W}
        canvasHeight={H}
        duration={36}
        tone="ribbon"
        strokeWidth={1.5}
      />
    </AbsoluteFill>
  );
};
