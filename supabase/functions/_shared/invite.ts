// Cohort-bound auth for paid edge functions. The client ships an invite token
// in the x-vyou-invite header; we validate it against the invites table.
//
// `used` is a paid-Anthropic-session meter, not a request meter. Read endpoints
// (list-reports, get-report, submit-report) gate on the invite but pass through
// without incrementing — otherwise the 2.5s polls in ReportDetail burn the cap
// in under a minute. Paid endpoints (classify, reconcile, research) opt in
// with `{ countAsUse: true }` so the cap meaningfully bounds Anthropic spend
// per cohort token.
//
// Increment is best-effort. Race-condition tolerable at cohort scale — if two
// concurrent paid calls both pass at used=max_uses-1, we eat one extra call.

// deno-lint-ignore-file no-explicit-any
type SupabaseLike = {
  from: (table: string) => any;
};

export const INVITE_HEADER = "x-vyou-invite";

export type InviteResult =
  | { ok: true; token: string }
  | { ok: false; status: number; error: string };

export async function requireInvite(
  req: Request,
  supabase: SupabaseLike,
  opts: { countAsUse?: boolean } = {},
): Promise<InviteResult> {
  const token = req.headers.get(INVITE_HEADER);
  if (!token) return { ok: false, status: 401, error: "invite token required" };

  const { data, error } = await supabase
    .from("invites")
    .select("token, used, max_uses, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error) return { ok: false, status: 500, error: `invite lookup: ${error.message}` };
  if (!data) return { ok: false, status: 403, error: "invalid invite" };
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { ok: false, status: 403, error: "invite expired" };
  }
  if (opts.countAsUse) {
    if (data.used >= data.max_uses) {
      return { ok: false, status: 429, error: "invite exhausted" };
    }
    await supabase
      .from("invites")
      .update({ used: data.used + 1 })
      .eq("token", token);
  }

  return { ok: true, token };
}
