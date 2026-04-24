-- Rename heading_accuracy_m → location_accuracy_m.
--
-- The column was added intending to store heading/compass accuracy (degrees),
-- but the frontend was populating it with GPS accuracy in metres — the name
-- and the data disagreed. Rename to reflect what's actually stored so
-- downstream consumers (confidence heuristics, analytics) don't mis-read it.
-- A dedicated compass_accuracy_deg column can be added later if needed.

alter table public.reports
  rename column heading_accuracy_m to location_accuracy_m;

-- `create or replace view` refuses to rename an existing column, so drop
-- the view first and recreate it with the new column name.
drop view if exists public.reports_v;

create view public.reports_v
with (security_invoker = true) as
select
  id,
  reporter_id,
  photo_url,
  ST_X(location::geometry) as lon,
  ST_Y(location::geometry) as lat,
  heading_degrees,
  location_accuracy_m,
  captured_at,
  submitted_at,
  caption,
  status
from public.reports;

grant select on public.reports_v to anon;
