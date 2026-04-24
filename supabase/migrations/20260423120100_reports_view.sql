-- Expose lon/lat as scalars so the client doesn't have to parse PostGIS WKB.
-- security_invoker=true makes the view honor the underlying table's RLS.
create or replace view public.reports_v
with (security_invoker = true) as
select
  id,
  reporter_id,
  photo_url,
  ST_X(location::geometry) as lon,
  ST_Y(location::geometry) as lat,
  heading_degrees,
  heading_accuracy_m,
  captured_at,
  submitted_at,
  caption,
  status
from public.reports;

grant select on public.reports_v to anon;
