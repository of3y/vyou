-- Diagnose why the bell (questions_earned badge on the Ask FAB) isn't showing
-- after a fresh photo submission.
--
-- HOW TO USE
-- 1. Open the Supabase dashboard → SQL Editor (https://supabase.com/dashboard).
-- 2. Pick the `vyou-hackathon` project.
-- 3. New query.
-- 4. Run each numbered block on its own (highlight the block + cmd-enter,
--    or paste the block alone and click Run). Read the rows it returns
--    before moving on — each block answers one specific failure mode.
--
-- The five blocks walk the chain end-to-end:
--   submit → classify → reconcile → trigger → profile
-- The first block that returns an empty result or an unexpected value is
-- the broken link.

-- ============================================================
-- BLOCK 1 — last 5 reports. Confirms a submission landed at all
-- and gives you the report_id + reporter_id used by later blocks.
-- ============================================================
select
  id            as report_id,
  reporter_id,
  status,
  caption,
  captured_at,
  submitted_at
from public.reports
order by submitted_at desc
limit 5;


-- ============================================================
-- BLOCK 2 — classification for your most recent report.
-- Expectations:
--   safe = true        (else the report is rejected and reconcile is skipped)
--   phenomenon ≠ 'out_of_scope' AND ≠ 'tester_selfie'
--                      (else reconcile is deliberately skipped)
-- If this row is missing entirely, classify never ran.
-- ============================================================
select
  c.id            as classification_id,
  c.report_id,
  c.phenomenon,
  c.confidence,
  c.safe,
  c.created_at
from public.classifications c
where c.report_id = (select id from public.reports order by submitted_at desc limit 1)
  and c.agent = 'classifier';


-- ============================================================
-- BLOCK 3 — verified row for that classification.
-- Expectations:
--   row exists         (else reconcile never landed — most common failure)
--   verdict = 'match'  (else no question is granted; bell stays empty)
-- 'inconclusive' is a valid honest answer when radar is sparse — the
-- pipeline is fine but you need a submission window where DWD radar
-- shows precip overlapping the cone, otherwise the demo can't earn a
-- question on this submission.
-- ============================================================
select
  v.id            as verified_report_id,
  v.classification_id,
  v.report_id,
  v.verdict,
  v.confidence,
  v.created_at
from public.verified_reports v
where v.report_id = (select id from public.reports order by submitted_at desc limit 1);


-- ============================================================
-- BLOCK 4 — your profile ledger for the most-recent submission's reporter.
-- Expectations:
--   questions_earned > questions_used   (else the badge can't appear)
-- If verdict='match' landed in BLOCK 3 but questions_earned didn't ratchet,
-- the trigger isn't installed (BLOCK 5 confirms).
-- ============================================================
select
  p.reporter_id,
  p.questions_earned,
  p.questions_used,
  p.questions_earned - p.questions_used as available,
  p.updated_at
from public.profiles p
where p.reporter_id = (
  select reporter_id from public.reports order by submitted_at desc limit 1
);


-- ============================================================
-- BLOCK 4b — were the older reports classified at all? Some of today's
-- ~5 submissions may never have been classified, which would also
-- block reconcile (and therefore the bell). This lists each of today's
-- reports together with whether a classification + verified row exist.
-- Expectations: each accepted report has a classification; the
-- non-skipped phenomena (anything except out_of_scope/tester_selfie)
-- also have a verified_reports row.
-- ============================================================
select
  r.id                                  as report_id,
  r.status,
  r.captured_at,
  c.phenomenon,
  c.safe,
  v.verdict,
  case
    when c.id is null                                then 'classify never ran'
    when c.safe = false                              then 'rejected — reconcile skipped by design'
    when c.phenomenon in ('out_of_scope','tester_selfie')
                                                     then 'phenomenon skipped — reconcile skipped by design'
    when v.id is null                                then 'reconcile never landed a verdict'
    when v.verdict = 'match'                         then 'match — should have granted a question'
    else                                                 'verdict ' || v.verdict || ' — no question by design'
  end                                   as diagnosis
from public.reports r
left join public.classifications c
  on c.report_id = r.id and c.agent = 'classifier'
left join public.verified_reports v
  on v.classification_id = c.id
where r.captured_at >= current_date
order by r.submitted_at desc;


-- ============================================================
-- BLOCK 4c — invite-cap check. classify and reconcile each consume
-- one invite use. If the cohort token is exhausted, reconcile returns
-- 429 and the auto-fire silently fails. Expectations: used < max_uses.
-- ============================================================
select
  token,
  used,
  max_uses,
  max_uses - used as remaining,
  expires_at
from public.invites
order by used desc;


-- ============================================================
-- BLOCK 5 — confirm the trigger that grants a question is installed.
-- Expectations: exactly one row, named verified_reports_grant_question.
-- If empty, paste the trigger from
--   supabase/migrations/20260425094245_briefs_and_question_ledger.sql
--   (lines 56–94, the create-function + create-trigger block)
-- into the SQL editor.
-- ============================================================
select
  t.tgname        as trigger_name,
  c.relname       as on_table,
  p.proname       as function_name
from pg_trigger t
join pg_class    c on c.oid = t.tgrelid
join pg_proc     p on p.oid = t.tgfoid
where t.tgname = 'verified_reports_grant_question'
  and not t.tgisinternal;
