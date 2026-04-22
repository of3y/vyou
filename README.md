# VYou

*See the weather through someone else's view.*

VYou is a photo-first community weather app. A field observer takes a photo of what they see — a storm, a cloud structure, hail on a car, clear sky — and VYou captures not just the image but the compass heading, so every report becomes a **view-cone** on a shared map pointing exactly where the camera was aimed. The basemap renders EUMETSAT satellite imagery over DWD radar for Central Europe; behind the submit button, a team of Claude Managed Agents on Opus 4.7 classifies the phenomenon, pulls the radar reading for that view at that timestamp, judges whether the photo is consistent with the remote-sensing layers, moderates the submission, and writes a human-readable narrative. A Deep Researcher agent answers personalized briefings on demand.

The name is pronounced *"view."* The **V** doubles as the heading-cone geometry; the **YOU** puts the observer at the centre. One name, two readings.

This is the submission for the [Built with Opus 4.7 Claude Code hackathon](https://cerebralvalley.ai/e/built-with-4-7-hackathon) (Anthropic × Cerebral Valley, 2026-04-21 → 2026-04-26).

---

## How we chose this scope

VYou was designed **backwards from the seven patterns that repeated across the five Built-with-Opus-4.6 winners** — domain-expertise-as-wedge, a named first user on camera, vision as first-class input, parallel orchestrated agents, a demo that shows a delta in time-to-artifact, domain knowledge as a reusable skill, and a lean codebase. We ship the full playbook at [`docs/04-winner-pattern-playbook.md`](docs/04-winner-pattern-playbook.md) and name each VYou move that reflects each pattern. Transparency about the scaffolding is itself the point — a submission that quietly mimics winning patterns is less interesting than one that names them, explains why it chose them, and lets judges hold it to the claim.

The domain wedge is genuine: the builder works professionally on systems adjacent to Europe's weather satellites. That perspective shapes the satellite layer of the product — band choices, data-access posture, the meteorology taxonomy cited by the agents. (Employer name stays out of the public materials for the hackathon week per the builder's personal-capacity framing; this can be revisited post-hackathon if the project continues.)

## How we built this — a companion posture

Every line in this repo was written after the 2026-04-21 12:30 EST hackathon kickoff by Daniel (in Munich) collaborating with a named Claude Code session called **VYou** — the same name as the product, on purpose. Pronunciation *view* holds for both readings. Authorship on docs is explicit: `author: VYou` on notes drafted by the Claude Code session, `author: Daniel` on notes Daniel writes directly, and a `>[!note Daniel]` callout pattern for Daniel's inline review of VYou-authored notes.

The public reference for this mode of work is Andrej Karpathy's recent showcasing of Obsidian + Claude Code as a coherent writing-and-building environment. VYou extends that posture by giving the companion a name that matches the product and running the whole collaboration on the record inside the repo's [`docs/`](docs/) vault — Obsidian-compatible, session-to-session handoffs via daily notes, durable decisions in a dated [`decision-log.md`](docs/decision-log.md). The wager: a named, journaling, on-the-record Claude companion is a natural next move for the Claude Code product line, and building it in public here is the small proof.

See [`docs/companion.md`](docs/companion.md) for the posture, and [`docs/Welcome.md`](docs/Welcome.md) for the vault map.

---

## Scoring dimensions — where each lives

| Dimension | Where it lives in the repo |
|---|---|
| **Opus 4.7 Use (25%)** — vision + Managed Agents | [`agents/`](agents/) (7 live agents + 1 offline validator), [`skills/`](skills/) (3 shipped skills), `docs/architecture.md` |
| **Depth (20%)** — defended claims | [`eval/`](eval/) (supervised classifier benchmark, committed reports), [`skills/severe-weather-reporting/`](skills/severe-weather-reporting/) |
| **Demo (25%)** — 3-min video | [`demo/`](demo/) (Remotion project), [`docs/demo-script.md`](docs/demo-script.md) |
| **Impact (30%)** — real community-weather JTBD | [`docs/distribution-plan.md`](docs/distribution-plan.md) (closed iOS PWA beta, 5–15 friends contributing real reports during the build week) |

## Licensing

- **Code:** MIT — see [`LICENSE`](LICENSE).
- **User-generated report content** (photos, captions, derived narratives): CC-BY-4.0.
- **Default data sources** (DWD, EUMETSAT public imagery, ESWD) ship with the repo; paid feeds are BYO-key.

## Status

Day 1 scaffold. Details land in [`docs/`](docs/) as the build progresses. Open for inspection by judges and teammates at submission time.
