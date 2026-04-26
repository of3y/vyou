// Canonical fixture data for VYU design components — mirrors the locations
// already used in Variants.tsx so the design slate and the demo stay aligned.

export type Verdict = "match" | "partial" | "mismatch";

export type ConeReport = {
  id: string;
  place: string;       // e.g. "Schwabing"
  facing: string;      // e.g. "facing NE"
  bearingDegrees: number;
  coneWidthDegrees: number;
  coords: { lat: number; lon: number };
  whenLabel: string;   // e.g. "2 min ago"
  chips: { label: string; verdict?: Verdict }[];
  verdict: Verdict;
  verdictLine: string;
};

export const SCHWABING: ConeReport = {
  id: "schwabing",
  place: "Schwabing",
  facing: "facing NE",
  bearingDegrees: 320,
  coneWidthDegrees: 60,
  coords: { lat: 48.18, lon: 11.59 },
  whenLabel: "2 min ago",
  chips: [
    { label: "light rain", verdict: "match" },
    { label: "overcast · low" },
    { label: "visibility ~4 km" },
  ],
  verdict: "match",
  verdictLine:
    "DWD reflectivity inside the cone footprint shows widespread light precipitation in the last 10 minutes — consistent with the photo's classification.",
};

export const ANDECHS: ConeReport = {
  id: "andechs",
  place: "Andechs",
  facing: "facing S",
  bearingDegrees: 200,
  coneWidthDegrees: 60,
  coords: { lat: 47.97, lon: 11.18 },
  whenLabel: "8 min ago",
  chips: [
    { label: "broken cumulus", verdict: "partial" },
    { label: "high base" },
    { label: "visibility >10 km" },
  ],
  verdict: "partial",
  verdictLine:
    "Radar shows scattered echoes drifting northeast — the photo's cumulus matches but the cone catches the edge of a clearing band.",
};

export const RURSEE: ConeReport = {
  id: "rursee",
  place: "Rursee",
  facing: "facing N",
  bearingDegrees: 0,
  coneWidthDegrees: 70,
  coords: { lat: 50.62, lon: 6.42 },
  whenLabel: "14 min ago",
  chips: [
    { label: "clear", verdict: "match" },
    { label: "thin cirrus" },
    { label: "visibility >20 km" },
  ],
  verdict: "match",
  verdictLine:
    "No radar returns inside the cone footprint — clear photo and clear scan agree.",
};

export const TURKEY: ConeReport = {
  id: "turkey",
  place: "Lycian Way",
  facing: "facing W",
  bearingDegrees: 270,
  coneWidthDegrees: 50,
  coords: { lat: 36.6, lon: 30.6 },
  whenLabel: "32 min ago",
  chips: [
    { label: "convective build", verdict: "mismatch" },
    { label: "ceiling dropping" },
    { label: "visibility ~6 km" },
  ],
  verdict: "mismatch",
  verdictLine:
    "Photo shows convective towers; radar in the cone footprint is flat. Either the cell is just outside reach or the classification is over-calling — flagged for review.",
};

export const ALL_REPORTS: ConeReport[] = [SCHWABING, ANDECHS, RURSEE, TURKEY];
