-- Public storage bucket for cached MTG (EUMETSAT FCI / LI) tiles.
-- The mtg-tile edge function fetches upstream WMS tiles and writes them here
-- once per (layer, time-bucket, z, x, y); subsequent requests serve from cache,
-- collapsing N viewers into 1 upstream request and side-stepping EUMETSAT's
-- 20-req-per-window rate limit.

insert into storage.buckets (id, name, public)
values ('mtg-tiles', 'mtg-tiles', true)
on conflict (id) do nothing;

create policy "anon can read mtg-tiles"
  on storage.objects for select to anon
  using (bucket_id = 'mtg-tiles');
