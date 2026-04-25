-- Deep Researcher cut-back-gate landing migration (Worker A, 2026-04-25).
--
-- Two surfaces:
--   1. briefs — the persisted DR output. One row per /research call. Cited
--      sources land in jsonb so the UI can render a sources block without a
--      second round trip.
--   2. profiles — minimal row per reporter_id (the anonymous browser-UUID
--      identity used by reports.reporter_id). Carries the Earn-a-Question
--      ledger. We cannot use Supabase auth here — the cohort still browses
--      anon — so the ledger keys on reporter_id, the same string already in
--      reports.reporter_id.
--
-- Earn-a-Question loop: a verified report (verdict='match') grants a question
-- token; asking DR consumes one. The verdict enum has no 'partial', so the
-- trigger fires on 'match' only — the brief listed match/partial but the
-- schema only carries match/mismatch/inconclusive (see
-- 20260424120100_verified_reports_session_stats.sql).

create table if not exists public.profiles (
  reporter_id      text primary key,
  questions_earned int not null default 0,
  questions_used   int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anon reads its own ledger via reporter_id filter; the client never trusts
-- another reporter's row. Insert/update happens only through service role.
create policy "anon can read profiles"
  on public.profiles for select to anon
  using (true);

create table if not exists public.briefs (
  id                 uuid primary key default gen_random_uuid(),
  report_id          uuid not null references public.reports(id) on delete cascade,
  verified_report_id uuid references public.verified_reports(id) on delete set null,
  reporter_id        text,
  question           text not null,
  content            text not null,
  sources            jsonb,
  session_stats      jsonb,
  created_at         timestamptz not null default now()
);

create index briefs_report_idx on public.briefs (report_id);
create index briefs_reporter_idx on public.briefs (reporter_id);

alter table public.briefs enable row level security;

create policy "anon can read briefs"
  on public.briefs for select to anon
  using (true);

-- Trigger: on a 'match' verdict landing in verified_reports, increment
-- questions_earned for the report's reporter. Idempotent on the unique
-- constraint verified_reports(classification_id) — a re-run of /reconcile
-- returns the cached row without firing this trigger again.

create or replace function public.grant_question_for_match()
returns trigger
language plpgsql
security definer
as $$
declare
  v_reporter text;
begin
  if new.verdict <> 'match' then
    return new;
  end if;

  select reporter_id into v_reporter
    from public.reports
    where id = new.report_id;

  if v_reporter is null then
    return new;
  end if;

  insert into public.profiles (reporter_id, questions_earned, questions_used)
    values (v_reporter, 1, 0)
    on conflict (reporter_id) do update
      set questions_earned = public.profiles.questions_earned + 1,
          updated_at = now();

  return new;
end;
$$;

drop trigger if exists verified_reports_grant_question on public.verified_reports;
create trigger verified_reports_grant_question
  after insert on public.verified_reports
  for each row execute function public.grant_question_for_match();
