---
name: radar-and-satellite-reference
description: Use this skill whenever the agent needs to read, cite, or reason about DWD RADOLAN radar composites, EUMETSAT MTG satellite products, or their combination as weather-context evidence for a community-submitted photo. Triggers include translating raw radar reflectivity into a storm-attribute reading for a view-cone, picking the right MTG FCI channel for a cloud-top or convective diagnosis, checking whether a photographed phenomenon is consistent with the radar/satellite signal at that timestamp and location, composing a cited brief that grounds a community report in official weather layers, or naming the uncertainty bounds on either instrument. Provides RADOLAN reflectivity interpretation, storm-attribute derivation rubrics, the MTG FCI user-facing channel shortlist (0.6 natural colour, 3.8, 6.3, 7.3, 10.5, plus selected RGB composites), MTG LI product framing, and the per-instrument uncertainty framing every downstream agent must honor. Do NOT use for on-the-ground photographic phenomenon identification or feature-extraction — those live in the severe-weather-reporting skill.
license: MIT — see LICENSE.txt
---

# radar-and-satellite-reference

Reference knowledge for translating raw DWD RADOLAN radar composites and EUMETSAT MTG satellite products into statements VYou's agents can reason over. The skill names the channels / products the agents use by default, the per-channel diagnostic framing, and the uncertainty bounds each instrument carries.

Cited by: **Radar** (Messages API with cached skill prefix — deterministic HTTP + latency-sensitive, no session state), **Reconciliation** (CMA, per-location memory attached), and **Deep Researcher** (CMA, per-user + per-location memory attached). The same skill serves both surfaces because the reference content is the same regardless of how the calling agent consumes it.

## Overview

VYou's verified-report loop combines a community photo with two official weather-evidence layers: DWD RADOLAN radar (the ground-truth precipitation signal) and EUMETSAT MTG satellite (the cloud-top and lightning signal). This skill is the shared vocabulary those two evidence layers carry into the Reconciliation narrative and the Deep Researcher evidence brief.

## Status — stub

This skill's body is intentionally thin right now. The full reference content lands when the Reconciliation agent is built (Day 4), because the diagnostic framing is tuned to what Reconciliation actually needs to cite. Today the skill carries:

- Pointer to the authoritative MTG wedge brief at [docs/mtg-satellite-wedge-brief.md](../../docs/mtg-satellite-wedge-brief.md) for FCI channel guide and LI framing.
- Pointer to the EUMETView WMS endpoint reference at [docs/01 Active Research/eumetview-wms-endpoint-reference.md](../../docs/01%20Active%20Research/eumetview-wms-endpoint-reference.md) for the working-integration layer names and time-dimension semantics.
- Pointer to [docs/architecture.md](../../docs/architecture.md) §Data layers for the current per-instrument commitment (MTG FCI HRFI IR10.5 µm + MTG LI Accumulated Flash Area + DWD RADOLAN).

When Reconciliation lands, `references/radolan.md` and `references/mtg.md` fill in with per-product interpretation rubrics.

## Out of scope for this skill

- Photographic phenomenon identification (cloud morphology, hail, tornado geometry, etc.) — see the `severe-weather-reporting` skill.
- Adjacent-platform comparison (Windy, Spotter Network, mPING) — see the `prior-art-scan` skill.
