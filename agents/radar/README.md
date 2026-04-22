---
agent: radar
pipeline: ingestion
created: 2026-04-22
updated: 2026-04-22
author: VYou
type: reference
tags: [agent, managed-agent, radar, dwd, radolan]
skills: [radar-and-satellite-reference]
summary: Given GPS, timestamp, and heading, returns DWD RADOLAN reflectivity and storm attributes for the view-cone the observer photographed.
---

# Radar

The Radar agent does not look at the photo. Input: GPS, timestamp, compass heading, and cone geometry. Output: the DWD RADOLAN reflectivity sample for that view-cone at that timestamp, any active DWD warnings intersecting the cone, and derived storm attributes (convective intensity bucket, approximate cell motion if extractable, echo-top proxy). The reading is cited against the entries in `skills/radar-and-satellite-reference` so the downstream Reconciliation agent can see *why* a particular signal was read this way.

**Status: stub for Day-1 alignment review.** Concrete RADOLAN integration lands Day 2 once data access is confirmed.
