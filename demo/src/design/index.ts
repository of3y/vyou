// VYU design-system primitives for Remotion. All components are layout-agnostic
// (fill parent unless explicitly sized) and self-drive from useCurrentFrame.
// Wrap them in <Sequence> or <AbsoluteFill> to stage timing.

export { Pill } from "./atoms/Pill";
export type { PillProps, PillTone } from "./atoms/Pill";

export { WChip } from "./atoms/WChip";
export type { WChipProps, WChipVariant } from "./atoms/WChip";

export { FAB, PlusIcon, BellIcon, ClockIcon } from "./atoms/FAB";
export type { FABProps } from "./atoms/FAB";

export { Swatch } from "./atoms/Swatch";
export type { SwatchProps } from "./atoms/Swatch";

export { Hairline } from "./atoms/Hairline";
export type { HairlineProps } from "./atoms/Hairline";

export { BrandRow } from "./molecules/BrandRow";
export type { BrandRowProps } from "./molecules/BrandRow";

export { CTARow } from "./molecules/CTARow";
export type { CTARowProps } from "./molecules/CTARow";

export { SectionHead } from "./molecules/SectionHead";
export type { SectionHeadProps } from "./molecules/SectionHead";

export { LoopStep } from "./molecules/LoopStep";
export type { LoopStepProps } from "./molecules/LoopStep";

export { HeroArt, HeroArtDefault } from "./organisms/HeroArt";
export type { HeroArtProps } from "./organisms/HeroArt";

export { HeroOutro } from "./organisms/HeroOutro";

export { MapPreview } from "./organisms/MapPreview";
export type { MapPreviewProps } from "./organisms/MapPreview";

export { ReportDrawer } from "./organisms/ReportDrawer";
export type { ReportDrawerProps } from "./organisms/ReportDrawer";

export { LoopRow } from "./organisms/LoopRow";
export type { LoopRowProps } from "./organisms/LoopRow";

export {
  SCHWABING,
  ANDECHS,
  RURSEE,
  TURKEY,
  ALL_REPORTS,
} from "./fixtures";
export type { ConeReport, Verdict } from "./fixtures";

export {
  SPRING,
  SPRING_FIRM,
  enterSpring,
  pulseLoop,
  pressScale,
  coneSweep,
} from "./motion";
