-- Hardened-plan v2 §1 Correction 3 — close the open "+2 used after a fresh
-- capture" bug. classify/index.ts has a TOCTOU pre-check (.maybeSingle then
-- .insert) but no unique constraint, so two concurrent invokes (one from the
-- CaptureFlow fire-and-forget, one from ReportDetail's polling-dispatch) both
-- pass the pre-check, both open paid Anthropic sessions, both insert.
--
-- This migration is non-destructive: it does NOT delete duplicate rows. If
-- duplicates exist from the pre-fix period the ALTER will fail with a clear
-- message; run the diagnostic in scripts/db/classifications_dedupe_dryrun.sql
-- first to inspect, then dedupe explicitly before re-applying.

alter table public.classifications
  add constraint classifications_report_id_agent_unique unique (report_id, agent);
