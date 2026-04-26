---
title: Briefing for the Remotion-finishing agent
created: 2026-04-26
updated: 2026-04-26
author: VYou
type: mvp
tags: [demo, remotion, agent-prompt, handoff]
related:
  - "[[recording-shotlist-2026-04-26]]"
  - "[[narration-script-2026-04-26]]"
  - "[[demo-script-F-polished]]"
summary: Self-contained briefing for the next Claude Code session that finishes the VYou demo video. Reads cold; assumes no prior conversation context. Drop the entire content of this file into the prompt.
---

# Briefing for the Remotion-finishing agent

Paste this entire document into your prompt to the next Claude Code session. The agent reads cold — no prior conversation context is assumed. Edit the *operator state* section at the bottom with the current state when you hand off.

---

## Mission

Finish the VYou demo video. Submission deadline: 2026-04-26 20:00 EST. Runtime target: 180 seconds at 30 fps, 1920×1080. Output: a single MP4 in `demo/renders/final-2026-04-26.mp4` plus an unlisted YouTube upload, linked from the repo root README.

You are not authoring the script, the narration, or the visual design — those are locked. You are wiring the existing Remotion composition (`demo/src/Composition.tsx`, exported as the `Master` Remotion composition id) against the generated narration audio and the assets on disk in `demo/assets/`, then iterating against playback until it matches the script's beat timing, then rendering.

## Working tree state at handoff

Read in order before starting:

1. `docs/demo-script-F-polished.md` — the locked script. Your composition narrates this. **Do not rewrite it.** If a beat needs visual adjustment, adjust the visual; do not adjust the narration.
2. `demo/recording-shotlist-2026-04-26.md` — beat-by-beat mapping of script to assets. This is the work-order spec.
3. `demo/narration-script-2026-04-26.txt` — the cleaned TTS-input file the operator generated narration from.
4. `demo/src/Composition.tsx` — the master composition skeleton. Already wires 8 sequences with beat-numbered components, audio track loaded from `staticFile("narration-final.wav")`, frame-precise timings derived from the script.
5. `demo/src/WiringGraph.tsx`, `demo/src/ConeIllustrative.tsx`, `demo/src/ConeReceipt.tsx` — existing scene components. Used as building blocks by the master composition; do not need rewriting.
6. `demo/src/Root.tsx` — the Remotion composition registry. The `Master` composition is already registered.
7. `CLAUDE.md` (repo root) — repo operating rules, end-of-task ritual, commit philosophy. Adhere to all of it. Daniel pre-authorized end-of-task commits and pushes for this repo.

## What is already done

- Voice clone produced from `demo/assets/script-hero.m4a` via 11Labs (or Voicebox); narration generated beat by beat from `narration-script-2026-04-26.txt`; concatenated to `demo/assets/narration-final.wav`. *If this file does not exist when you start, see "Operator state" below — it may still be in flight.*
- Six live-build screen recordings in `demo/assets/`: `zugspitze-add-cone.MP4` (capture flow), `bavaria-time-travel-cones.MP4` (map wide), `cyclist-cone.MP4`, `sailor-cone.MP4`, `turkey-cone.MP4`, `metric-imperial-with-error.MP4`.
- Four photos in `demo/assets/`: `andechs.jpg`, `paraglider.jpg`, `sailor.jpg`, `turkey.jpg`.
- Master composition skeleton with 8 beats, audio-track-driven, frame timings keyed to script's beat targets.

## What you need to do, in order

### 1. Verify narration-final.wav exists and matches expected duration

```bash
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 demo/assets/narration-final.wav
```

Expected: ~180 seconds, ±5. If significantly off, beat timings in `Composition.tsx` need re-keying — the `BEATS` constant at the top of the file controls every sequence's `from` and `durationInFrames`. Re-derive each beat's start time from the actual audio waveform: open `narration-final.wav` in any audio app, mark the start time of each beat (sentence sequences are clearly separated), update the `BEATS` object's `from` values to match (in seconds, the `s()` helper converts to frames).

If `narration-final.wav` does not exist, **stop and surface this to the operator**. The audio is the load-bearing input; do not invent silence as a substitute.

### 2. Fetch the Blue Marble image for Beat 1

NASA Blue Marble is public domain. Download a high-resolution Earth image and save to `demo/assets/blue-marble.jpg`. Either:

- The classic *Blue Marble 2002* from NASA Visible Earth (search Visible Earth for *Blue Marble 2002 Land Surface*).
- Or a recent EUMETSAT MTG full-disc visible image (this is the more thematically apt choice — VYU is built on MTG data — but verify license).
- Fallback: any public-domain Earth-from-space image with Europe visible.

Crop or scale to ≥1920×1080. The Beat 1 component (`Beat1ColdOpen` in `Composition.tsx`) does a slow Ken-Burns zoom from 1.0× to 1.18×, centered on Europe. Crop the image so Europe sits at the center-45% of the frame.

### 3. Pre-trim large screen recordings if needed

`zugspitze-add-cone.MP4` is 185 MB. Remotion's `<OffthreadVideo>` can play full files but iteration in Remotion Studio will be slow. Pre-trim to the segments you actually use:

```bash
cd demo/assets
ffmpeg -i zugspitze-add-cone.MP4 -ss 00:00:00 -t 00:00:15 -c copy zugspitze-clip-beat2.mp4
ffmpeg -i bavaria-time-travel-cones.MP4 -ss 00:00:00 -t 00:00:25 -c copy bavaria-clip-beat2-beat8.mp4
```

Then update `Composition.tsx` to reference the trimmed clips.

### 4. Open Remotion Studio and iterate against playback

```bash
cd demo
npm run start
```

Studio opens in a browser. Select the **Master** composition. Play through. Note:

- Does each beat's visual transition land where the narration says the beat-pivot word? *"Behind every cone, three Claude Managed Agents"* — the Classifier node should light as Daniel's voice says *"three Claude Managed Agents"*.
- Are the cone-illustrative cuts (Beats 3, 4, 5) timed to land on the narrated *"the photo / the radar / what other observers nearby saw / the contributor"* — not arbitrarily?
- Is the Beat 6 cone-receipt cadence (~12 s for Andechs, ~16 s for Turkey) holding the answer card on screen long enough to read at 1920×1080?
- Does the Beat 8 close transition from wide map to title card land on the catchphrase delivery?

For each mismatch, adjust the local-frame timings inside the beat component (e.g. `Beat3PhotoCut`'s `inIllustrative = frame >= s(10) && frame < s(13)` window). Do not adjust the `BEATS` top-level constants unless the audio itself is misaligned.

### 5. Beat 7 — populate metrics if eval/runs has a 2026-04-26 report.json

Check `eval/runs/`. If a `2026-04-26/report.json` exists with `precision`, `recall`, `f1`, `n` fields, parse it and pass as a prop to the `Beat7Validation` component (already supports the `metrics` prop). If not, the component falls back to a methodology-only slide that matches the script's narration honestly.

### 6. Render

```bash
cd demo
npm run render
```

Output: `demo/renders/draft-2026-04-26-HHMM.mp4`. Watch end-to-end at full speed on a real device (not just in Studio preview). One round of fix-and-re-render allowed. Final render: rename to `final-2026-04-26.mp4`.

### 7. Upload + integrate

- Upload `final-2026-04-26.mp4` to YouTube as **unlisted** (the canonical hackathon submission format).
- Add a "Watch the demo" link block at the top of repo-root `README.md`, with the YouTube URL and a poster screenshot if time permits.
- Land a `feat(demo): final cut + YouTube link` commit per the commit philosophy in `CLAUDE.md`.
- Append today's daily-note in `docs/00 Inbox/daily/2026-04-26.md` with a real-clock timestamped entry covering the recording.
- If a noteworthy moment lands during recording (an unexpected delivery beat, a render glitch and recovery), add to `docs/noteworthy-moments.md`.

### 8. Submit

Submit the entry on the hackathon platform with the YouTube URL, the public repo URL (flip repo to public per `CLAUDE.md`'s public-flip hygiene), and a one-paragraph project description sourced from the README's opening paragraphs.

## Constraints — do not violate

- **Do not rewrite the script.** Script F is locked. Visual changes accommodate audio; audio does not change to fit visuals.
- **Do not add new product features.** Polishing the live build during recording is forbidden — every minute spent on the app is a minute not spent on the video.
- **Do not invent metric numbers for Beat 7.** If `eval/runs/2026-04-26/report.json` does not exist, use the methodology-only fallback. The script's narration ("we claim it is honest") is honest only if the numbers — when shown — are real.
- **Do not commit `node_modules` or `out/` Remotion intermediate artifacts.** Only commit the final MP4 to `renders/` and the source updates.
- **Do not push to `main` until the render passes a full end-to-end watch.** A broken video on `main` at submission time is worse than a delayed merge.
- **Do not skip the end-of-task ritual.** Decision-log append, simplification pass, commit-and-push, memory update if a new how-we-work rule emerges, then surface the close-out line.

## If you get stuck

- Audio out of sync: re-key `BEATS` constants in `Composition.tsx` from actual waveform timings.
- Render crashes: check Remotion logs in terminal for codec errors; common fix is `--codec=h264` flag override in `npm run render`.
- Asset file missing: surface to operator; do not substitute a placeholder in the final cut.
- Beat 6 cone-receipt cadence too short: extend the inner `ConeReceipt` component's `durationInFrames` registration (it currently registers at 180 frames, may need 360+ for full Beat 6 fit). Update `Root.tsx` registration if changing.
- 11Labs voice clone reads VYU as letters, not as "view": the operator was supposed to handle this in the script (Beat 8 last line written as "View. What's in your view."). If the existing audio still misreads, ask the operator to regenerate that one line.
- Time runs out before final render: ship the latest draft as the submission. *A submitted draft beats an unsubmitted final cut.*

## Operator state at handoff

> **(Operator: edit this section before pasting the prompt to the next agent.)**
>
> - Narration audio status: **[exists / in flight / not started]**
> - Blue Marble image status: **[on disk / to fetch]**
> - eval/runs/2026-04-26/report.json status: **[exists / not yet]**
> - Pre-trimmed video clips status: **[on disk / to produce]**
> - Hours remaining to deadline: **[X]**
> - Operator can be reached during the work: **[yes / no — async by default]**
> - One-line context: *e.g., "On the road for 1 hour. Voice clone in progress in another tab. Pick up audio file from `demo/assets/narration-final.wav` when it lands. Render and upload."*

---

## Commit message template

When the work lands:

```
feat(demo): final cut for hackathon submission

8-beat composition wired against TTS-cloned narration; assets sourced from
demo/assets/ (4 cohort photos, 6 live-build screen recordings, 1 NASA Blue
Marble for cold-open). Master composition runs 180 s at 30 fps, 1920×1080.
YouTube unlisted: <URL>. README updated with watch link.

Decision-log entry: 2026-04-26 — demo final cut shipped.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
