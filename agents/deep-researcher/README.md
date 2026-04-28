---
agent: deep-researcher
surface: managed-agent
pipeline: post-reconciliation
created: 2026-04-24
updated: 2026-04-24
author: VYou
type: reference
tags: [agent, managed-agent, deep-researcher, memory-box, opus-4-7, orchestrator]
skills: [severe-weather-reporting, radar-and-satellite-reference, prior-art-scan, deep-researcher-planner]
summary: The post-Reconciliation content-layer orchestrator. Fires when `reports.status='accepted'`, opens a CMA session with per-user + per-location Memory Box stores attached, reads the persisted pipeline outputs + nearby prior briefs, and composes a cited evidence-summary block that renders under the classification block in ReportDetail. The agent behind the "second user, same cell, richer brief" Memory Box demo beat.
---

# Deep Researcher

Deep Researcher is VYU's third Managed Agent. It runs AFTER the hero loop's Classifier → Reconciliation pipeline has landed a verified report, opens its own CMA session with the submission's context and two Memory Box stores attached, and returns a cited evidence-summary block that grounds the report in prior observations from the same cell and in the user's declared goal-context.

## Surface — Managed Agent, content-layer orchestrator

Deep Researcher is the "top layer" of VYou's agent stack by virtue of what it *reasons over* — the Classifier's phenomenon record, the Radar agent's reading, the Reconciliation narrative, nearby accepted reports from the per-location Memory Box, prior briefs for the same cell, and the user's history from the per-user Memory Box. It is NOT a control-flow orchestrator: Deep Researcher does not spin up Classifier/Reconciliation sub-sessions or call them through custom tools. The existing ingestion pipeline persists its artifacts to Postgres as it runs; Deep Researcher reads those persisted artifacts plus Memory Box state and synthesizes.

This framing is deliberate. Session-of-sessions was considered and rejected as over-engineering: it would force every submission to cold-start a DR session before Classifier fires, make DR sessions block on child sessions (fragile), and retract the already-working `/classify` Edge Function path. Content-layer orchestration keeps the synchronous hero loop intact, keeps DR latency off the critical path, and still carries the full CMA-primitive story (persistent agent, attached skills, attached memory stores, streaming events).

## Memory Box shape

Two store classes, both workspace-scoped, attached to the DR session at creation time via the `resources[]` array:

- **Per-user store** (`memstore_user_<user_id>`) — the user's reporting history, accuracy track record from prior reconciliations, declared goal-context (cyclist, photographer, parent of an outdoor toddler), and any briefings DR has previously assembled for them. Read at session start, written back at session end with whatever the session learned. Public moderation-relevant signal (false-alarm rate, prior TOS flags) also lives here so the moderation path can read it without an extra round trip.

- **Per-location store** (`memstore_loc_<geohash6>`) — a rolling radar baseline for the cell, the most recent N accepted reports from any user, and the latest DR briefing for the cell. Geohash6 gives ~1.2 km cells — coarse enough to share usefully across users in the same neighborhood, fine enough that the briefing stays locally relevant. DR reads this store to answer *"is this report consistent with what other observers nearby saw in the last hour?"* and writes back the brief it produces. The next user querying the same cell inherits the work.

The Memory Box demo beat is built on this layout: a second beta user submits a photo from the same geohash cell as the first, and Deep Researcher's brief is *visibly* richer because the per-location store now carries the prior session's writes.

## Attached skills

Four skills land on the agent at `agents.create()` time:

- **[severe-weather-reporting](../../skills/severe-weather-reporting)** — the phenomenon taxonomy and diagnostic feature vocabulary the brief cites when describing what was observed.
- **[radar-and-satellite-reference](../../skills/radar-and-satellite-reference)** — DWD RADOLAN interpretation, MTG FCI/LI framing, and the Open-Meteo `current` field set the brief grounds state-of-the-air claims in.
- **[prior-art-scan](../../skills/prior-art-scan)** — adjacent-platform reference entries the brief uses when grounding VYou's observation in the landscape (*"Windy shows X here, a community observer says Y"*).
- **[deep-researcher-planner](../../skills/deep-researcher-planner)** — the DR voice spec, conditional-suggestion trigger pattern, local-guide register, staleness-honesty rule, and the JSON output contract the `/research` Edge Function parses.

## Trigger and output

Fires on `reports.status = 'accepted'` via a dedicated `/research` Supabase Edge Function (mirrors the shape of `supabase/functions/classify`). The function opens a DR CMA session, attaches both Memory Box stores for the submission's `user_id` and `geohash6`, sends the initial user-message event with the report's identifiers, streams events until `session.status_idle` with a terminal `stop_reason`, parses the brief, writes a `classifications` row scoped to `agent='deep-researcher'` with the cited brief as the payload, and updates `reports.status` to `briefed`.

The UI renders DR's brief as an evidence-summary block under the classification block in [ReportDetail](../../src/routes/ReportDetail.tsx). Loading state is a simple "Preparing evidence brief…" chip with a 60s timeout; if the brief fails to land, the report stays at `accepted` and the block does not appear — honesty over overclaim.

## Setup

Provisioning script lands alongside this README:

1. [scripts/cma-setup-skills.mjs](../../scripts/cma-setup-skills.mjs) — uploads the three attached skills if not already present. Idempotent when run with existing skill names.
2. [scripts/cma-setup-deep-researcher.mjs](../../scripts/cma-setup-deep-researcher.mjs) — creates the environment, creates the DR agent with the three skills attached, logs `DEEP_RESEARCHER_ENVIRONMENT_ID` + `DEEP_RESEARCHER_AGENT_ID` for Supabase function secrets, and prints the two Memory Box store-ID templates the Edge Function instantiates per-submission.

## Status

Live with the `/research` Edge Function and the `ReportDetail` evidence-summary block. Returns a cited brief on a real submission, references prior reports from the same location via Memory Box, and the second query at a cell visibly inherits the first session's writes.
