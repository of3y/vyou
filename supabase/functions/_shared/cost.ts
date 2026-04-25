// Shared pricing + usage → USD helper for the Classifier and Reconciliation
// edge functions. Rates are $ per 1M tokens, pulled from the Anthropic
// pricing page on 2026-04-24.
//
// The model constants below are the single source of truth for which model
// each agent uses. The setup scripts pin the same literal at agents.create()
// time, so flipping a model is a deliberate two-step edit (here + script +
// re-provision), not a silent Edge-Function env toggle. This is intentional:
// the earlier env-override pattern let cost_usd silently disagree with the
// agent's real model when the env var was flipped without re-provisioning.

export const CLASSIFIER_MODEL = "claude-opus-4-7";
export const RECONCILIATION_MODEL = "claude-opus-4-7";

export type ModelId =
  | "claude-opus-4-7"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5";

type Rates = {
  in: number;
  cache_w: number;
  cache_r: number;
  out: number;
};

export const MODEL_PRICING: Record<ModelId, Rates> = {
  "claude-opus-4-7":   { in: 15,  cache_w: 18.75, cache_r: 1.5,  out: 75 },
  "claude-sonnet-4-6": { in:  3,  cache_w:  3.75, cache_r: 0.3,  out: 15 },
  "claude-haiku-4-5":  { in:  0.8, cache_w: 1.0,  cache_r: 0.08, out:  4 },
};

export type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

export function costUsd(model: string, usage: Usage | null | undefined): number | null {
  if (!usage) return null;
  const rates = MODEL_PRICING[model as ModelId];
  if (!rates) return null;
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const total =
    (input      * rates.in      +
     output     * rates.out     +
     cacheWrite * rates.cache_w +
     cacheRead  * rates.cache_r) / 1_000_000;
  return Math.round(total * 10_000) / 10_000;
}

// Build the persisted session_stats blob. `timed_out` is recorded alongside
// the cost receipt so eval/ops queries can separate timeout cost from
// successful-run cost.
//
// Optional observability fields (events_count, elapsed_ms, stop_reason,
// transcript_chars, feeds) are passed through when the caller measured them,
// so a row's session_stats becomes the per-invocation paper trail without
// any schema change — session_stats is already jsonb on classifications,
// verified_reports, and briefs.
export function buildSessionStats(args: {
  session_id: string;
  agent_id: string;
  skill_id?: string;
  skill_version?: string | number;
  model: string;
  usage: Usage | null | undefined;
  stats?: { duration_seconds?: number } | null | undefined;
  timed_out?: boolean;
  events_count?: number;
  elapsed_ms?: number;
  stop_reason?: string | null;
  transcript_chars?: number;
  feeds?: Record<string, boolean | number | string | null>;
}): Record<string, unknown> {
  const duration_ms = args.stats?.duration_seconds != null
    ? Math.round(args.stats.duration_seconds * 1000)
    : null;
  return {
    session_id: args.session_id,
    agent_id: args.agent_id,
    skill_id: args.skill_id ?? null,
    skill_version: args.skill_version ?? null,
    model: args.model,
    duration_ms,
    elapsed_ms: args.elapsed_ms ?? null,
    events_count: args.events_count ?? null,
    stop_reason: args.stop_reason ?? null,
    transcript_chars: args.transcript_chars ?? null,
    feeds: args.feeds ?? null,
    usage: args.usage ?? null,
    cost_usd: costUsd(args.model, args.usage),
    timed_out: args.timed_out ?? false,
  };
}
