-- VYou must-ship schema: reports + classifications.
-- Stretch tables (radar_snapshots, moderations) are deferred.
-- Shape matches docs/02 MVPs/app-design-scaffold.md § Data model.

-- PostGIS types live in the extensions schema; make them resolvable without qualifying every use.
set search_path = public, extensions;

create table public.reports (
  id                   uuid primary key default gen_random_uuid(),
  reporter_id          text not null,
  photo_url            text,
  location             geography(Point, 4326) not null,
  heading_degrees      real not null check (heading_degrees >= 0 and heading_degrees < 360),
  heading_accuracy_m   real,
  captured_at          timestamptz not null,
  submitted_at         timestamptz not null default now(),
  caption              text check (caption is null or char_length(caption) <= 280),
  status               text not null default 'pending'
                         check (status in ('pending', 'accepted', 'rejected', 'review'))
);

create index reports_location_gix on public.reports using gist (location);
create index reports_status_submitted_idx on public.reports (status, submitted_at desc);

create table public.classifications (
  id               uuid primary key default gen_random_uuid(),
  report_id        uuid not null references public.reports(id) on delete cascade,
  agent            text not null check (agent in ('classifier', 'reconciliation')),
  phenomenon       text,
  features         jsonb,
  hail_size_cm     real,
  confidence       text check (confidence in ('low', 'medium', 'high')),
  raw_response_url text,
  created_at       timestamptz not null default now()
);

create index classifications_report_idx on public.classifications (report_id);

-- Row-level security.
-- Pre-auth posture: anonymous browsers hold a local UUID in reporter_id. Anyone with the anon key can
-- post a report and read any report; classifications are readable by anon but only writable by the
-- service role (edge functions), which bypasses RLS.
alter table public.reports enable row level security;
alter table public.classifications enable row level security;

create policy "anon can insert reports"
  on public.reports for insert to anon
  with check (true);

create policy "anon can read reports"
  on public.reports for select to anon
  using (true);

create policy "anon can read classifications"
  on public.classifications for select to anon
  using (true);
