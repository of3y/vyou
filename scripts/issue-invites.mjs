#!/usr/bin/env node
// Issue invite tokens for the VYou tester cohort.
//
// Usage:
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
//     node scripts/issue-invites.mjs --count 5 --label "tester-cohort-1" --max-uses 50 --base-url https://vyou.app
//
// Flags (all optional except at least one of --count, --label-each):
//   --count <n>        Number of invite tokens to create (default 1)
//   --label <str>      Shared label for the cohort; combined with index
//   --label-each a,b   Comma-separated per-token labels (overrides --count)
//   --max-uses <n>     Per-token call cap (default 50)
//   --expires-in <d>   Days until expiration (default 3)
//   --base-url <url>   URL to bake into the shareable links
//                      (default: reads VITE_PUBLIC_URL or https://vyou.app)

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  return process.argv[i + 1];
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const baseUrl = arg("--base-url", process.env.VITE_PUBLIC_URL ?? "https://vyou.app");
const maxUses = Number(arg("--max-uses", 50));
const expiresInDays = Number(arg("--expires-in", 3));
const expiresAt = new Date(Date.now() + expiresInDays * 24 * 3600 * 1000).toISOString();
const sharedLabel = arg("--label", null);
const labelEachArg = arg("--label-each", null);
const count = Number(arg("--count", 1));

const labels = labelEachArg
  ? labelEachArg.split(",").map((s) => s.trim()).filter(Boolean)
  : Array.from({ length: count }, (_, i) => (sharedLabel ? `${sharedLabel}-${i + 1}` : `cohort-${i + 1}`));

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const rows = labels.map((label) => ({
  token: randomBytes(12).toString("base64url"),
  label,
  max_uses: maxUses,
  expires_at: expiresAt,
}));

const { error } = await supabase.from("invites").insert(rows);
if (error) {
  console.error("insert failed:", error.message);
  process.exit(1);
}

console.log(`Issued ${rows.length} invite(s). Max uses per token: ${maxUses}. Expires: ${expiresAt}\n`);
for (const row of rows) {
  console.log(`${row.label.padEnd(24)}  ${baseUrl}/?invite=${row.token}`);
}
