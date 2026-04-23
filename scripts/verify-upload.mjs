import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => l.split("=", 2)),
);

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const { data: rows, error } = await client
  .from("reports_v")
  .select("id, photo_url, lon, lat, heading_degrees, caption, submitted_at")
  .order("submitted_at", { ascending: false })
  .limit(3);

if (error) {
  console.error("report query failed:", error);
  process.exit(1);
}

for (const r of rows) {
  console.log(`${r.submitted_at}  ${r.id}`);
  console.log(`  heading=${Math.round(r.heading_degrees)}°  loc=${r.lat.toFixed(5)},${r.lon.toFixed(5)}`);
  console.log(`  photo_url=${r.photo_url}`);
  if (r.photo_url?.startsWith("http")) {
    const head = await fetch(r.photo_url, { method: "HEAD" });
    console.log(`  HEAD ${head.status}  content-type=${head.headers.get("content-type")}  bytes=${head.headers.get("content-length")}`);
  }
  console.log(`  caption=${r.caption ?? "(none)"}`);
}

const { data: files } = await client.storage.from("photos").list("", { limit: 5, sortBy: { column: "created_at", order: "desc" } });
console.log(`\nTop-level Storage entries (folders): ${files?.map((f) => f.name).join(", ") ?? "(none)"}`);
