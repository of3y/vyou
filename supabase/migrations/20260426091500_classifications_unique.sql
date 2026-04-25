-- Hardened-plan v2 §1 Correction 3 — close the open "+2 used after a fresh
-- capture" bug. classify/index.ts has a TOCTOU pre-check (.maybeSingle then
-- .insert) but no unique constraint, so two concurrent invokes (one from the
-- CaptureFlow fire-and-forget, one from ReportDetail's polling-dispatch) both
-- pass the pre-check, both open paid Anthropic sessions, both insert.
--
-- This migration deduplicates existing rows (keeping the most recent per
-- report_id + agent pair) and adds the unique constraint that should have
-- been there from 20260423120000.

-- 1) dedupe — keep the latest row per (report_id, agent), drop older twins.
delete from public.classifications c
using public.classifications c2
where c.report_id = c2.report_id
  and c.agent = c2.agent
  and c.created_at < c2.created_at;

-- A second pass guards against ties on created_at (rare but possible when two
-- concurrent inserts land in the same millisecond): keep the smaller id.
delete from public.classifications c
using public.classifications c2
where c.report_id = c2.report_id
  and c.agent = c2.agent
  and c.created_at = c2.created_at
  and c.id > c2.id;

-- 2) the durable guard.
alter table public.classifications
  add constraint classifications_report_id_agent_unique unique (report_id, agent);
