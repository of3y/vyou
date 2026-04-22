import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export const HelloVYou = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30, 150, 180], [0, 1, 1, 0]);
  const lift = interpolate(frame, [0, 60], [20, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0a1028 0%, #1b2447 60%, #3a2a55 100%)",
        color: "#f4f4f8",
        fontFamily: "system-ui, -apple-system, sans-serif",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ textAlign: "center", opacity, transform: `translateY(${lift}px)` }}>
        <div style={{ fontSize: 200, fontWeight: 800, letterSpacing: -6 }}>VYou</div>
        <div style={{ fontSize: 42, opacity: 0.75, marginTop: 12 }}>
          See the weather through someone else's view.
        </div>
        <div style={{ fontSize: 22, opacity: 0.5, marginTop: 40 }}>
          Hello-world render — replaced through the week.
        </div>
      </div>
    </AbsoluteFill>
  );
};
