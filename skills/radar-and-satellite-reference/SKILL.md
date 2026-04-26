---
name: radar-and-satellite-reference
description: Use this skill whenever the agent needs to read, cite, or reason about DWD RADOLAN radar composites, EUMETSAT MTG satellite products, Open-Meteo current+forecast surface state, or their combination as weather-context evidence for a community-submitted photo. Triggers include translating raw radar reflectivity into a storm-attribute reading for a view-cone, picking the right MTG FCI channel for a cloud-top or convective diagnosis, naming MTG Lightning Imager Accumulated Flash Area context, reading the Open-Meteo `current` field set (temperature_2m, dew_point_2m, apparent_temperature, cloud_cover_low/mid/high, precipitation_probability, wind_gusts_10m, uv_index, etc.), checking whether a photographed phenomenon is consistent with the radar/satellite signal at that timestamp, or naming uncertainty bounds on any instrument. Provides RADOLAN reflectivity interpretation, storm-attribute derivation, the MTG FCI user-facing channel shortlist (0.6, 3.8, 6.3, 7.3, 10.5 plus selected RGB composites), MTG LI product framing, the Open-Meteo evidence vocabulary, and per-instrument uncertainty framing. Do NOT use for on-the-ground phenomenon identification — that lives in the severe-weather-reporting skill.
license: MIT — see LICENSE.txt
---

# radar-and-satellite-reference

Reference knowledge for translating raw DWD RADOLAN radar composites and EUMETSAT MTG satellite products into statements VYU's agents can reason over. The skill names the channels / products the agents use by default, the per-channel diagnostic framing, and the uncertainty bounds each instrument carries.

Cited by: **Radar** (Messages API with cached skill prefix — deterministic HTTP + latency-sensitive, no session state), **Reconciliation** (CMA, per-location memory attached), and **Deep Researcher** (CMA, per-user + per-location memory attached). The same skill serves both surfaces because the reference content is the same regardless of how the calling agent consumes it.

## Overview

VYU's verified-report loop combines a community photo with two official weather-evidence layers: DWD RADOLAN radar (the ground-truth precipitation signal) and EUMETSAT MTG satellite (the cloud-top and lightning signal). This skill is the shared vocabulary those two evidence layers carry into the Reconciliation narrative and the Deep Researcher evidence brief.

## Evidence vocabulary (Reconciliation + Deep Researcher prompts)

The Edge Functions thread three external feeds into the Reconciliation prompt and the `/research` Deep Researcher prompt. Cite them by these names; do not invent synonyms.

- **DWD RADOLAN frame** — the `dwd:Niederschlagsradar` WMS layer, 1 km / 5 min, blended observation + nowcast. Refer to it as "the DWD RADOLAN frame" when grounding a precipitation claim. Frame timestamp is the report's `captured_at` floored to a 5-minute slot.
- **MTG FCI IR 10.5 µm** — the `mtg_fd:ir105_hrfi` WMS layer (full-disc HRFI infrared, 10-minute cadence). Use it for cloud-top temperature framing — colder pixels indicate higher (often convective) cloud tops. Refer to it as "MTG FCI IR 10.5 µm" or "the MTG FCI IR 10.5 µm tile".
- **MTG Lightning Imager Accumulated Flash Area** — the `mtg_fd:li_afa` WMS layer (5-minute slots). Use it for total-lightning context. Refer to it as "MTG Lightning Imager Accumulated Flash Area" or "the LI AFA tile". Absence of flashes in the tile is consistent with non-electrified convection or no convection.
- **Open-Meteo `current`** — anonymous Open-Meteo `forecast` API at the report's lat-lon. The fields the Edge Function sends are: `temperature_2m`, `relative_humidity_2m`, `dew_point_2m`, `apparent_temperature`, `precipitation`, `precipitation_probability`, `cloud_cover`, `cloud_cover_low`, `cloud_cover_mid`, `cloud_cover_high`, `wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m`, `uv_index`. Use these to ground state-of-the-air claims (e.g. *"dew point is on the dry-cool side"*). Always cite the field name (`dew_point_2m`, not "dew point") in the citations array; user-facing prose uses plain English.

When a feed is absent, the prompt body carries a `feed unavailable` line with the error. Treat the absent feed as a soft signal — degrade to "inconclusive" if the missing feed is the only evidence that would have supported the verdict.

## Status — stub

This skill's body is intentionally thin right now. The full reference content lands when the Reconciliation agent is built (Day 4), because the diagnostic framing is tuned to what Reconciliation actually needs to cite. Today the skill carries:

- Pointer to the authoritative MTG wedge brief at [docs/mtg-satellite-wedge-brief.md](../../docs/mtg-satellite-wedge-brief.md) for FCI channel guide and LI framing.
- Pointer to the EUMETView WMS endpoint reference at [docs/01 Active Research/eumetview-wms-endpoint-reference.md](../../docs/01%20Active%20Research/eumetview-wms-endpoint-reference.md) for the working-integration layer names and time-dimension semantics.
- Pointer to [docs/architecture.md](../../docs/architecture.md) §Data layers for the current per-instrument commitment (MTG FCI HRFI IR10.5 µm + MTG LI Accumulated Flash Area + DWD RADOLAN).

When Reconciliation lands, `references/radolan.md` and `references/mtg.md` fill in with per-product interpretation rubrics.

## Out of scope for this skill

- Photographic phenomenon identification (cloud morphology, hail, tornado geometry, etc.) — see the `severe-weather-reporting` skill.
- Adjacent-platform comparison (Windy, Spotter Network, mPING) — see the `prior-art-scan` skill.
