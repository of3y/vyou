---
agent: image-moderator
surface: messages-api-cached-prefix
pipeline: moderation
created: 2026-04-22
updated: 2026-04-24
author: VYou
type: reference
tags: [agent, messages-api, moderation, nsfw, content-policy]
skills: []
summary: First agent at ingest. Hard-rejects NSFW, graphic-violence, CSAM, and non-weather submissions before any other agent sees the image.
---

# Image Moderator

The Image Moderator is the gate. Input: the submitted photo. Output: accept / hard-reject / flag-for-review, with a class label on reject (NSFW, graphic, non-weather, ambiguous). No other agent sees the photo until Image Moderator accepts it. A community weather platform that can't moderate cannot credibly ship — the Image Moderator is therefore load-bearing for the *Impact* scoring axis, not a footnote.

## Surface — Messages API

Image Moderator runs as a direct Anthropic Messages API call from a Supabase Edge Function, not as a Claude Managed Agent. The policy prompt is short and stable enough that caching pays for itself across calls without needing a separate skill bundle.

**Why not a CMA.** The moderator is a binary-ish classifier on the synchronous ingestion path — the user is waiting for "accept" before anything else happens. Moderator gates are the canonical example of where CMA cold-start latency is the wrong tradeoff: no session state needed, no memory attachment adds value, the call is small and fast.

## Status — stub

Threshold tuning happens early on Day 2 against Daniel's own storm archive; if it blocks his real photos, the threshold is wrong. The open question "does this collapse with the TOS Moderator into a single moderation agent?" stays open — the two agents watch different signals (pixels vs text + pattern) and collapse would probably reduce clarity, but it is a cheap re-open if the duplicated prompt overhead shows up.
