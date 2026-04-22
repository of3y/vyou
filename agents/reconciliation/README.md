---
agent: reconciliation
pipeline: ingestion
created: 2026-04-22
updated: 2026-04-22
author: VYou
type: reference
tags: [agent, managed-agent, reconciliation, vision, consistency-judgment]
skills: [severe-weather-reporting, radar-and-satellite-reference]
summary: Takes the Classifier's phenomenon tag and the Radar agent's reading, judges whether they are consistent with the photo, and writes the human-readable narrative that ships with the report.
---

# Reconciliation

The Reconciliation agent is the sense-maker. Input: the photo, the Classifier output, the Radar output, and the submission metadata. Output: a consistency judgment (consistent, partially consistent, contradictory — with reasons) and the narrative text that appears on the report card in the app and on the map cone pop-up. When Classifier and Radar disagree, Reconciliation names the disagreement rather than averaging it, and flags the report for the Verification agent. Cites both shipped skills.

**Status: stub for Day-1 alignment review.** An open Day-1 question is whether this agent shares substrate with the Deep Researcher, given the overlap in narrative generation. Default is to keep them separate so the ingestion path has no user-query contamination.
