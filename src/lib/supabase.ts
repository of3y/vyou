import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  console.warn(
    "[VYou] Supabase env not set. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.",
  );
}

export const supabase = createClient(url ?? "http://localhost:54321", anonKey ?? "dev-anon-key", {
  auth: { persistSession: false },
});

export const supabaseFunctionsUrl = `${(url ?? "http://localhost:54321").replace(/\/$/, "")}/functions/v1`;
