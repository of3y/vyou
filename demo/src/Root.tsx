import { Composition } from "remotion";
import { HelloVYou } from "./HelloVYou";

export const Root = () => (
  <Composition
    id="Composition"
    component={HelloVYou}
    durationInFrames={180}
    fps={30}
    width={1920}
    height={1080}
  />
);
