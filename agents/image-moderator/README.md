---
agent: image-moderator
pipeline: moderation
created: 2026-04-22
updated: 2026-04-22
author: VYou
type: reference
tags: [agent, managed-agent, moderation, nsfw, content-policy]
skills: []
summary: First agent at ingest. Hard-rejects NSFW, graphic-violence, CSAM, and non-weather submissions before any other agent sees the image.
---

# Image Moderator

The Image Moderator is the gate. Input: the submitted photo. Output: accept / hard-reject / flag-for-review, with a class label on reject (NSFW, graphic, non-weather, ambiguous). No other agent sees the photo until Image Moderator accepts it. A community weather platform that can't moderate cannot credibly ship — the Image Moderator is therefore load-bearing for the *Impact* score, not a footnote.

**Status: stub for Day-1 alignment review.** Threshold tuning happens early on Day 2 against Daniel's own storm archive; if it blocks his real photos, the threshold is wrong. Open question: does this collapse with the TOS Moderator into a single moderation agent, or stay as two narrow agents?
