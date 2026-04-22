---
agent: classifier-validator
pipeline: evaluation
created: 2026-04-22
updated: 2026-04-22
author: VYou
type: reference
tags: [agent, evaluation, benchmark, classifier, supervised, offline]
skills: [severe-weather-reporting]
summary: Offline evaluation agent. Runs the supervised phenomenon-classification benchmark against the committed dataset manifest and writes a dated report into eval/.
---

# Classifier Validator

An offline agent, not part of the live ingestion pipeline. Input: `eval/dataset-manifest.csv` (image URLs + ground-truth labels), with the same Classifier prompt and skill loadout as the live Classifier. Output: `eval/report-YYYY-MM-DD.json` with per-slice metrics (top-1 and top-3 phenomenon accuracy, feature precision/recall, rare-class recall, day/night split, Central-Europe vs global), a confusion matrix, and a small sample of representative successes and failures. Reports commit in-tree so the benchmark trail is visible in git history.

**Status: stub for Day-1 alignment review.** Open question: does the validator reuse the exact Classifier prompt, or specialize (longer context, slower, higher-quality)? Default is *reuse* — the benchmark tests the live Classifier, not an idealized variant.
