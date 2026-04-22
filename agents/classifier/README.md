---
agent: classifier
pipeline: ingestion
created: 2026-04-22
updated: 2026-04-22
author: VYou
type: reference
tags: [agent, managed-agent, classifier, vision, opus-4-7]
skills: [severe-weather-reporting]
summary: Takes a submitted photo, returns a phenomenon tag, feature list, and optional hail-size estimate grounded in the severe-weather-reporting skill.
---

# Classifier

The Classifier is the first vision-using agent in the ingestion pipeline. Input: a submitted photo plus minimal metadata (timestamp, location coarse-grained). Output: a dominant phenomenon tag drawn from the taxonomy in `skills/severe-weather-reporting`, a list of diagnostic features (e.g. *mammatus visible*, *shelf cloud leading edge*, *hail on surface*), and an optional hail-size estimate when objects of reference are present in-frame. The output is a structured JSON record; the agent cites the specific skill entries it used so a reviewer can audit the reasoning.

**Status: stub for Day-1 alignment review.** Prompt, tool schema, and test corpus land through Days 1–2.
