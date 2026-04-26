import { AbsoluteFill, OffthreadVideo, interpolate, useCurrentFrame } from "remotion";

const FPS = 30;

// One keyframe = "at second `at` of this clip's playback, the camera should be
// zoomed to `scale` and looking at the point `focus` on the phone screen."
//
// scale: 1.0 = whole phone fits in the 1080-tall frame (letterboxed sides).
//        1.8 = roughly fills the frame width.
//        2.5+ = tight crop on a UI element.
//
// focus: [x, y] in 0–100 percent of the *phone screen* (not the viewport).
//        [50, 50] = dead center of the phone.
//        [50, 0]  = top of the phone (status bar).
//        [50, 100] = bottom of the phone (home indicator / submit button).
//        [0, 50]  = left edge.
//
// Remotion interpolates linearly between keyframes — so two keyframes
// 3 seconds apart create a smooth 3-second pan/zoom from one to the other.
//
// Example:
//   pans={[
//     { at: 0,  scale: 1.0, focus: [50, 50] },  // start: full phone
//     { at: 3,  scale: 1.6, focus: [50, 30] },  // 3s in: zoom on upper third
//     { at: 8,  scale: 2.2, focus: [50, 80] },  // 8s in: pan down to submit button
//     { at: 12, scale: 1.8, focus: [50, 50] },  // 12s in: pull back
//   ]}
//
// Tip: open `npx remotion preview` to scrub and live-tune values before re-rendering.
export type PhonePan = {
  at: number;            // seconds from start of clip playback
  scale: number;         // zoom factor; 1 = whole phone, 2 = 2x zoom in
  focus: [number, number]; // [xPct, yPct] — point on phone (0–100, 0–100)
};

// Rendered phone dimensions inside a 1920×1080 frame at scale=1, object-fit:contain.
// Phone source is 1180×2556, taller than the 16:9 frame, so height fits to 1080.
const RENDERED_W = (1180 / 2556) * 1080; // ~498.6
const RENDERED_H = 1080;

export const PhoneClip: React.FC<{
  src: string;
  startFrom?: number; // seconds into source video to begin playback
  pans: PhonePan[];
  background?: string;
}> = ({ src, startFrom = 0, pans, background = "#000" }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;

  const sortedPans = [...pans].sort((a, b) => a.at - b.at);
  const ats = sortedPans.map((p) => p.at);
  const scales = sortedPans.map((p) => p.scale);
  const fxs = sortedPans.map((p) => p.focus[0]);
  const fys = sortedPans.map((p) => p.focus[1]);

  const interpClamp = (vals: number[]) =>
    interpolate(t, ats, vals, {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  const scale = interpClamp(scales);
  const fx = interpClamp(fxs);
  const fy = interpClamp(fys);

  // Translate so that focus point on the phone lands at viewport center.
  const tx = (50 - fx) / 100 * RENDERED_W * scale;
  const ty = (50 - fy) / 100 * RENDERED_H * scale;

  return (
    <AbsoluteFill style={{ overflow: "hidden", background }}>
      <AbsoluteFill
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <OffthreadVideo
          src={src}
          startFrom={Math.round(startFrom * FPS)}
          muted
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
