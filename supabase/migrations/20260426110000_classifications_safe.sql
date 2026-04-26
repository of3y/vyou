-- Hardened-plan v2 §2 Fix C — moderation surface on the classifier output.
-- The classifier returns a `safe: boolean` flag that the UI uses to show a
-- distinct "couldn't add this photo, try a clearer view of the sky" toast
-- instead of letting an unfit submission appear on the shared map. Also
-- gates the classify→reconcile auto-fire so we don't burn a paid session
-- on rejected content.
--
-- Strictly additive. Defaults to `true` so all existing rows keep their
-- current behaviour (every prior submission was implicitly safe under the
-- pre-Fix-C agent shape). Back-compat for the not-yet-redeployed agent:
-- classify/index.ts treats a missing `safe` field as `true`.

alter table public.classifications
  add column if not exists safe boolean not null default true;
