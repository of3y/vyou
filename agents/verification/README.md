---
agent: verification
pipeline: ingestion
created: 2026-04-22
updated: 2026-04-22
author: VYou
type: reference
tags: [agent, managed-agent, verification, human-review-queue]
skills: [severe-weather-reporting]
summary: Watches Classifier, Radar, and Reconciliation outputs for contradictions and routes flagged reports to a human-review queue. The honest-when-wrong layer.
---

# Verification

The Verification agent is VYou's honesty layer. Input: the full pipeline output (Classifier + Radar + Reconciliation). Output: a pass/flag verdict with reasoning, and — when flagged — a routing record that places the report in the human-review queue rather than auto-publishing its narrative. Verification is what keeps the map from confidently painting a storm cone onto a sunny afternoon when the Classifier hallucinates; it is load-bearing for the *Depth* score because it operationalizes the team's uncertainty handling.

**Status: stub for Day-1 alignment review.** Prompt design should make Verification willing to disagree with its upstream agents — over-deference to Reconciliation defeats the whole point.
