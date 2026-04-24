# Per-phenomenon diagnostic features

The `features` array in a Classifier record is a 3–7-entry list of brief, verifiable visual phrases. Every entry must be something a human reviewer can point at in the pixels — if a rubric says a phenomenon "usually" has feature X but X is not in THIS frame, do not record it.

This file is the vocabulary the validation corpus is labeled against (`eval/dataset-manifest.csv` `features_gold` column, per `docs/02 MVPs/validation-corpus-curation.md`). Feature flags are kebab-case, semicolon-separated in the corpus; free-form short phrases in agent output. Prefer exact flags from the lists below where applicable — the eval harness scores per-feature precision and recall over these flags.

## How to populate the `features` array

1. **Scan the frame for diagnostic features** from the list for the chosen phenomenon. Record what you see, in the order you notice it.
2. **Add cross-family features** that matter for reconciliation even if they are not in the chosen phenomenon's list — e.g. a `thunderstorm` frame with clearly visible mammatus records the mammatus texture as a feature, not as a second phenomenon.
3. **Record contextual features** that help the downstream reconciliation agent judge consistency with radar/satellite: horizon state, surface wetness, lighting conditions, foreground cues that anchor scale or location.
4. **Aim for 3–7 entries.** Fewer than 3 usually means the frame is low-richness (see `rubrics.md`); more than 7 means you are narrating rather than diagnosing.

## Feature vocabularies

### clear_sky

- `no-significant-cloud-cover`
- `high-cirrus-wisps` (thin cirrus that does not disqualify the label)
- `isolated-contrails`
- `blue-sky-dominant`
- `horizon-sharp`

### partly_cloudy

- `scattered-cumulus`
- `stratocumulus-fields`
- `well-defined-cloud-bases`
- `cauliflower-tops` (distinct cumulus towers)
- `blue-sky-between-clouds`
- `no-precipitation-visible`

### overcast

- `solid-cloud-deck`
- `uniform-grey-sky`
- `no-base-detail`
- `diffuse-lighting`
- `horizon-visible` (distinguishes from fog)
- `no-precipitation-visible`

### rain

- `visible-rain-shaft`
- `wind-driven-streaks`
- `wet-pavement`
- `low-contrast-horizon`
- `dark-grey-cloud-base`
- `water-on-foreground-surfaces`
- `raindrops-on-lens` (artifact feature worth recording)

### snow

- `actively-falling-snow`
- `fresh-snow-accumulation`
- `snow-on-foreground-surfaces`
- `low-visibility-from-snowfall`
- `overcast-sky-with-snow`

### fog

- `horizon-lost`
- `background-softened`
- `reduced-visibility-from-suspended-droplets`
- `silhouetted-foreground-objects`
- `uniform-grey-atmosphere`

### thunderstorm

- `cumulonimbus-structure`
- `visible-anvil`
- `anvil-spreading`
- `strong-vertical-development`
- `heavy-precipitation-shaft`
- `dark-cloud-base`
- `overshooting-top` (dome above the anvil, signals a particularly strong updraft)

### hail

- `hailstones-visible`
- `hail-on-surface`
- `hail-in-air`
- `hail-accumulation-on-grass`
- `individual-stones-resolved`
- `scale-reference-visible` (required if `hail_size_cm` is populated — see `rubrics.md`)
- `wet-ground-with-ice`

### lightning

- `cloud-to-ground-lightning`
- `cloud-to-cloud-lightning`
- `resolved-lightning-channel`
- `frame-illuminated-by-strike`
- `dark-background-sky` (night or near-storm darkness that makes the bolt visible)
- `storm-cloud-adjacent`

### wall_cloud

- `wall-cloud-geometry`
- `persistent-lowering`
- `cloud-base-below-surrounding`
- `rotation-cues-if-visible`
- `tilted-lowering` (shear-consistent lean)
- `dark-cloud-base-above`
- `rain-free-base` (a rain-free lowering is a stronger wall-cloud signal than a rain-wrapped one)

### shelf_cloud

- `wedge-shaped-leading-edge`
- `horizontal-cloud-bands`
- `leading-edge-advancing`
- `layered-base`
- `gust-front-dust-ahead` (surface dust kicked up ahead of the shelf)
- `sharp-horizontal-boundary`

### mammatus

- `mammatus-texture`
- `pouch-like-protrusions`
- `repeating-pouch-pattern`
- `anvil-underside` (mammatus most commonly hangs from a cumulonimbus anvil)
- `twilight-backlighting` (often the lighting that makes the pattern legible)

### funnel_cloud

- `tapered-rotating-column`
- `column-aloft-only` (the ground-attachment distinguisher)
- `rotation-cues-visible`
- `cloud-base-lowering-above`
- `no-surface-debris` (if any debris is visible, it is `tornado`)

### tornado

- `rotating-column-to-ground`
- `surface-debris-visible`
- `ground-attachment`
- `debris-cloud-at-base`
- `dust-whirl-at-surface`
- `visible-condensation-funnel` (when the full funnel is cloudy all the way down)

## Cross-cutting contextual features

Useful across many phenomena for downstream reconciliation. Record when present and materially scene-shaping.

- `daylight` / `twilight` / `night`
- `urban-foreground` / `rural-foreground` / `wilderness-foreground`
- `water-body-visible` (lake, sea, river in foreground)
- `mountains-visible` / `flat-terrain`
- `camera-facing-sun` (lens flare, strong backlight)
- `obstructed-foreground` (window, screen, vehicle interior)
- `indoor-scene` — almost always paired with the `out_of_scope` record (see `rubrics.md`); documented here only because recording it explicitly helps the reviewer audit the out-of-scope decision.
