-- Hardened-plan v2 Fix A — append-only report_context.
--
-- Captures the weather-state references at submission time so the verified-
-- report card and the post-Reconciliation brief have a stable, auditable
-- weather snapshot — even after the live radar rolls forward.
--
-- Append-only on (report_id, source, captured_at_ingest): each fetch lands
-- as one row; readers take the most recent per source; future Memory Box
-- queries can read the time series. No unique constraint — by design.

create table public.report_context (
  id                  uuid primary key default gen_random_uuid(),
  report_id           uuid not null references public.reports(id) on delete cascade,
  source              text not null
                        check (source in ('open_meteo', 'radolan', 'mtg_ir', 'mtg_li')),
  frame_url           text,
  frame_time_iso      timestamptz,
  payload             jsonb,
  captured_at_ingest  timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index report_context_report_source_idx
  on public.report_context (report_id, source, captured_at_ingest desc);

alter table public.report_context enable row level security;

-- Anon can read (the verified-report card surfaces these chips); only the
-- service role writes via the submit-report / reconcile / research edge
-- functions. Same posture as classifications.
create policy "anon can read report_context"
  on public.report_context for select to anon
  using (true);
