# Phenomenon taxonomy

VYou scores 14 phenomenon labels, grouped into four families by decision-relevance. When multiple phenomena are visible in one frame, pick the most decision-relevant label: severe convection outranks precipitation, precipitation outranks cloud morphology.

Plus one escape hatch: `out_of_scope` for images that are not sky or outdoor weather scenes. See `rubrics.md` for the out-of-scope shape.

## Cloud morphology

Base-rate sky states. Useful as negative controls and as context the downstream reconciliation agent uses to judge whether reported severe weather is plausible.

- **`clear_sky`** — No significant cloud cover. A thin cirrus veil or isolated contrail does not disqualify; a coherent mid-level or low-level deck does.
- **`partly_cloudy`** — Scattered cumulus or stratocumulus against visible blue, no precipitation. This is the default daytime-fair-weather label.
- **`overcast`** — Solid or near-solid cloud deck with no precipitation visible. Distinct from `fog` (overcast is elevated, fog obscures horizontal visibility).

## Non-severe precipitation and visibility

Precipitation or visibility-limiting hydrometeors, without the severe-convection features below.

- **`rain`** — Visible liquid precipitation. Strong signal is a resolved precipitation shaft or wind-driven streaks; weaker signal is wet pavement with a lead-grey sky. No lightning, no hail, no cumulonimbus structure.
- **`snow`** — Visible snowfall actively falling, or fresh accumulation that is the subject of the frame. A backdrop of old snow without active fall is cloud-morphology-only; record as `clear_sky` / `partly_cloudy` / `overcast` per the sky.
- **`fog`** — Significantly reduced horizontal visibility from suspended water droplets; horizon lost, background structures softened. Distinct from `overcast` (fog is at the surface, overcast is aloft) and from `rain` (fog is not precipitating, though the two can coexist — pick the more decision-relevant).

## Severe convection

The bread-and-butter of the VYou hero loop: decision-critical severe weather whose correct labeling is what makes the product matter.

- **`thunderstorm`** — Visible cumulonimbus with anvil, or an active convective cell producing heavy precipitation or visible lightning illumination. The anvil spread is the hero feature. If lightning is resolved in the frame, use `lightning` unless the cumulonimbus structure is the dominant subject.
- **`hail`** — Hailstones visible in the frame, on the ground, in air, or accumulated. Almost always paired with a `hail_size_cm` estimate when a scale reference is present (see `rubrics.md`). Distinct from `rain` — an ice-pellet ambiguity without resolved stones is not `hail`.
- **`lightning`** — Cloud-to-ground or cloud-to-cloud lightning bolt resolved in the frame, or a frame visibly illuminated by one (exposure long enough to capture the strike). Reject diffuse sky brightening without a resolved channel.

## Storm structures

Cloud morphology features diagnostic of severe convection — the labels where VYou adds real value beyond a general-purpose weather classifier. Correct identification of these is load-bearing for the demo.

- **`wall_cloud`** — A lowered, often rotating cloud base under a thunderstorm updraft. The diagnostic geometry is a persistent lowering that extends below the surrounding cloud base; rotation cues (visible shear, tilted lowering) strengthen confidence but are not required. Distinct from a mere lowered cumulus base in non-severe conditions.
- **`shelf_cloud`** — A wedge-shaped, often horizontally-banded low cloud at the leading edge of a thunderstorm outflow / gust front. The diagnostic geometry is a sharp horizontal leading edge advancing ahead of the parent cell with visible layering.
- **`mammatus`** — Pouch-like protrusions hanging from the underside of a cloud — most commonly the underside of a cumulonimbus anvil. The diagnostic feature is the repeating pouch texture; isolated smooth undulations are not mammatus.
- **`funnel_cloud`** — A visible rotating column of cloud that does NOT reach the ground or surface. Shape is tapered and rotating; if the column touches ground or surface debris is visible, it is `tornado` instead.
- **`tornado`** — A visible rotating column of cloud that IS connected to the ground, or whose ground connection is visually inferable from surface debris, dust whirls, or a visible circulation at the surface. The ground-connection criterion is what separates `tornado` from `funnel_cloud`.

## Label families at a glance

```
cloud morphology         : clear_sky, partly_cloudy, overcast
non-severe precipitation : rain, snow, fog
severe convection        : thunderstorm, hail, lightning
storm structures         : wall_cloud, shelf_cloud, mammatus, funnel_cloud, tornado
```

Plus `out_of_scope` — see `rubrics.md`.
