---
agent: verification
surface: messages-api-cached-prefix
pipeline: ingestion
created: 2026-04-22
updated: 2026-04-24
author: VYou
type: reference
tags: [agent, messages-api, verification, human-review-queue]
skills: [severe-weather-reporting]
summary: VYou's honesty layer. Watches Classifier, Radar, and Reconciliation outputs for contradictions and routes flagged reports to a human-review queue rather than auto-publishing the report narrative.
---

# Verification

The Verification agent is VYou's honesty layer. Input: the full ingestion-pipeline output (Classifier + Radar + Reconciliation). Output: a pass/flag verdict with reasoning, and — when flagged — a routing record that places the report in the human-review queue rather than auto-publishing its narrative. Verification is what keeps the map from confidently painting a storm cone onto a sunny afternoon when the Classifier hallucinates; it operationalizes the team's uncertainty discipline and is load-bearing for the *Depth* scoring axis.

## Surface — Messages API with cached skill prefix

Verification runs as a direct Anthropic Messages API call from a Supabase Edge Function, not as a Claude Managed Agent. The `severe-weather-reporting` skill's content loads into the system prompt with `cache_control: { type: "ephemeral" }` so every call reuses the cached prefix.

**Why not a CMA.** The Verification check is largely deterministic and geometric: given the Classifier's feature list, the Radar reading, and the Reconciliation consistency judgment, does the composite record hold together? Session state + memory attachment do not add value to that check, and the cold-start latency would push Verification's verdict behind the synchronous hero-loop budget. Per [docs/02 MVPs/managed-agents-architecture.md](../../docs/02%20MVPs/managed-agents-architecture.md) §Where CMAs are the wrong choice, deterministic checks gain nothing from an agent loop.

## Status — stub

Prompt design lands Day 4 alongside Reconciliation. The agent must be willing to disagree with its upstream agents — over-deference to Reconciliation defeats the whole point. Threshold calibration against the first ~20-image eval run; adjustment based on false-flag vs false-pass rates.
