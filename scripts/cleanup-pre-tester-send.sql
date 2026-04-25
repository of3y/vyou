-- One-shot cleanup before the tester send (2026-04-25, ~12:30 Europe/Berlin).
--
-- Drops Daniel's solo dogfooding entries from yesterday so testers land into a
-- clean cohort dataset. Cutoff: anything inserted/captured before 2026-04-25
-- 00:00 Europe/Berlin (= 2026-04-24T22:00:00Z). The first real tester's
-- submission landed this morning so it survives the cutoff.
--
-- Run via: psql or Supabase SQL editor. Cascades follow the FKs:
--   reports → classifications (cascade) → verified_reports (FK)
--   reports → briefs (cascade)
-- profiles is not cascaded — we recompute it from scratch below to avoid
-- stale questions_earned counts that no longer have a backing match.
--
-- Sanity-check first:
--   select count(*) from reports where submitted_at < '2026-04-24T22:00:00Z';
-- Then run.

begin;

-- 1. Reports + dependent rows (classifications, verified_reports, briefs)
--    cascade through ON DELETE CASCADE.
delete from public.reports
  where submitted_at < timestamptz '2026-04-24T22:00:00Z';

-- 2. Recompute profiles.questions_earned from the remaining verified_reports.
--    questions_used we leave alone — it tracks Ask events which aren't tied to
--    a deleted match.
update public.profiles p
   set questions_earned = coalesce(sub.cnt, 0),
       updated_at = now()
  from (
    select r.reporter_id, count(*)::int as cnt
      from public.verified_reports vr
      join public.reports r on r.id = vr.report_id
     where vr.verdict = 'match'
     group by r.reporter_id
  ) sub
 where p.reporter_id = sub.reporter_id;

-- 3. Drop profiles whose backing reports are all gone AND who never used a
--    question. Keeps the table tidy without touching anyone with state.
delete from public.profiles p
 where not exists (select 1 from public.reports r where r.reporter_id = p.reporter_id)
   and p.questions_used = 0;

-- 4. Storage objects for deleted reports remain in the photos bucket. They
--    are unreachable without a reports row to hand out the URL, but we'll
--    sweep them in a follow-up if disk grows. (Cheap to do later, not on the
--    critical path before the tester send.)

commit;

-- Verify:
--   select count(*) from reports;
--   select count(*) from classifications;
--   select count(*) from verified_reports;
--   select count(*) from briefs;
--   select * from profiles;
