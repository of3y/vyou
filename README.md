# VYU

*What's in your view.*

VYU is a community-fed situational weather map. A field observer takes a photo of what they see — a storm, a cloud structure, a clean front edge, a sky over a Bavarian monastery — and VYU captures not just the image but the compass heading, so every report becomes a **view-cone** on a shared map pointing exactly where the camera was aimed. Three Claude Managed Agents on Opus 4.7 do the work behind the cone — but on two clocks: two when you submit (the Classifier reads the photo, Reconciliation compares it against DWD radar + EUMETSAT MTG satellite + Open-Meteo), and the third when you ask (Deep Researcher answers a place-grounded question against the verified report and a per-cell memory of prior contributors). The product lives in one motion: a sky photo becomes a directional, AI-verified weather report on a shared map, and your contribution earns you a question only that map can answer.

The name is pronounced *"view."* The **V** doubles as the heading-cone geometry; the **YOU** puts the observer at the centre. A submitted view is a **VYUport**.

This was the submission for the [Built with Opus 4.7 Claude Code hackathon](https://cerebralvalley.ai/e/built-with-4-7-hackathon) (Anthropic × Cerebral Valley, 2026-04-21 → 2026-04-26).

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
| **Backend** | Supabase (Postgres + Auth + Storage + Edge Functions). Cohort-bound invite tokens gate paid endpoints; reads are gated too but don't count against the cap. RLS-enabled; service role only in functions. | One vendor, one auth surface. |

The validation harness in [`eval/`](eval/) ships supervised classifier benchmark runs against a labelled corpus, with committed reports for the precision/recall slice the system is designed to optimize.

---

## Licensing

- **Code:** MIT — see [`LICENSE`](LICENSE).
- **User-generated report content** (photos, captions, derived narratives): CC-BY-4.0.
- **Default data sources** (DWD, EUMETSAT public imagery, ESWD) ship with the repo; paid feeds are BYO-key.

## Status

Hero loop landed in production with a 10-tester closed cohort during the hackathon week: photo → heading → view-cone → auto-fire reconcile against radar + satellite + forecast → earned-question Deep Researcher brief grounded in per-cell memory. Six receipts from the cohort sit in the database — paragliders above the Alps, a sailor on the Rursee, trail runners near the Zugspitze, a friend on holiday in Turkey, the textbook Bräustüberl beer answer at Kloster Andechs above the Ammersee.
