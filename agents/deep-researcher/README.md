---
agent: deep-researcher
pipeline: personalized-report
created: 2026-04-22
updated: 2026-04-22
author: VYou
type: reference
tags: [agent, managed-agent, deep-researcher, personalized-briefing, citations]
skills: [severe-weather-reporting, radar-and-satellite-reference, prior-art-scan]
summary: On a user query with location, radius, and context, aggregates recent community reports, radar, satellite, forecast, and warnings into a citable briefing. Also independently re-validates upstream's pre-hackathon research from within the VYou stack.
---

# Deep Researcher

The Deep Researcher is VYou's user-facing second product goal. Input: a natural-language question with location, radius, and a stated plan (*"bike ride from Ottobrunn to Tegernsee in the next four hours, any cells on the way?"*). Output: a readable briefing that aggregates recent community reports, the radar time-series, the satellite snapshots, the point forecast, and the warning feed — with citations back to each. Cites all three shipped skills.

The same agent does a second job: it independently re-validates the pre-hackathon research produced in the upstream vault, querying the VYou stack for each load-bearing claim so the submission closes its own research loop transparently. upstream's findings enter the VYou `docs/` folder only after the Deep Researcher re-confirms them.

**Status: stub for Day-1 alignment review.** Open question: does this agent substrate-share with Reconciliation (both write narratives from similar inputs), or stay fully separate so user queries never contaminate the ingestion pipeline? Default is separate.
