// Robust JSON extraction from agent transcripts.
//
// Anthropic's session output frequently includes prose around the JSON
// payload — preambles like "Here's the verdict:", markdown code fences,
// or earlier inline JSON-shaped fragments (the model rehearsing the
// schema, a quoted example, or thinking-style prose with curly braces).
// A bare JSON.parse on the trimmed transcript fails on any of these,
// which surfaced as the 502 "agent did not return parseable JSON" the
// testers hit even when the real verdict was present further down.
//
// Strategy: collect every parseable candidate (direct, fenced, and
// every balanced top-level {...} substring), then pick the *last* one
// that satisfies the optional requireKeys filter. The final answer in
// a model transcript is overwhelmingly at the end, and requireKeys
// disambiguates a real payload from earlier rehearsal fragments.

export type ExtractOpts = {
  /**
   * Keys the chosen candidate must contain. Used to skip earlier
   * schema-rehearsal fragments and prefer the real payload.
   * If unset, returns the last parseable candidate regardless of shape.
   */
  requireKeys?: string[];
};

export function extractJson(
  text: string,
  opts: ExtractOpts = {},
): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const candidates: Record<string, unknown>[] = [];

  const direct = tryParse(trimmed);
  if (direct) candidates.push(direct);

  const fenced = stripCodeFence(trimmed);
  if (fenced !== trimmed) {
    const inner = tryParse(fenced);
    if (inner) candidates.push(inner);
  }

  for (const span of findAllBalancedObjects(trimmed)) {
    const parsed = tryParse(span);
    if (parsed) candidates.push(parsed);
  }

  if (!candidates.length) return null;

  const required = opts.requireKeys ?? [];
  if (required.length) {
    for (let i = candidates.length - 1; i >= 0; i--) {
      if (required.every((k) => k in candidates[i])) return candidates[i];
    }
    // Strict mode: no candidate carries the required shape — null forces
    // the caller into its 502 / fallback path rather than returning a
    // schema-rehearsal fragment that lacks the load-bearing field.
    return null;
  }
  return candidates[candidates.length - 1];
}

function tryParse(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function stripCodeFence(text: string): string {
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fence ? fence[1].trim() : text;
}

// Enumerate every top-level balanced {...} span in document order.
// Skips over already-consumed spans (i jumps past the close brace) so a
// nested object inside an outer object isn't reported twice.
function findAllBalancedObjects(text: string): string[] {
  const spans: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "{") {
      const span = balancedFrom(text, i);
      if (span !== null) {
        spans.push(span);
        i += span.length;
        continue;
      }
    }
    i++;
  }
  return spans;
}

function balancedFrom(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
