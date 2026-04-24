---
agent: reconciliation
surface: managed-agent
pipeline: ingestion
created: 2026-04-22
updated: 2026-04-24
author: VYou
type: reference
tags: [agent, managed-agent, reconciliation, vision, consistency-judgment]
skills: [severe-weather-reporting, radar-and-satellite-reference]
summary: The sense-maker. Takes the Classifier's phenomenon record and the Radar agent's reading, judges whether they are consistent with the photo and with each other, and writes the human-readable narrative that ships with the verified report.
---

# Reconciliation

The Reconciliation agent is the sense-maker. Input: the photo, the Classifier output, the Radar output, and the submission metadata. Output: a consistency judgment (consistent, partially consistent, contradictory — with reasons) and the narrative text that appears on the report card in the app and on the map cone pop-up. When Classifier and Radar disagree, Reconciliation names the disagreement rather than averaging it, and flags the report for the Verification agent.

## Surface — Managed Agent, per-location memory attached

Reconciliation runs as a Claude Managed Agent on `claude-opus-4-7`. Each accepted photo opens a fresh session against the persisted agent config with the per-location Memory Box store (`memstore_loc_<geohash6>`) attached; the agent reads nearby accepted reports from the last hour to answer *"is this report consistent with what other observers in the same cell saw recently?"*, writes back the verified report summary, and closes the session when idle.

**Why a CMA.** Per [docs/02 MVPs/managed-agents-architecture.md](../../docs/02%20MVPs/managed-agents-architecture.md) §Role-by-role decision matrix: "Cross-checks photo against radar + nearby reports; benefits from the location store." The session-state + memory attachment + server-side vision execution trio is exactly what CMAs handle cleanly, and Reconciliation is the Opus 4.7 load-bearing step in the hero loop.

## Attached skills

Two skills land on the agent at `agents.create()` time:

- **[severe-weather-reporting](../../skills/severe-weather-reporting)** — the phenomenon taxonomy and feature vocabulary Reconciliation cites when judging whether the Classifier's record is consistent with the photo.
- **[radar-and-satellite-reference](../../skills/radar-and-satellite-reference)** — the RADOLAN + MTG interpretation reference Reconciliation cites when judging whether the photo is consistent with the Radar agent's reading.

## Status — stub

The agent builds end-to-end on Day 4 as the second CMA after Classifier. The cached-prefix skill and the memory-store attachment are non-negotiable for the prize-narrative cohesion; if the two skill uploads fail, Reconciliation degrades to a plain Messages API call rather than skipping the evidence citation.
