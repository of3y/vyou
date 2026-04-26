-- Memory Box mapping table.
-- Anthropic's memoryStores.create() returns a server-assigned opaque id
-- (memstore_<...>); the caller cannot pre-specify a vanity id. So semantic
-- keys (loc:<geohash6>, user:<reporter_uuid>) are mapped to the opaque
-- store_id in Postgres, looked up at session-create time by reconcile and
-- research.
--
-- Also persisted: the store NAME, because the Managed Agents runtime mounts
-- the store at /mnt/memory/<name>/ inside the agent's container — that path
-- is what the agent reads via its read tool, and is auto-derived from the
-- name (mount_path is not user-settable on memory_store resources). The
-- name is therefore load-bearing for the per-mount system-prompt
-- instructions string.
--
-- Service role only; anon has no read access. The store ids and names are
-- not user-facing.

-- reporter_id is `text` here to match the rest of the schema —
-- public.reports.reporter_id, public.profiles.reporter_id, and
-- public.briefs.reporter_id are all text. The runtime value is a
-- UUID-shaped string from getReporterId() / crypto.randomUUID(), but the
-- column type stays text so an implicit cast can never fail at insert time
-- and the schema reads consistently.
create table if not exists public.memstore_map (
  key          text        primary key,
  store_id     text        not null unique,
  store_name   text        not null,
  scope        text        not null check (scope in ('location', 'user')),
  geohash6     text,
  reporter_id  text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint memstore_map_scope_fields check (
    (scope = 'location' and geohash6 is not null and reporter_id is null)
    or (scope = 'user' and reporter_id is not null and geohash6 is null)
  )
);

create index if not exists memstore_map_geohash6_idx on public.memstore_map (geohash6) where geohash6 is not null;
create index if not exists memstore_map_reporter_id_idx on public.memstore_map (reporter_id) where reporter_id is not null;

alter table public.memstore_map enable row level security;
