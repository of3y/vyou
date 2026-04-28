---
agent: radar
surface: messages-api-cached-prefix
pipeline: ingestion
created: 2026-04-22
updated: 2026-04-24
author: VYou
type: reference
tags: [agent, messages-api, radar, dwd, radolan]
skills: [radar-and-satellite-reference]
summary: Deterministic radar fetcher. Given GPS + timestamp + heading, returns DWD RADOLAN reflectivity and storm attributes for the view-cone the observer photographed, cited against the radar-and-satellite-reference skill.
---

# Radar

The Radar agent does not look at the photo. Input: GPS, timestamp, compass heading, and cone geometry. Output: the DWD RADOLAN reflectivity sample for that view-cone at that timestamp, any active DWD warnings intersecting the cone, and derived storm attributes (convective intensity bucket, approximate cell motion if extractable, echo-top proxy). The reading is cited against the `radar-and-satellite-reference` skill so the downstream Reconciliation agent can see *why* a particular signal was read this way.

## Surface — Messages API with cached skill prefix

Radar runs as a direct Anthropic Messages API call from a Supabase Edge Function, not as a Claude Managed Agent. The `radar-and-satellite-reference` skill's reference content is loaded into the system prompt with `cache_control: { type: "ephemeral" }` so every call reuses the cached prefix.

**Why not a CMA.** Latency-sensitive paths the user is waiting on synchronously pay a session cold-start cost that direct Messages API does not. Deterministic checks (EXIF parsing, heading geometry, radar fetches) gain nothing from an agent loop and lose latency to it. Radar fits all three criteria — the call is deterministic (given the same inputs, the same RADOLAN tile is fetched and the same reading returned), latency-sensitive (on the synchronous hero loop), and stateless (no benefit from session persistence).

## Status — stub

Concrete RADOLAN integration lands Day 2 once data access is confirmed. The cached-prefix skill and the downstream Reconciliation consumer will reach load-bearing state together on Day 4.
