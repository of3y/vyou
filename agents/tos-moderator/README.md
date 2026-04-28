---
agent: tos-moderator
surface: messages-api-cached-prefix
pipeline: moderation
created: 2026-04-22
updated: 2026-04-24
author: VYou
type: reference
tags: [agent, messages-api, moderation, abuse, spam, spoofing]
skills: []
summary: Watches user-entered captions and submission patterns for abuse, spam, and geographic spoofing. Soft-ban flag for human review, not auto-ban.
---

# TOS / Abuse Moderator

The TOS Moderator watches the text and the pattern rather than the pixels. Input: the user-entered caption for a submission, plus recent submission-pattern signals (rate, geographic jumps that imply spoofing, repeated near-duplicates). Output: accept / soft-flag / route-to-human-review. Persistent offenders are flagged for Daniel's review queue rather than auto-banned — the hackathon submission ships with the guardrail logic in place, not with a live user base that exercises it at scale.

## Surface — Messages API

TOS Moderator runs as a direct Anthropic Messages API call from a Supabase Edge Function, not as a Claude Managed Agent. Reads the per-user store via a tool call when a rate / pattern signal matters, rather than attaching the store as a session resource.

**Why not a CMA.** Same shape as the Image Moderator — binary-ish classifier on the synchronous submission path, latency-sensitive, no session-state continuity worth the cold-start cost. Reading the per-user store via a tool call (rather than attaching it as a session resource) is cheaper here because the moderator only needs a small slice (recent-submission-rate, prior-flag-count) rather than the full store.

## Status — stub

Same open question as the Image Moderator — collapse into one moderation agent or keep as two. The two agents watch different signals; collapse is a cheap re-open if the duplicated prompt overhead matters.
