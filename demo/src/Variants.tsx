import { staticFile } from "remotion";
import { ConeIllustrative } from "./ConeIllustrative";
import { ConeReceipt } from "./ConeReceipt";

export const ConeIllustrativeParaglider: React.FC = () => (
  <ConeIllustrative
    photoUrl={staticFile("paraglider.jpg")}
    coneAngleDegrees={210}
  />
);

export const ConeIllustrativeRursee: React.FC = () => (
  <ConeIllustrative photoUrl={staticFile("sailor.jpg")} coneAngleDegrees={0} />
);

export const ConeIllustrativeAndechs: React.FC = () => (
  <ConeIllustrative photoUrl={staticFile("andechs.jpg")} coneAngleDegrees={90} />
);

const ANDECHS_PROSE =
  "The Andechs Doppelbock — dark, malty, the textbook beer the abbey is known for. Wear the long sleeve once the sun drops behind the Heiliger Berg.";

const TURKEY_PROSE =
  "There is a waterfall about eight kilometers up the valley you have not heard of. Worth the detour before lunch.";

export const ConeReceiptAndechs: React.FC = () => (
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
);

export const ConeReceiptTurkey: React.FC = () => (
  <ConeReceipt
    photoUrl={staticFile("turkey.jpg")}
    coneAngleDegrees={120}
    answerProse={TURKEY_PROSE}
    guardrailChips={["local lore", "no hallucination", "fresh data", "scoped"]}
  />
);
