-- Invite read-gate (2026-04-25, 30-min hardening sprint before tester send).
--
-- Until now reports, classifications, verified_reports, briefs, and profiles
-- all carried `using (true)` anon-read policies — anyone landing on the public
-- subdomain could read every report. Daniel's stated posture (decision pending
-- formal log entry): the test-cohort can keep the wide-open posture _between
-- testers_, but anyone hitting the URL without an invite must see nothing.
--
-- Implementation:
--   - Drop all anon-read policies. RLS stays enabled so anon has zero access.
--   - Drop the anon-insert policy on reports — submit moves behind submit-report
--     edge function which validates the invite.
--   - Service role bypasses RLS, so all edge functions (list-reports,
--     get-report, submit-report, classify, reconcile, research) keep working.
--
-- Frontend reads now go through invite-gated edge functions. Storage bucket
-- 'photos' stays public-read because photo URLs are unguessable (UUID paths)
-- and are only enumerable through list-reports / get-report which are gated.

drop policy if exists "anon can read reports" on public.reports;
drop policy if exists "anon can insert reports" on public.reports;
drop policy if exists "anon can read classifications" on public.classifications;
drop policy if exists "anon can read verified_reports" on public.verified_reports;
drop policy if exists "anon can read briefs" on public.briefs;
drop policy if exists "anon can read profiles" on public.profiles;
