// Memory Box helper used by reconcile + research. Maps semantic keys
// (loc:<geohash6>, user:<reporter_uuid>) to Anthropic-assigned opaque store
// ids via the public.memstore_map table.
//
// Returns both the opaque store_id (for session-create resources[]) AND the
// store name (because Managed Agents mounts the store at
// /mnt/memory/<name>/ — that path is what the agent reads, and is
// auto-derived from the name; mount_path is not user-settable on
// memory_store resources).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type Anthropic from "npm:@anthropic-ai/sdk@0.91.0";

export interface EnsureMemstoreResult {
  store_id: string;
  store_name: string;
  mount_path: string; // /mnt/memory/<store_name>
}

const GEOHASH_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

// Standard base32 geohash. Precision 6 ≈ 1.2km × 0.6km — the audit's chosen
// cell size for the per-location memory bucket.
export function geohash6(lat: number, lon: number): string {
  let latRange: [number, number] = [-90, 90];
  let lonRange: [number, number] = [-180, 180];
  let bits = 0;
  let bit = 0;
  let evenBit = true;
  let hash = "";
  while (hash.length < 6) {
    if (evenBit) {
      const mid = (lonRange[0] + lonRange[1]) / 2;
      if (lon >= mid) { bits = (bits << 1) | 1; lonRange[0] = mid; }
      else { bits = bits << 1; lonRange[1] = mid; }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat >= mid) { bits = (bits << 1) | 1; latRange[0] = mid; }
      else { bits = bits << 1; latRange[1] = mid; }
    }
    evenBit = !evenBit;
    bit++;
    if (bit === 5) {
      hash += GEOHASH_BASE32[bits];
      bits = 0;
      bit = 0;
    }
  }
  return hash;
}

export async function ensureLocationMemstore(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  args: { lat: number; lon: number },
): Promise<EnsureMemstoreResult> {
  const cell = geohash6(args.lat, args.lon);
  return ensure({
    supabase,
    anthropic,
    key: `loc:${cell}`,
    scope: "location",
    desiredName: `loc-${cell}`,
    description: `Per-cell rolling baseline for geohash6=${cell}`,
    geohash6: cell,
    reporter_id: null,
  });
}

export async function ensureUserMemstore(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  args: { reporter_id: string },
): Promise<EnsureMemstoreResult> {
  return ensure({
    supabase,
    anthropic,
    key: `user:${args.reporter_id}`,
    scope: "user",
    desiredName: `user-${args.reporter_id}`,
    description: "Per-user history, declared goals, accuracy track record. NO raw photos, captions, or IPs.",
    geohash6: null,
    reporter_id: args.reporter_id,
  });
}

interface EnsureArgs {
  supabase: SupabaseClient;
  anthropic: Anthropic;
  key: string;
  scope: "location" | "user";
  desiredName: string;
  description: string;
  geohash6: string | null;
  reporter_id: string | null;
}

async function ensure(a: EnsureArgs): Promise<EnsureMemstoreResult> {
  const { data: existing, error: selErr } = await a.supabase
    .from("memstore_map")
    .select("store_id, store_name, scope")
    .eq("key", a.key)
    .maybeSingle();
  if (selErr) throw new Error(`memstore_map select for ${a.key}: ${selErr.message}`);

  if (existing) {
    // Same trap the audit's Correction 1 corrects for reconcile: an
    // unawaited outbound call on Supabase Deno Deploy may be dropped after
    // the parent function returns. Wrap in EdgeRuntime.waitUntil so the
    // PATCH survives the response.
    const lastSeenUpdate = a.supabase
      .from("memstore_map")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("key", a.key)
      .then(({ error }) => {
        if (error) console.warn(`[memstore] last_seen_at update failed for ${a.key}: ${error.message}`);
      });
    try {
      // deno-lint-ignore no-explicit-any
      const er = (globalThis as any).EdgeRuntime;
      if (er?.waitUntil) er.waitUntil(lastSeenUpdate);
      else await lastSeenUpdate;
    } catch {
      await lastSeenUpdate;
    }
    return {
      store_id: existing.store_id as string,
      store_name: existing.store_name as string,
      mount_path: `/mnt/memory/${existing.store_name as string}`,
    };
  }

  const created = await a.anthropic.beta.memoryStores.create({
    name: a.desiredName,
    description: a.description,
  });

  const { error: insErr } = await a.supabase
    .from("memstore_map")
    .insert({
      key: a.key,
      store_id: created.id,
      store_name: created.name,
      scope: a.scope,
      geohash6: a.geohash6,
      reporter_id: a.reporter_id,
    });
  if (insErr) {
    // Race: another invocation just landed the same key. Fall back to read.
    if (insErr.code === "23505") {
      const { data: winner } = await a.supabase
        .from("memstore_map")
        .select("store_id, store_name")
        .eq("key", a.key)
        .single();
      if (winner) {
        // Archive our orphaned just-created store so it doesn't leak.
        a.anthropic.beta.memoryStores.archive(created.id).catch((e) =>
          console.warn(`[memstore] archive of orphan ${created.id} failed: ${e?.message}`),
        );
        return {
          store_id: winner.store_id as string,
          store_name: winner.store_name as string,
          mount_path: `/mnt/memory/${winner.store_name as string}`,
        };
      }
    }
    throw new Error(`memstore_map insert for ${a.key}: ${insErr.message}`);
  }

  return {
    store_id: created.id,
    store_name: created.name,
    mount_path: `/mnt/memory/${created.name}`,
  };
}
