---
name: severe-weather-reporting
description: Use this skill whenever the agent needs to identify or describe meteorological phenomena in a sky or outdoor photograph. Triggers include classifying the weather in an image, extracting diagnostic visual features, estimating hail size from a scale-referenced frame, judging consistency with radar/satellite context, or routing a weather-photo submission in the VYU pipeline. Provides the phenomenon taxonomy (14 scored labels across cloud morphology, non-severe precipitation, severe convection, and storm structures), per-phenomenon feature vocabularies, the three-level confidence rubric, hail-size anchor-object guidance, and the out-of-scope escape hatch. Do NOT use for satellite-product interpretation or radar composite reading — those live in the radar-and-satellite-reference skill.
license: MIT — see LICENSE.txt
---

# severe-weather-reporting

Reference knowledge for agents that classify, reconcile, verify, or summarize VYU's field-captured weather photos. The skill defines the 14 phenomenon labels VYU scores, names the diagnostic visual features that distinguish each, and codifies the confidence and hail-size rubrics every downstream artifact cites.

Cited by: **Classifier** (CMA, session-per-image), **Reconciliation** (CMA, per-location memory attached), **Deep Researcher** (CMA, per-user + per-location memory attached), **Verification** (Messages API cached prefix), and the offline **Classifier Validator** eval harness.

## Overview

VYU's hero loop turns a sky photo into a verified, directional weather report on a shared map. Every agent that looks at the photo — or reasons about its consistency against radar and satellite context — grounds its vocabulary here. The central claim under test is feature-extraction *plausibility*: agents must describe what is actually visible in the frame, not hallucinate features a rubric says "should" accompany a phenomenon. This skill's job is to give every agent a shared, auditable vocabulary so a reviewer can check whether an extracted feature is present in the pixels.

## Quick orientation

The Classifier agent returns a structured JSON record with five fields — `phenomenon`, `features`, `hail_size_cm`, `confidence`, and a `safe` boolean moderation flag — plus an `out_of_scope` escape hatch for non-weather images. See `references/rubrics.md` §Safety flag for when `safe: false` is the right call. The downstream agents (Reconciliation, Deep Researcher, Verification) read those fields and this skill in parallel to judge whether the record is consistent with radar/satellite evidence and nearby community reports.

For the exact JSON output contract, see `scripts/cma-setup-classifier.mjs` in the repo root — the system prompt there carries the schema and behavior contract, while this skill carries the taxonomy and rubrics the contract references.

## When to read which reference file

| You need… | Read |
|---|---|
| The 14 phenomenon labels, their definitions, and how they group into families | `references/taxonomy.md` |
| The diagnostic visual features per phenomenon (what to look for, what to write in the `features` list) | `references/features.md` |
| The three-level confidence rubric, hail-size anchor objects, the feature-richness scheme, and the out-of-scope shape | `references/rubrics.md` |

If you are naming a phenomenon, start with `taxonomy.md`. If you are populating the `features` array, read `features.md`. If you are picking a confidence level, populating `hail_size_cm`, or emitting the `out_of_scope` record, read `rubrics.md`.

## Core invariants every agent must honor

- **Features must be verifiable in the frame.** A feature goes into the record only if a human reviewer could point at the pixels that support it. "Anvil cloud visible" means an anvil is in the photo; it does not mean "this phenomenon usually has an anvil."
- **Confidence is qualitative, not numeric.** Use `low` / `medium` / `high` per the rubric — never emit numeric percentages. See `references/rubrics.md`.
- **Hail size populates only under both conditions** — phenomenon is `hail` **and** a scale reference (coin, hand, ball, known object) is visible in the same frame. Otherwise `null`.
- **Out-of-scope is a first-class outcome**, not an error. If the image is not a sky or outdoor weather scene, emit the `out_of_scope` record per `references/rubrics.md` rather than forcing a weather label.
- **Multi-phenomenon frames pick the most decision-relevant phenomenon.** Severe weather outranks precipitation; precipitation outranks cloud cover. Record the discarded phenomenon as a feature if it materially affects the scene.

## Downstream contract

The `features` vocabulary defined in `references/features.md` is the contract the validation corpus labels against (`eval/dataset-manifest.csv` `features_gold` column) and the vocabulary the eval harness scores per-feature precision and recall over. Features should be drawn from that list where possible. New features land in `references/features.md` first, then in `features_gold` labeling — never the other way around.

## Out of scope for this skill

- Satellite product interpretation (FCI channels, LI products, RGB composites) — see the `radar-and-satellite-reference` skill.
- Radar composite reading (RADOLAN reflectivity, storm attributes, warning-intersecting cells) — also `radar-and-satellite-reference`.
- Adjacent-platform comparison (Windy, Spotter Network, mPING) for evidence-brief framing — see the `prior-art-scan` skill, cited by Deep Researcher.
- General weather forecasting, route planning, or decision support that does not start from a submitted photo.
