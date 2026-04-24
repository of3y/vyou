-- Hardening pass after the Lane A+B adversarial review (2026-04-24).
-- Two concerns addressed here:
--   1. Idempotency: the non-idempotent /reconcile path could write duplicate
--      verified_reports rows from React StrictMode double-invokes or tab
--      refreshes. Adding a unique constraint on classification_id + teaching
--      the edge function to return the existing row closes that loop.
--   2. Anon cost-amplification: /classify and /reconcile both open paid
--      Anthropic sessions on unauthenticated POSTs. The invites table lets
--      us require a cohort-bound token without introducing full auth.

alter table public.verified_reports
  add constraint verified_reports_classification_id_unique unique (classification_id);

create table if not exists public.invites (
  token        text primary key,
  label        text,
  used         int  not null default 0,
  max_uses     int  not null default 50,
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- Service role bypasses RLS; anon has no policy, so anon cannot read or mutate
-- invites directly. All invite validation happens inside the edge functions.
alter table public.invites enable row level security;
