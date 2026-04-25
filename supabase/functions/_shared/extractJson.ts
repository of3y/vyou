// Robust JSON extraction from agent transcripts.
//
// Anthropic's session output frequently includes prose around the JSON
// payload — preambles like "Here's the verdict:" or markdown code fences
// from the model's instinct to format. A bare JSON.parse on the trimmed
// transcript fails on any of these, which surfaced as the 502 "agent did
// not return parseable JSON" the testers hit. Strategy: try direct parse,
// then strip code fences, then locate the outermost { ... } substring and
// parse that. Returns null only if no balanced JSON object can be found.

export function extractJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const direct = tryParse(trimmed);
  if (direct) return direct;

  const fenced = stripCodeFence(trimmed);
  if (fenced !== trimmed) {
    const inner = tryParse(fenced);
    if (inner) return inner;
  }

  const span = findBalancedObject(trimmed);
  if (span) {
    const candidate = tryParse(span);
    if (candidate) return candidate;
  }

  return null;
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

function findBalancedObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
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
