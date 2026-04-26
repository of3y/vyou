import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { tokens, fontStack } from "./tokens";
import { WiringGraph } from "./WiringGraph";
import { ConeIllustrative } from "./ConeIllustrative";
import { ConeReceipt } from "./ConeReceipt";
import { PhoneClip } from "./PhoneClip";

const FPS = 30;
const s = (seconds: number) => Math.round(seconds * FPS);

const BEATS = {
  beat1: { from: s(0), durationInFrames: s(20) },
  beat2: { from: s(20), durationInFrames: s(35) },
  beat3: { from: s(55), durationInFrames: s(20) },
  beat4: { from: s(75), durationInFrames: s(25) },
  beat5: { from: s(100), durationInFrames: s(20) },
  beat6: { from: s(120), durationInFrames: s(32) },
  beat7: { from: s(152), durationInFrames: s(13) },
  beat8: { from: s(165), durationInFrames: s(15) },
} as const;

const TOTAL_FRAMES = s(180);

const Beat1ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, s(20)], [1.0, 1.18], {
    extrapolateRight: "clamp",
  });
  const fadeIn = interpolate(frame, [0, s(1.5)], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [s(18), s(20)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill
        style={{
          opacity: Math.min(fadeIn, fadeOut),
          transform: `scale(${zoom})`,
          transformOrigin: "center 45%",
        }}
      >
        <Img
          src={staticFile("blue-marble.jpg")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Beat2Transition: React.FC = () => {
  const frame = useCurrentFrame();
  const phoneEnd = s(15);
  const showPhone = frame < phoneEnd;
  // Beat 2 is 35s total. First 15s = the capture flow (phone-in-hand).
  // Remaining 20s = the wide-map view with multiple cones.
  // Edit the `pans` arrays below to direct the camera through each clip.
  return (
    <AbsoluteFill style={{ background: tokens.bg }}>
      {showPhone ? (
        <PhoneClip
          src={staticFile("zugspitze-add-cone.MP4")}
          startFrom={0}
          pans={[
            // 0–9s: map view with 3 golden cones around Garmisch.
            //   Cones cluster ~x=35, y=50. "Add Cone" button at bottom (~y=87).
            // ~10–12s: camera permission dialog (centered).
            // ~13–15s: live camera viewfinder — alpine sky + heading compass.
            { at: 0,  scale: 1.15, focus: [50, 50] }, // open on the whole phone, slight push-in
            { at: 3,  scale: 1.7,  focus: [38, 50] }, // zoom on the cone cluster
            { at: 6,  scale: 1.9,  focus: [38, 53] }, // tighter on the cones
            { at: 9,  scale: 1.6,  focus: [50, 80] }, // glide down to the "Add Cone" button
            { at: 11, scale: 1.5,  focus: [50, 50] }, // pull back as the camera dialog appears
            { at: 13, scale: 1.4,  focus: [50, 38] }, // settle on the live viewfinder
            { at: 15, scale: 1.5,  focus: [55, 28] }, // drift toward the heading compass
          ]}
        />
      ) : (
        <PhoneClip
          src={staticFile("bavaria-time-travel-cones.MP4")}
          startFrom={0}
          pans={[
            // 21.8s clip — we use ~20s. Shows Bavaria map with cones around
            // Munich, Salzburg, Innsbruck, and a dense fanned cone south of Munich
            // (~x=42, y=68). Time slider drawer at the bottom (y=82–95).
            { at: 0,  scale: 1.05, focus: [50, 50] }, // wide: all of Bavaria, cones scattered
            { at: 5,  scale: 1.5,  focus: [50, 55] }, // ease toward the Munich cluster
            { at: 10, scale: 2.0,  focus: [42, 66] }, // close on the dense fanned cone
            { at: 15, scale: 1.7,  focus: [55, 60] }, // drift across to the Salzburg side
            { at: 18, scale: 1.4,  focus: [50, 80] }, // pull back, hint the time slider
            { at: 20, scale: 1.4,  focus: [50, 80] },
          ]}
        />
      )}
    </AbsoluteFill>
  );
};

const Beat3PhotoCut: React.FC = () => {
  const frame = useCurrentFrame();
  const inIllustrative = frame >= s(10) && frame < s(13);
  return (
    <AbsoluteFill>
      <WiringGraph />
      {inIllustrative && (
        <AbsoluteFill style={{ background: "rgba(15,17,21,0.85)" }}>
          <ConeIllustrative
            photoUrl={staticFile("paraglider.jpg")}
            coneAngleDegrees={210}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

const Beat4ReconciliationCut: React.FC = () => {
  const frame = useCurrentFrame();
  const inIllustrative = frame >= s(15) && frame < s(18);
  const baseFrame = s(20);
  return (
    <AbsoluteFill>
      <Sequence from={-baseFrame}>
        <WiringGraph />
      </Sequence>
      {inIllustrative && (
        <AbsoluteFill style={{ background: "rgba(15,17,21,0.85)" }}>
          <ConeIllustrative
            photoUrl={staticFile("sailor.jpg")}
            coneAngleDegrees={0}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

const Beat5OrchestratorCut: React.FC = () => {
  const frame = useCurrentFrame();
  const inIllustrative = frame >= s(16) && frame < s(19);
  const baseFrame = s(45);
  return (
    <AbsoluteFill>
      <Sequence from={-baseFrame}>
        <WiringGraph />
      </Sequence>
      {inIllustrative && (
        <AbsoluteFill style={{ background: "rgba(15,17,21,0.85)" }}>
          <ConeIllustrative
            photoUrl={staticFile("andechs.jpg")}
            coneAngleDegrees={90}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

const Beat6Trade: React.FC = () => {
  const frame = useCurrentFrame();
  const second = frame >= s(16);
  const localFrame = second ? frame - s(16) : frame;
  const ANDECHS_PROSE =
    "The Andechs Doppelbock — dark, malty, the textbook beer the abbey is known for. Wear the long sleeve once the sun drops behind the Heiliger Berg.";
  const TURKEY_PROSE =
    "There is a waterfall about eight kilometers up the valley you have not heard of. Worth the detour before lunch.";
  return (
    <AbsoluteFill style={{ background: tokens.bg }}>
      <Sequence from={-localFrame}>
        {!second ? (
          <ConeReceipt
            photoUrl={staticFile("andechs.jpg")}
            coneAngleDegrees={200}
            answerProse={ANDECHS_PROSE}
            guardrailChips={[
              "place-grounded",
              "memory-cited",
              "fresh data",
              "confidence 0.86",
            ]}
          />
        ) : (
          <ConeReceipt
            photoUrl={staticFile("turkey.jpg")}
            coneAngleDegrees={120}
            answerProse={TURKEY_PROSE}
            guardrailChips={[
              "local lore",
              "no hallucination",
              "fresh data",
              "scoped",
            ]}
          />
        )}
      </Sequence>
    </AbsoluteFill>
  );
};

const Beat7Validation: React.FC<{
  metrics?: {
    precision: number;
    recall: number;
    f1: number;
    n: number;
  };
}> = ({ metrics }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, s(0.8)], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        background: tokens.bg,
        color: tokens.ink,
        fontFamily: fontStack,
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeIn,
      }}
    >
      <div
        style={{
          fontSize: 28,
          color: tokens.cone,
          fontWeight: 600,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        Classifier — supervised benchmark
      </div>
      {metrics ? (
        <div
          style={{
            display: "flex",
            gap: 80,
            marginTop: 50,
            fontSize: 96,
            fontWeight: 700,
            color: tokens.ink,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div>{metrics.precision.toFixed(2)}</div>
            <div style={{ fontSize: 22, color: tokens.mute, marginTop: 14 }}>
              precision
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div>{metrics.recall.toFixed(2)}</div>
            <div style={{ fontSize: 22, color: tokens.mute, marginTop: 14 }}>
              recall
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div>{metrics.f1.toFixed(2)}</div>
            <div style={{ fontSize: 22, color: tokens.mute, marginTop: 14 }}>
              F1
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div>n={metrics.n}</div>
            <div style={{ fontSize: 22, color: tokens.mute, marginTop: 14 }}>
              held-out cases
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            marginTop: 50,
            fontSize: 36,
            color: tokens.ink,
            maxWidth: 1100,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Held-out set, thresholds set in advance.
          <br />
          <span style={{ color: tokens.mute, fontSize: 26 }}>
            Eval transcripts in <code>eval/runs/</code>. Methodology cited.
          </span>
        </div>
      )}
      <div
        style={{
          marginTop: 60,
          fontSize: 22,
          color: tokens.mute,
          maxWidth: 900,
          textAlign: "center",
        }}
      >
        We do not claim it is perfect. We claim it is honest.
      </div>
    </AbsoluteFill>
  );
};

const Beat8Close: React.FC = () => {
  const frame = useCurrentFrame();
  const mapEnd = s(8);
  const titleStart = s(7);
  const showMap = frame < mapEnd;
  const titleOpacity = interpolate(
    frame,
    [titleStart, titleStart + s(1.5)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const lift = interpolate(frame, [titleStart, titleStart + s(1.5)], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: tokens.bg }}>
      {showMap && (
        <AbsoluteFill style={{ opacity: showMap ? 1 : 0 }}>
          <PhoneClip
            src={staticFile("bavaria-time-travel-cones.MP4")}
            startFrom={0}
            pans={[
              // Beat 8 close (~8s shown): slow ceremonial drift inward — the map composes them.
              { at: 0, scale: 1.2, focus: [50, 55] }, // open on the cone-filled map
              { at: 4, scale: 1.6, focus: [45, 60] }, // ease toward the Munich cluster
              { at: 8, scale: 1.9, focus: [42, 66] }, // settle on the densest fanned cone
            ]}
          />
        </AbsoluteFill>
      )}
      <AbsoluteFill
        style={{
          background: showMap
            ? "linear-gradient(180deg, rgba(10,16,40,0.0) 0%, rgba(10,16,40,0.85) 60%, rgba(10,16,40,1) 100%)"
            : "linear-gradient(180deg, #0a1028 0%, #1b2447 60%, #3a2a55 100%)",
          color: tokens.ink,
          fontFamily: fontStack,
          alignItems: "center",
          justifyContent: "center",
          opacity: titleOpacity,
        }}
      >
        <div
          style={{
            textAlign: "center",
            transform: `translateY(${lift}px)`,
          }}
        >
          <div
            style={{
              fontSize: 220,
              fontWeight: 800,
              letterSpacing: -8,
              color: "#f4f4f8",
            }}
          >
            VYU
          </div>
          <div
            style={{
              fontSize: 44,
              opacity: 0.85,
              marginTop: 18,
              color: "#f4f4f8",
            }}
          >
            What's in your view.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Master: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Audio src={staticFile("narration-final.wav")} />

      <Sequence from={BEATS.beat1.from} durationInFrames={BEATS.beat1.durationInFrames}>
        <Beat1ColdOpen />
      </Sequence>

      <Sequence from={BEATS.beat2.from} durationInFrames={BEATS.beat2.durationInFrames}>
        <Beat2Transition />
      </Sequence>

      <Sequence from={BEATS.beat3.from} durationInFrames={BEATS.beat3.durationInFrames}>
        <Beat3PhotoCut />
      </Sequence>

      <Sequence from={BEATS.beat4.from} durationInFrames={BEATS.beat4.durationInFrames}>
        <Beat4ReconciliationCut />
      </Sequence>

      <Sequence from={BEATS.beat5.from} durationInFrames={BEATS.beat5.durationInFrames}>
        <Beat5OrchestratorCut />
      </Sequence>

      <Sequence from={BEATS.beat6.from} durationInFrames={BEATS.beat6.durationInFrames}>
        <Beat6Trade />
      </Sequence>

      <Sequence from={BEATS.beat7.from} durationInFrames={BEATS.beat7.durationInFrames}>
        <Beat7Validation />
      </Sequence>

      <Sequence from={BEATS.beat8.from} durationInFrames={BEATS.beat8.durationInFrames}>
        <Beat8Close />
      </Sequence>
    </AbsoluteFill>
  );
};

export const TOTAL_DURATION_FRAMES = TOTAL_FRAMES;
