---
title: Recording shot list — 2026-04-26
created: 2026-04-26
updated: 2026-04-26
author: VYou
type: mvp
tags: [demo, shotlist, recording, remotion, voice-clone]
related:
  - "[[demo-script-F-polished]]"
  - "[[narration-script-2026-04-26]]"
summary: Beat-by-beat mapping of Script F to (audio source, visual source, asset path, target duration). Voice-clone mode — narration generated from `narration-script-2026-04-26.txt` via 11Labs/Voicebox; voice sample is the cleanest segment of `assets/script-hero.m4a`. Visuals composed in Remotion against assets already on disk.
---

# Recording shot list — 2026-04-26

## Mode

**Voice-clone over Remotion composition.** Narration generated from [`narration-script-2026-04-26.txt`](narration-script-2026-04-26.txt) using 11Labs (recommended) or Voicebox. Voice-clone source: best ~30-second segment from [`assets/script-hero.m4a`](assets/script-hero.m4a) — Daniel's recording from yesterday. Visuals composed in Remotion using existing components (`WiringGraph`, `ConeIllustrative`, `ConeReceipt`) plus new beat-specific scenes built around assets already on disk.

No on-camera shooting. No Garmisch b-roll. No continuous-take pressure.

## Asset inventory — what is already on disk

Photos in [`assets/`](assets/):
- `andechs.jpg` (807 KB) — Kloster Andechs, Bavaria. Beat 5 + Beat 6 (Doppelbock receipt).
- `paraglider.jpg` (544 KB) — paraglider above the Alps. Beat 3 illustrative cut.
- `sailor.jpg` (327 KB) — Rursee sailor cone. Beat 4 illustrative cut.
- `turkey.jpg` (415 KB) — friend on holiday, Turkey. Beat 6 (waterfall receipt).

Live-build screen recordings in [`assets/`](assets/):
- `zugspitze-add-cone.MP4` (185 MB) — full capture flow on iPhone. Beat 2 phone-in-hand cut + Beat 3 illustrative supplement.
- `bavaria-time-travel-cones.MP4` (15 MB) — map view with multiple cones across time window. Beat 2 wide-map cut + Beat 8 close-shot.
- `cyclist-cone.MP4` (28 MB) — single cone-detail-drawer interaction. Beat 2 product-affordance cut.
- `sailor-cone.MP4` (37 MB) — sailor cone-to-photo interaction. Beat 4 supplemental cut if illustrative cone needs reinforcement.
- `turkey-cone.MP4` (58 MB) — Turkey cone-detail interaction. Beat 6 receipt-cadence supplemental.
- `metric-imperial-with-error.MP4` (46 MB) — settings + a known-error path. **Use only if Beat 7 numbers slide needs visual support; otherwise drop — error footage in a validation beat is the wrong tonal cue.**

Audio in [`assets/`](assets/):
- `script-hero.m4a` (1.5 MB) — Daniel's voice recording from 2026-04-26 00:21. Source for the voice clone.

Existing Remotion components in [`src/`](src/):
- `WiringGraph.tsx` (~65 s, 1950 frames @ 30fps) — covers Beats 3, 4, 5 wiring narration.
- `ConeIllustrative.tsx` (2 s per use, 60 frames) — cone-fades-photo-crystallizes-fades for Beats 3 + 4.
- `ConeReceipt.tsx` (6 s per use, 180 frames) — cone-anchor-upper-right + photo-fills-frame + answer-card-overlay for Beat 6.
- `HelloVYou.tsx` — reuse the catchphrase + VYU logo for Beat 8 close.

## Beat-by-beat mapping

### Beat 1 — Cold open (0:00–0:20, ~15 s + 5 s breath)

| Field | Value |
|---|---|
| Audio sentences | Lines 1–4 of `narration-script-2026-04-26.txt` (3 lines of speech + the `(pause)` inserted as 0.8 s silence). |
| Visual source | **NEW SCENE** — satellite-Earth shot. Use a static NASA Blue Marble PNG (public domain, downloadable in 30 s) with a slow Ken-Burns zoom from full-Earth to Europe-centered crop. No Artemis footage (rights ambiguity per Script F §6). |
| Assets needed | NASA Blue Marble JPG/PNG → save to `assets/blue-marble.jpg`. Direct link: NASA Visible Earth `BlueMarble_2002` series. |
| Duration | 20 s (15 s speech + 5 s tail breath as the cold-open phrase lands before Beat 2 starts). |
| Status | **Asset to fetch (~3 min)** — Blue Marble download, drop in `assets/`. Remotion scene composes in 5 min. |

### Beat 2 — Transition (0:20–0:55, ~25 s + 10 s visual)

| Field | Value |
|---|---|
| Audio sentences | Lines 5–10 (the three rhetorical questions + the synthesis sentence). |
| Visual source | First half: phone-in-hand cut from `assets/zugspitze-add-cone.MP4` (clip the first ~10 s showing the capture interface). Second half: wide map cut from `assets/bavaria-time-travel-cones.MP4` showing multiple cones across the time-window slider. |
| Assets needed | Both videos already on disk. May need ffmpeg trim if Remotion's `<OffthreadVideo>` doesn't accept `startFrom`/`endAt` cleanly. |
| Duration | 35 s. |
| Status | **Ready** — assets on disk. Remotion composition wires `<OffthreadVideo>` segments to audio timing. |

### Beat 3 — Wiring middle, the photo (0:55–1:15, ~20 s)

| Field | Value |
|---|---|
| Audio sentences | Lines 11–14 (two clocks, two when you submit, the photo, the skill). |
| Visual source | `WiringGraph.tsx` frames 0–600 (Classifier node lights, severe-weather-reporting chip appears, photo arrow flies in). At ~10 s in, ConeIllustrative cut for `paraglider.jpg` (2 s overlay during "the phenomenon, the features, the visible signal"). |
| Assets needed | `assets/paraglider.jpg` — already on disk. WiringGraph already exists. |
| Duration | 20 s. |
| Status | **Ready.** ConeIllustrative needs `photoUrl={staticFile("paraglider.jpg")}` and `coneAngleDegrees={SE}` (sailor was upwind; paraglider faces south-southwest off the ridge — tweak in studio). |

### Beat 4 — Wiring middle, reconciliation + memory (1:15–1:40, ~23 s)

| Field | Value |
|---|---|
| Audio sentences | Lines 15–19 (Reconciliation, radar+sat+forecast, agrees/disagrees, memory box, "what other observers nearby saw"). |
| Visual source | `WiringGraph.tsx` frames 600–1300 (Reconciliation node lights, four input chips fly in from right, verified-report card emerges, per-location memory cylinder begins to fill). At ~12 s in, ConeIllustrative cut for `sailor.jpg`. |
| Assets needed | `assets/sailor.jpg` — already on disk. |
| Duration | 23 s. |
| Status | **Ready.** Sailor cone faces north over the Rursee — `coneAngleDegrees={0}` (north). |

### Beat 5 — Wiring middle, the orchestrator (1:40–2:00, ~23 s)

| Field | Value |
|---|---|
| Audio sentences | Lines 20–24 (Deep Researcher when you ask, reads everything, the contributor citation, "it inherits"). |
| Visual source | `WiringGraph.tsx` frames 1300–1950 (Deep Researcher node lights, three skill chips appear, per-user cylinder fills, both arrows feed in, lavender ribbon "Persists across sessions" fades in, answer card emerges). At ~16 s in, ConeIllustrative cut for `andechs.jpg` (foreshadowing Beat 6's full receipt). |
| Assets needed | `assets/andechs.jpg` — already on disk. |
| Duration | 20 s (slight over-trim from script's 23 s if WiringGraph runs short — re-time against actual audio). |
| Status | **Ready.** |

### Beat 6 — The trade (2:00–2:25, ~32 s)

| Field | Value |
|---|---|
| Audio sentences | Lines 25–32 (Doppelbock + Heiliger Berg, Turkish restaurant + waterfall, "one photo, one question, tit for tat"). |
| Visual source | Two `ConeReceipt` cuts (6 s each cadence, but stretched to ~12 s each for full audio fit). First: `andechs.jpg` with `answerProse="The textbook dark Doppelbock... and warned about the cold once the sun drops behind the Heiliger Berg."` — emit the verbatim live-build answer card text if you have it; otherwise paraphrase. Second: `turkey.jpg` with `answerProse="A waterfall eight kilometers away you had not heard of."`. |
| Assets needed | Both photos on disk. **Authentic answer-card prose: pull from the production database for the actual Andechs cohort report and the Turkey cohort report. If unavailable in 5 min, paraphrase to match Script F.** |
| Duration | 32 s. |
| Status | **Ready** with paraphrase fallback. The receipt cadence in `ConeReceipt.tsx` needs `durationInFrames` extension from 180 → ~360 to fit beat duration; pass `coneAngleDegrees` per real cone bearing if known. |

### Beat 7 — Validation (2:25–2:45, ~13 s)

| Field | Value |
|---|---|
| Audio sentences | Lines 33–36 (supervised benchmark, held-out set, thresholds set before runs, honest not perfect). |
| Visual source | **NEW SCENE** — numbers slide. Static layout: "Classifier — supervised benchmark" headline, then 4 large-type metrics (Precision, Recall, F1, n=23) with thresholds-set-in-advance subtitle. **If `eval/runs/2026-04-26/report.json` exists by composition time, populate from it. If not, drop the metric values, keep the methodology framing — the script's narration is honest either way.** |
| Assets needed | If real numbers: read from `eval/runs/2026-04-26/report.json`. If not: blank-template numbers slide with methodology only. |
| Duration | 13 s. |
| Status | **Ready** with honest-fallback. Build the slide as a Remotion component with optional `metrics` prop. |

### Beat 8 — Close (2:45–3:00, ~17 s)

| Field | Value |
|---|---|
| Audio sentences | Lines 37–41 (satellites see continent, people see moment, map composes, smallest gesture, catchphrase). |
| Visual source | Wide map shot from `bavaria-time-travel-cones.MP4` (last few seconds, all cones lit) → fade to title card with VYU logo + catchphrase using the `HelloVYou.tsx` aesthetic (large VYU at center, subtitle "What's in your view." underneath). |
| Assets needed | Already on disk. |
| Duration | 17 s. |
| Status | **Ready.** |

## Audio generation workflow (Block C1 — 30 min)

1. Open [`assets/script-hero.m4a`](assets/script-hero.m4a) in any audio app. Find the cleanest 30 s — natural pace, no background noise. Export as WAV.
2. Upload to 11Labs → Voice Lab → Add Voice → Instant Voice Clone. Name: "Daniel-VYU".
3. For each beat in [`narration-script-2026-04-26.txt`](narration-script-2026-04-26.txt), paste the beat's lines into the 11Labs text-to-speech generator with the cloned voice selected. Generate. Listen. Regenerate any sentence that misreads (numbers, place names — *Heiliger Berg*, *Doppelbock*, *Rursee*).
4. Save each beat as `assets/audio/beat-N.wav`.
5. Concatenate with ffmpeg into `assets/narration-final.wav`:
   ```bash
   cd demo/assets/audio
   ffmpeg -f concat -safe 0 -i <(for f in beat-*.wav; do echo "file '$PWD/$f'"; done) -c copy ../narration-final.wav
   ```
6. Insert 0.8 s silences at the `(pause)` markers in Beat 1, Beat 6, Beat 8 if 11Labs compresses them. ffmpeg or Audacity.
7. Verify total duration: target 180 s ± 5 s. If under, the visual timeline tightens; if over, trim the longest sentence's natural tail.

## Risk register

- **11Labs voice clone reads "VYU" as "vee-why-you" letter-by-letter instead of "view".** Fix: in the script, write `"VYU. What's in your view."` as `"View. What's in your view."` — the rhyme still lands and the model speaks the catchphrase as one word. Apply only to Beat 8's last line.
- **Remotion `<OffthreadVideo>` cannot trim mid-clip cleanly.** Fix: pre-trim screen recordings with ffmpeg into clip files (`zugspitze-clip-beat2.mp4` etc.) and reference those.
- **Numbers slide has no real metrics.** Honest fallback: methodology-only slide. Beat 7 narration does not mention specific numbers if you remove them; the script reads as a methodology claim.
- **Real Andechs/Turkey answer-card prose unavailable.** Honest fallback: paraphrase using Script F's wording. The visual carries the receipt; the prose carries the meaning.

## Composition skeleton

See [`src/Composition.tsx`](src/Composition.tsx) — the master composition wires all 8 beats against the audio track. Open Remotion Studio, load the `Master` composition, drop in the generated `narration-final.wav`, adjust beat timings against actual audio durations, render.

## Next-agent handoff

The next Claude Code session that picks this up reads [`demo/REMOTION-AGENT-PROMPT.md`](REMOTION-AGENT-PROMPT.md). That document is self-contained — it carries the full briefing for an agent that walks in cold.
