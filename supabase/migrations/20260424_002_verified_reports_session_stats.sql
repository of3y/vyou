-- Lane A: verified_reports holds the Reconciliation verdict for a classification.
-- Lane B: session_stats JSONB on classifications persists per-invocation agent + cost receipts.

alter table public.classifications
  add column if not exists session_stats jsonb;

create table public.verified_reports (
  id                uuid primary key default gen_random_uuid(),
  report_id         uuid not null references public.reports(id) on delete cascade,
  classification_id uuid not null references public.classifications(id) on delete cascade,
  radar_frame_url   text,
  verdict           text not null check (verdict in ('match', 'mismatch', 'inconclusive')),
  rationale         text,
  confidence        text check (confidence in ('low', 'medium', 'high')),
  session_stats     jsonb,
  created_at        timestamptz not null default now()
);

create index verified_reports_report_idx on public.verified_reports (report_id);
create index verified_reports_classification_idx on public.verified_reports (classification_id);

alter table public.verified_reports enable row level security;

create policy "anon can read verified_reports"
  on public.verified_reports for select to anon
  using (true);
