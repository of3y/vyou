---
agent: classifier
surface: managed-agent
pipeline: ingestion
created: 2026-04-22
updated: 2026-04-24
author: VYou
type: reference
tags: [agent, managed-agent, classifier, vision, opus-4-7]
skills: [severe-weather-reporting]
summary: Vision-only meteorological observer. Takes a submitted sky photo, returns a structured phenomenon + features + confidence record grounded in the severe-weather-reporting skill. First vision-using agent in the ingestion pipeline.
---

# Classifier

The Classifier is the first vision-using agent in VYou's ingestion pipeline. Input: a submitted photo plus minimal metadata (timestamp, coarse-grained location). Output: one JSON record with a phenomenon label, a 3–7-entry feature list, an optional hail-size estimate, and a qualitative confidence level — or the `out_of_scope` escape hatch for non-weather images. The record is what the downstream Reconciliation, Deep Researcher, and Verification agents read.

## Surface — Managed Agent, session-per-image

Classifier runs as a Claude Managed Agent on `claude-opus-4-7`. Each submitted photo opens a fresh session against the persisted agent config; the Edge Function at [supabase/functions/classify](../../supabase/functions/classify) streams events until the session goes idle, parses the JSON record, and writes a `classifications` row. Per-image isolation and server-side vision execution are why this one is a CMA rather than a plain Messages API call — see [docs/02 MVPs/managed-agents-architecture.md](../../docs/02%20MVPs/managed-agents-architecture.md) §Role-by-role decision matrix.

## Setup

One-time provisioning happens in two scripts:

1. [scripts/cma-setup-skills.mjs](../../scripts/cma-setup-skills.mjs) — uploads the [severe-weather-reporting skill bundle](../../skills/severe-weather-reporting) to `/v1/skills`, returns a `skill_id` and `latest_version`. Exported to the shell as `SEVERE_WEATHER_REPORTING_SKILL_ID` + `SEVERE_WEATHER_REPORTING_SKILL_VERSION`.
2. [scripts/cma-setup-classifier.mjs](../../scripts/cma-setup-classifier.mjs) — creates the environment, creates the Classifier agent with the skill attached, and logs `CLASSIFIER_ENVIRONMENT_ID` + `CLASSIFIER_AGENT_ID` for Supabase function secrets.

The agent's system prompt is a short behavior contract (output shape, confidence discipline, hail-size gate, out-of-scope rule). The phenomenon taxonomy itself and the per-phenomenon feature vocabulary live in the attached skill at [skills/severe-weather-reporting](../../skills/severe-weather-reporting), structured as progressive disclosure over `SKILL.md` + `references/{taxonomy,features,rubrics}.md`.

## Output contract

```json
{
  "phenomenon": "<one label from the skill taxonomy, or 'out_of_scope'>",
  "features": ["<short phrase>", "..."],
  "hail_size_cm": <number or null>,
  "confidence": "low" | "medium" | "high"
}
```

Populated according to the rubrics in the attached skill. `hail_size_cm` is non-null only when the phenomenon is `hail` AND a scale reference is visible in the same frame. Confidence defaults to `medium`. Non-weather images emit the `out_of_scope` record.

## Status

Live on `agent_011CaNFPcVYNTDMcAbNJX2oa` (initial provisioning 2026-04-24 morning), re-provisioned with the `severe-weather-reporting` skill attached as of the CMA-alignment slate (see [decision-log.md](../../docs/decision-log.md) 2026-04-24). First end-to-end smoke against an indoor-plant submission returned `out_of_scope` / `high` confidence with feature `indoor scene with houseplant and laptop` — the out-of-scope path works.

Open item: hail-size calibration against a corpus of scale-referenced frames. Drops into the validation sanity run under `eval/` once the corpus has enough hail samples labeled.
