// Seed the per-location Memory Box for a demo cell.
//
// Beat 6 of the demo script depends on the SECOND brief in a cell visibly
// inheriting from the FIRST contributor's observation — *"a contributor here
// noted X earlier today"*. Memory write-back from the agent's output is a
// post-hackathon follow-up; until that lands, this script is the bridge:
// run it once before recording with two contributor-style facts in the cell,
// then record cone #2 in the same cell and watch the brief cite them.
//
// Usage:
//
//   ANTHROPIC_API_KEY=...  SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/seed-demo-memstore.mjs --lat 47.5092 --lon 11.0833 \
//          --label "Garmisch-Partenkirchen" \
//          --fact "early afternoon — clear sky overhead, ~22°C, Wetterstein north faces still snow-streaked" \
//          --fact "earlier today — long sleeve recommended once sun drops behind the Heiliger Berg ridge"
//
// Idempotent: looks up the cell's memstore via memstore_map; if not present
// creates it and inserts the row. Memories are appended at unique paths so
// re-runs don't overwrite — the agent reads everything in the directory.
//
// PRIVACY: don't seed user-store memories from this script. Per-user stores
// hold anonymized signal only and are populated at runtime, not pre-seeded.

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const args = parseArgs(process.argv.slice(2));
if (args.lat === undefined || args.lon === undefined) {
  console.error("Usage: node seed-demo-memstore.mjs --lat <num> --lon <num> [--label <str>] --fact <str> [--fact <str> ...]");
  process.exit(2);
}
if (!args.fact || args.fact.length === 0) {
  console.error("At least one --fact required.");
  process.exit(2);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
  console.error("Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY required.");
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const cell = geohash6(args.lat, args.lon);
const key = `loc:${cell}`;
const desiredName = `loc-${cell}`;

console.log(`[seed] cell geohash6 = ${cell}  (${args.lat}, ${args.lon})`);

// --- look up or create the store + map row ---
const { data: existing, error: selErr } = await supabase
  .from("memstore_map")
  .select("store_id, store_name")
  .eq("key", key)
  .maybeSingle();
if (selErr) {
  console.error(`[seed] memstore_map select failed: ${selErr.message}`);
  process.exit(1);
}

let storeId, storeName;
if (existing) {
  storeId = existing.store_id;
  storeName = existing.store_name;
  console.log(`[seed] existing store ${storeId} (${storeName})`);
} else {
  const description = args.label
    ? `Per-cell rolling baseline for geohash6=${cell} (${args.label})`
    : `Per-cell rolling baseline for geohash6=${cell}`;
  const created = await anthropic.beta.memoryStores.create({
    name: desiredName,
    description,
  });
  storeId = created.id;
  storeName = created.name;
  console.log(`[seed] created store ${storeId} (${storeName})`);

  const { error: insErr } = await supabase
    .from("memstore_map")
    .insert({
      key,
      store_id: storeId,
      store_name: storeName,
      scope: "location",
      geohash6: cell,
      reporter_id: null,
    });
  if (insErr) {
    // Race against an in-flight reconcile — fall through and use the winner.
    if (insErr.code === "23505") {
      const { data: winner } = await supabase
        .from("memstore_map")
        .select("store_id, store_name")
        .eq("key", key)
        .single();
      if (winner) {
        // Archive our orphan to avoid leaking
        await anthropic.beta.memoryStores.archive(storeId).catch(() => {});
        storeId = winner.store_id;
        storeName = winner.store_name;
        console.log(`[seed] race resolved — using ${storeId} (${storeName})`);
      }
    } else {
      console.error(`[seed] memstore_map insert failed: ${insErr.message}`);
      process.exit(1);
    }
  }
}

// --- write the seed memories ---
const stamp = Date.now();
let i = 0;
for (const fact of args.fact) {
  const path = `/contributors/${stamp}-${++i}.md`;
  const content = `${fact.trim()}\n`;
  const memory = await anthropic.beta.memoryStores.memories.create(storeId, {
    path,
    content,
  });
  console.log(`[seed]   wrote ${path}  (${memory.content_size_bytes} bytes)`);
}

console.log(`[seed] done. mount path inside session: /mnt/memory/${storeName}/`);
console.log(`[seed] next: record cone #2 in this cell — the brief should cite the seeded facts as "a contributor here noted X".`);

// ---------------- helpers ----------------

function parseArgs(argv) {
  const out = { fact: [] };
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    if (a === "--lat") out.lat = Number(argv[++k]);
    else if (a === "--lon") out.lon = Number(argv[++k]);
    else if (a === "--label") out.label = argv[++k];
    else if (a === "--fact") out.fact.push(argv[++k]);
    else {
      console.error(`Unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

// Standard base32 geohash. Precision 6 ≈ 1.2km × 0.6km. Mirrors the
// implementation in supabase/functions/_shared/memstore.ts so this script
// produces the exact same key the runtime helpers do.
function geohash6(lat, lon) {
  const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let latRange = [-90, 90];
  let lonRange = [-180, 180];
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
      hash += BASE32[bits];
      bits = 0;
      bit = 0;
    }
  }
  return hash;
}
