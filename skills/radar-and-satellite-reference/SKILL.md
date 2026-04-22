---
name: radar-and-satellite-reference
version: 0.0.1
created: 2026-04-22
updated: 2026-04-22
author: VYou
type: skill
tags: [skill, radar, satellite, dwd, eumetsat, mtg, radolan]
summary: DWD RADOLAN interpretation guidance and EUMETSAT MTG band/product reference, cited by the Radar, Reconciliation, and Deep Researcher agents.
---

# radar-and-satellite-reference

Reference knowledge for translating raw DWD RADOLAN radar composites and EUMETSAT MTG satellite products into statements the agents can reason over. Covers: RADOLAN reflectivity interpretation, storm-attribute derivation, MTG FCI band selection for cloud-top phase and convective diagnosis, and the uncertainty framing for each. The Radar agent cites entries here when returning a reading for a view-cone; the Reconciliation agent cites them when judging whether the photo matches the radar/satellite signal; the Deep Researcher cites them when aggregating layers for a personalized briefing.

**Status: stub.** Populated through Days 2–3 as the concrete Radar and satellite integrations land.
