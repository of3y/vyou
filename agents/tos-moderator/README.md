---
agent: tos-moderator
pipeline: moderation
created: 2026-04-22
updated: 2026-04-22
author: VYou
type: reference
tags: [agent, managed-agent, moderation, abuse, spam, spoofing]
skills: []
summary: Watches user-entered captions and submission patterns for abuse, spam, and geographic spoofing. Soft-ban flag for human review, not auto-ban.
---

# TOS / Abuse Moderator

The TOS Moderator watches the text and the pattern rather than the pixels. Input: the user-entered caption for a submission, plus recent submission-pattern signals (rate, geographic jumps that imply spoofing, repeated near-duplicates). Output: accept / soft-flag / route-to-human-review. Persistent offenders are flagged for Daniel's review queue rather than auto-banned — the hackathon submission ships with the guardrail logic in place, not with a live user base that exercises it at scale.

**Status: stub for Day-1 alignment review.** Same open question as the Image Moderator: collapse into one moderation agent or keep as two.
