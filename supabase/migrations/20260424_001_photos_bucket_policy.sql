-- Storage RLS: allow anon uploads to the `photos` bucket.
-- Public buckets give anon READ for free; WRITE still requires an explicit policy.
-- Pre-auth posture matches the `reports` table: anyone with the anon key can
-- upload a photo. Moderation happens downstream via the image moderator agent.

create policy "anon can upload to photos"
  on storage.objects for insert to anon
  with check (bucket_id = 'photos');

create policy "anon can read photos"
  on storage.objects for select to anon
  using (bucket_id = 'photos');
