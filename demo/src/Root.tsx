import { Composition } from "remotion";
import { Master, TOTAL_DURATION_FRAMES } from "./Composition";

export const Root = () => (
  <Composition
    id="Master"
    component={Master}
    durationInFrames={TOTAL_DURATION_FRAMES}
    fps={30}
    width={1920}
    height={1080}
  />
);
