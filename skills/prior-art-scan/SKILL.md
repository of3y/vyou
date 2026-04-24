---
name: prior-art-scan
description: Use this skill whenever the Deep Researcher agent needs to situate a VYou community report in the landscape of adjacent weather-platforms so the cited brief is lineage-honest — "Windy shows X here, a community observer says Y" reads stronger than a single-source answer. Triggers include composing a cited evidence brief for a user query scoped to a geohash cell, naming how a VYou observation compares to what an incumbent platform would show at the same location and timestamp, or framing VYou's wedge relative to a named adjacent platform in a demo narration. Provides short reference entries on Windy, Spotter Network, mPING, ACME-Weather, and DWD WarnWetter — what each does well, what each misses, and the honest framing VYou uses alongside each. Do NOT use for photographic phenomenon identification (severe-weather-reporting) or for radar/satellite interpretation (radar-and-satellite-reference).
license: MIT — see LICENSE.txt
---

# prior-art-scan

Reference knowledge for the adjacent and comparable weather platforms VYou overlaps with, borrows from, and differs from. The skill is cited by the Deep Researcher agent when an evidence brief benefits from grounding the community report in the landscape — a lineage-honest brief beats a single-source answer.

Cited by: **Deep Researcher** (CMA, per-user + per-location memory attached).

## Overview

VYou's defensible framing is not "another weather app" — it is community photos as evidence, reconciled against official layers, on a shared map. That framing lands harder when the brief names what the incumbents do and don't do. This skill carries the short reference entries Deep Researcher quotes.

## Status — stub

This skill's body is intentionally thin right now. Population happens through Days 2–4 as research digests under `docs/01 Active Research/` surface concrete comparison points and Daniel curates them in. Today the skill points at:

- [docs/01 Active Research/weather-market-and-positioning-digest.md](../../docs/01%20Active%20Research/weather-market-and-positioning-digest.md) — the authoritative positioning brief covering incumbent platforms and VYou's defensible framing.
- [docs/01 Active Research/nature-observation-competitors-digest.md](../../docs/01%20Active%20Research/nature-observation-competitors-digest.md) — mechanics to borrow from iNaturalist, Seek, Observation, Merlin.

When the Deep Researcher agent is running end-to-end (Friday evening cut-back gate), the skill's body expands with per-platform reference entries the brief cites by name.

## Out of scope for this skill

- Photographic phenomenon identification — see the `severe-weather-reporting` skill.
- Radar / satellite product interpretation — see the `radar-and-satellite-reference` skill.
- Internal VYou build-process tooling (housekeeping, decision-requests) — those live under `.claude/skills/`, not here.
