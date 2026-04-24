# Rubrics

The qualitative judgments every VYou agent uses to land a record: confidence level, hail-size estimation, feature-richness (eval-side), and the out-of-scope escape hatch.

## Confidence rubric — three levels, no numeric percentages

VYou agents emit `confidence` as one of `low` / `medium` / `high`. Numeric percentages are never used — they convey false precision and are not calibrated.

- **`high`** — Phenomenon and features are clearly visible, no significant ambiguity. A reviewer looking at the same frame would agree on the phenomenon and on most of the extracted features without hesitation.
- **`medium`** — Phenomenon is identifiable but some features are ambiguous, or the image is partially obscured (edge of frame, through-glass, partial lighting). The phenomenon judgment is defended; one or two features would survive reviewer scrutiny at most. **Default to `medium` unless evidence is strong in either direction.**
- **`low`** — Significant uncertainty. Very dark image, heavy obscuration, a single ambiguous feature, or a phenomenon that could plausibly be two labels (e.g. shelf cloud vs. wall cloud when the leading geometry is not clear). Low-confidence records still ship; the downstream Verification agent decides whether to route to human review.

Default-to-medium is the calibration discipline. Agents that reach for `high` on every frame over-fit; agents that reach for `low` on every frame under-fit. `medium` is the honest answer when evidence is mixed.

## Hail-size rubric — anchor objects and the two-condition gate

Populate `hail_size_cm` ONLY when BOTH conditions hold:

1. `phenomenon` is `hail`.
2. A scale reference is visible in the same frame — a coin, a hand, a ball, a known object with roughly knowable size (golf ball, tennis ball, baseball).

Otherwise `hail_size_cm` is `null`. Do not estimate from the precipitation rate, from the sound described in a caption, or from "typical hail size for this kind of storm" — only from visible scale.

Anchor-object reference diameters (rough, used only for scale-anchor reasoning):

- **Coin (€1, US quarter, UK £1)** — ~2.3 cm
- **Adult thumbnail** — ~1.5 cm
- **Golf ball** — ~4.3 cm
- **Tennis ball** — ~6.8 cm
- **Baseball** — ~7.4 cm
- **Softball** — ~9.7 cm

When an anchor is visible, estimate the hailstone's long axis in centimetres to the nearest 0.5 cm. Record `scale-reference-visible` as one of the `features` whenever a size is populated, and name the anchor object in the feature list (e.g. `coin-for-scale` or `hand-for-scale`).

Common failure modes to avoid:

- Anchor in foreground, hail in background — only estimate when the anchor and the stones are in roughly the same focal plane.
- Melted / merged hail that has lost its discrete stone geometry — do not estimate; stones must be individually resolved.
- Through-glass frames with distortion — confidence drops at least to `medium` and often to `low`.

## Feature-richness — eval-side, not a record field

`feature_richness` is a corpus-labeling field (`eval/dataset-manifest.csv`), not part of the agent's output record. It rates how unambiguously the class-defining features are present in the frame and drives the primary eval slice: high-richness precision and recall.

- **`high`** — Class-defining features are visible and unambiguous. A reviewer could audit every agent-extracted feature without hesitation. Target: ~60% of the corpus.
- **`medium`** — Phenomenon is identifiable; some features are unambiguous and some are inferable but not definitive. Target: ~30% of the corpus.
- **`low`** — Phenomenon is labeled for the gold record but features are sparse, partially obscured, or visually ambiguous. Low-richness rows are negative controls for the over-extraction / hallucination slice. Target: ~10% of the corpus.

Agents do not know the richness rating at inference time. The rubric is visible here so an agent operating in eval context understands why the high-vs-low gap is the load-bearing quality signal (see `docs/validation-plan.md` thresholds — `≥ 0.15` precision gap required).

## Out-of-scope escape hatch

If the submitted image is not a sky or outdoor weather scene — a plant, a person, an indoor photo, an animal, text or a screenshot, an unrelated object — do not force a weather label. Emit the out-of-scope record instead:

```json
{
  "phenomenon": "out_of_scope",
  "features": ["<one short phrase describing what is in the image>"],
  "hail_size_cm": null,
  "confidence": "high"
}
```

Rules:

- **Confidence on `out_of_scope` is almost always `high`.** "This is indoors" is a clearer judgment than most weather phenomenology. Use `medium` only when the frame is ambiguous (e.g. a partial sky visible through a window edge).
- **The `features` entry is one short phrase naming what the image actually depicts** — "indoor scene with houseplant and laptop", "person's face close-up", "screenshot of a text conversation". This phrase is what the moderation surface and the downstream reviewer read to understand the out-of-scope reason.
- **Ambiguous edge cases** — a window frame with sky visible outside, a dashboard-camera frame with some sky visible above road surface — record the weather phenomenon with `confidence: "low"` and a `obstructed-foreground` feature. `out_of_scope` is for images where no weather judgment is possible at all, not for weak-weather images.

The out-of-scope record is a first-class output, not an error. It lets the ingestion pipeline moderate non-weather submissions out of the map while preserving a recorded decision the user can audit.
