# VYU

*What's in your view.*

VYU is a community-fed situational weather map. A field observer takes a photo of what they see — a storm, a cloud structure, a clean front edge, a sky over a Bavarian monastery — and VYU captures not just the image but the compass heading, so every report becomes a **view-cone** on a shared map pointing exactly where the camera was aimed. Three Claude Managed Agents on Opus 4.7 do the work behind the cone — but on two clocks: two when you submit (the Classifier reads the photo, Reconciliation compares it against DWD radar + EUMETSAT MTG satellite + Open-Meteo), and the third when you ask (Deep Researcher answers a place-grounded question against the verified report and a per-cell memory of prior contributors). The product lives in one motion: a sky photo becomes a directional, AI-verified weather report on a shared map, and your contribution earns you a question only that map can answer.

The name is pronounced *"view."* The **V** doubles as the heading-cone geometry; the **YOU** puts the observer at the centre. A submitted view is a **VYUport**.

This is the submission for the [Built with Opus 4.7 Claude Code hackathon](https://cerebralvalley.ai/e/built-with-4-7-hackathon) (Anthropic × Cerebral Valley, 2026-04-21 → 2026-04-26).

---

## The hero loop

```
  photo  →  heading  →  view-cone on map  →  verified against radar/sat  →  earned question
   ↓                                                ↓                              ↓
  Classifier CMA                              Reconciliation CMA              Deep Researcher CMA
  (Opus 4.7)                                  (Opus 4.7)                      (Opus 4.7 + memory box)
   ↓                                                ↓                              ↓
  fires immediately on submit              auto-fires server-side          fires on user question
                                           via EdgeRuntime.waitUntil
```

Two CMAs run when you submit. The third runs when you ask. **The temporal split is the architecture.** Eager work on what we know (your photo, the radar at that timestamp), expensive on-demand work on what *you* want to know.

---

## Architecture, on the record

| Component | Shape | Why this shape |
|---|---|---|
| **Classifier** | Claude Managed Agent on `claude-opus-4-7` with the `severe-weather-reporting` skill attached. Returns a JSON record with phenomenon, features, hail size, confidence, and a `safe` moderation flag. | Vision as first-class input. The skill carries the 14-label phenomenon taxonomy, per-phenomenon feature vocabulary, and rubrics; the agent's system prompt is the behavior contract. |
| **Reconciliation** | Claude Managed Agent on `claude-opus-4-7`. Auto-fires from Classifier via `EdgeRuntime.waitUntil`. Reads the photo + the DWD RADOLAN radar frame for that lat/lon at that timestamp + Open-Meteo + EUMETSAT MTG IR/lightning tiles. Emits match / mismatch / inconclusive verdict with a rationale. | This is the agent that decides whether the photo is consistent with the official weather signal at the time and place it was taken. The auto-fire makes the verify step invisible to the user. |
| **Deep Researcher** | Claude Managed Agent on `claude-opus-4-7` with the `deep-researcher-planner` skill, a memory_store resource per geohash6 cell (location memory) and per anonymous reporter_id (user memory) — both attached read-only to the session. Returns a place-grounded brief with cited sources and a guardrails block. | The DR session inherits location-cell memory across contributors — the second brief in a cell can cite *"a contributor here noted X earlier today"*. Per-user store carries only anonymized signal (declared goals, accuracy track record), never raw photos or IPs. |
| **Image Moderator + TOS Moderator** | Messages-API calls with cached skill prefixes. Hot path stays cheap. | Right-tool discipline: not every step needs a CMA session. |
| **Submit pipeline** | `submit-report` Edge Function persists the report + writes an append-only `report_context` snapshot (radar URL, MTG IR/LI URLs + timestamps, Open-Meteo current+hourly) at submit time so the verified-report card and downstream briefs read a stable, auditable snapshot even after the live radar rolls forward. Per-reporter rate limit at 30 submissions/hour. | The verified report is a record at a moment in time. `report_context` captures the snapshot once; `EdgeRuntime.waitUntil` keeps the write alive past the response. |
| **Frontend** | Vite + React + TypeScript PWA, MapLibre cones, vaul drawers, sonner toasts. Map is the primary read surface; tap a cone for a 50dvh detail drawer, tap *Open full report* for the deep-link target. | Capture lands on a celebrate-and-return overlay that auto-navigates back to the map; the trade is made legible by a bell pulse + celebrate-the-trade copy when the question arrives. |
| **Backend** | Supabase (Postgres + Auth + Storage + Edge Functions). Cohort-bound invite tokens gate paid endpoints; reads are gated too but don't count against the cap. RLS-enabled; service role only in functions. | One vendor, one auth surface. The 2026-04-23 stack lock and the 2026-04-23 evening pivot from R2 to Supabase Storage are documented in [`docs/decision-log.md`](docs/decision-log.md). |

The validation harness in [`eval/`](eval/) ships supervised classifier benchmark runs against a labelled corpus, with committed reports for the precision/recall slice the system is designed to optimize.

The full architecture audit and the three-agent adversarial hardening pass live at [`docs/architecture-audit-and-grand-goal-2026-04-25.md`](docs/architecture-audit-and-grand-goal-2026-04-25.md) and [`docs/architecture-audit-hardened-plan-v2.md`](docs/architecture-audit-hardened-plan-v2.md). Every "non-negotiable correction" the audit named was either implemented (auto-fire, opaque-id mapping, UNIQUE constraint, append-only context, moderation flag) or explicitly deferred with reasoning recorded in the decision log.

---

## How we chose this scope

VYU was designed **backwards from the seven patterns that repeated across the five Built-with-Opus-4.6 winners** — domain-expertise-as-wedge, a named first user on camera, vision as first-class input, parallel orchestrated agents, a demo that shows a delta in time-to-artifact, domain knowledge as a reusable skill, and a lean codebase. We ship the full playbook at [`docs/04-winner-pattern-playbook.md`](docs/04-winner-pattern-playbook.md) and name each VYU move that reflects each pattern. Transparency about the scaffolding is itself the point — a submission that quietly mimics winning patterns is less interesting than one that names them, explains why it chose them, and lets judges hold it to the claim.

The domain wedge is genuine: the builder works professionally on systems adjacent to Europe's weather satellites. That perspective shapes the satellite layer of the product — band choices, data-access posture, the meteorology taxonomy cited by the agents. (Employer name stays out of the public materials for the hackathon week per the builder's personal-capacity framing; this can be revisited post-hackathon if the project continues.)

## How we built this — on the record

Every line in this repo was written after the 2026-04-21 12:30 EST hackathon kickoff by Daniel (in Munich) working with Claude Code. The whole collaboration lives on the record inside the repo's [`docs/`](docs/) vault — Obsidian-compatible, session-to-session handoffs via daily notes, durable decisions in a dated [`decision-log.md`](docs/decision-log.md). The public reference for this mode of work is Andrej Karpathy's recent showcasing of Obsidian + Claude Code as a coherent writing-and-building environment.

Authorship on docs is explicit: `author: Claude` on notes drafted by the Claude Code session, `author: Daniel` on notes Daniel writes directly, and a `>[!note Daniel]` callout pattern for Daniel's inline review of Claude-authored notes.

See [`docs/companion.md`](docs/companion.md) for the working posture and [`docs/Welcome.md`](docs/Welcome.md) for the vault map. The hardened build slate the final day executes against lives at [`docs/architecture-audit-hardened-plan-v2.md`](docs/architecture-audit-hardened-plan-v2.md).

---

## Scoring dimensions — where each lives

| Dimension | Where it lives in the repo |
|---|---|
| **Opus 4.7 Use (25%)** — vision + Managed Agents + Memory Box | [`agents/`](agents/) (Classifier + Reconciliation + Deep Researcher as Managed Agents; Image Moderator + TOS Moderator as Messages-API calls with cached skill prefixes), [`eval/runner.mjs`](eval/runner.mjs) (offline classifier validator that loads the live CMA), [`skills/`](skills/) (4 shipped skills: severe-weather-reporting, radar-and-satellite-reference, deep-researcher-planner, prior-art-scan), [`supabase/functions/_shared/memstore.ts`](supabase/functions/_shared/memstore.ts) (per-cell + per-user Memory Box wiring) |
| **Depth (20%)** — defended claims | [`eval/`](eval/) (supervised classifier benchmark, committed reports), [`skills/severe-weather-reporting/references/`](skills/severe-weather-reporting/references/) (taxonomy, features, rubrics), [`docs/heading-math.md`](docs/heading-math.md) (3D pose-to-bearing derivation) |
| **Demo (25%)** — 3-min video | [`demo/`](demo/) (Remotion project), [`docs/demo-script-F-polished.md`](docs/demo-script-F-polished.md) |
| **Impact (30%)** — real community-weather JTBD | [`docs/distribution-plan.md`](docs/distribution-plan.md) and the closed cohort's submissions in production: paragliders, sailors, trail runners, friends on holiday — the verified-loop receipts, not slideware. |

## Licensing

- **Code:** MIT — see [`LICENSE`](LICENSE).
- **User-generated report content** (photos, captions, derived narratives): CC-BY-4.0.
- **Default data sources** (DWD, EUMETSAT public imagery, ESWD) ship with the repo; paid feeds are BYO-key.

## Status

**Submission ready, 2026-04-27.** Hero loop is live in production with the 10-tester closed cohort: photo → heading → view-cone → auto-fire reconcile against radar + satellite + forecast → earned-question Deep Researcher brief grounded in per-cell memory. Six receipts from the cohort sit in the database — paragliders above the Alps, a sailor on the Rursee, trail runners near the Zugspitze, a friend on holiday in Turkey, the textbook Bräustüberl beer answer at Kloster Andechs above the Ammersee. The build is on the record across six days of dated daily notes and a versioned decision log; nothing is reconstructed after the fact.
