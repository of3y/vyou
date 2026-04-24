import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const EVAL_ROOT = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

const AGENT_ID = process.env.CLASSIFIER_AGENT_ID;
const ENV_ID = process.env.CLASSIFIER_ENVIRONMENT_ID;
const RUN_DATE = process.env.RUN_DATE ?? new Date().toISOString().slice(0, 10);
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 5);

if (!AGENT_ID || !ENV_ID) {
  throw new Error("CLASSIFIER_AGENT_ID and CLASSIFIER_ENVIRONMENT_ID required.");
}

const RUNS_DIR = join(EVAL_ROOT, "runs", RUN_DATE);
mkdirSync(RUNS_DIR, { recursive: true });

const anthropic = new Anthropic();

function parseManifest(path) {
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  const header = lines.shift().split(",");
  return lines.map((line) => {
    const cols = splitCsv(line);
    return Object.fromEntries(header.map((h, i) => [h, cols[i] ?? ""]));
  });
}

function splitCsv(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === ",") {
        out.push(cur);
        cur = "";
      } else if (c === '"') inQ = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function mimeFromExt(path) {
  const e = extname(path).toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  if (e === ".gif") return "image/gif";
  return "image/jpeg";
}

function extractJson(text) {
  // Tolerant extractor: find the last balanced {...} block. The Classifier sometimes
  // emits prose before the JSON (e.g. "The files I read are ... Continuing with the
  // classification task.") when it reads its attached skill.
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}
  // Scan from the right for a balanced brace block.
  const end = trimmed.lastIndexOf("}");
  if (end < 0) return null;
  let depth = 0;
  let start = -1;
  for (let i = end; i >= 0; i--) {
    const c = trimmed[i];
    if (c === "}") depth++;
    else if (c === "{") {
      depth--;
      if (depth === 0) {
        start = i;
        break;
      }
    }
  }
  if (start < 0) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function classifyOne(row) {
  const outPath = join(RUNS_DIR, `${row.image_id}.json`);
  if (existsSync(outPath)) {
    return { row_id: row.image_id, skipped: true, out: outPath };
  }
  const t0 = Date.now();
  const localAbs = join(REPO_ROOT, row.local_path);
  if (!existsSync(localAbs)) {
    writeFileSync(outPath, JSON.stringify({ image_id: row.image_id, error: "local_path missing", local_path: row.local_path }, null, 2));
    return { row_id: row.image_id, error: "local_path missing" };
  }
  const b64 = readFileSync(localAbs).toString("base64");
  const media_type = mimeFromExt(localAbs);

  let session;
  try {
    session = await anthropic.beta.sessions.create({
      agent: AGENT_ID,
      environment_id: ENV_ID,
      title: `eval-${row.image_id}`,
    });
  } catch (e) {
    const err = { image_id: row.image_id, error: `session.create: ${e?.message}` };
    writeFileSync(outPath, JSON.stringify(err, null, 2));
    return { row_id: row.image_id, error: err.error };
  }

  let transcript = "";
  let stopReason;
  let eventCount = 0;
  let timedOut = false;
  const deadline = Date.now() + 180_000;

  try {
    const stream = await anthropic.beta.sessions.events.stream(session.id);
    await anthropic.beta.sessions.events.send(session.id, {
      events: [
        {
          type: "user.message",
          content: [
            { type: "image", source: { type: "base64", media_type, data: b64 } },
            { type: "text", text: "Classify this sky photo per the output contract." },
          ],
        },
      ],
    });
    for await (const event of stream) {
      eventCount++;
      if (Date.now() > deadline || eventCount > 300) {
        timedOut = true;
        break;
      }
      if (event.type === "agent.message") {
        for (const block of event.content ?? []) {
          if (block.type === "text") transcript += block.text;
        }
      }
      if (event.type === "session.status_terminated") break;
      if (event.type === "session.status_idle") {
        stopReason = event.stop_reason?.type;
        if (stopReason !== "requires_action") break;
      }
    }
  } finally {
    anthropic.beta.sessions.archive(session.id).catch(() => {});
  }

  const parsed = extractJson(transcript);
  const result = {
    image_id: row.image_id,
    session_id: session.id,
    elapsed_ms: Date.now() - t0,
    events: eventCount,
    stop_reason: stopReason,
    timed_out: timedOut,
    transcript,
    parsed,
  };
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  return { row_id: row.image_id, ok: !!parsed, elapsed_ms: result.elapsed_ms, phenomenon: parsed?.phenomenon };
}

async function runWithConcurrency(items, limit, fn) {
  const results = [];
  const queue = [...items];
  const workers = Array.from({ length: limit }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      try {
        const r = await fn(item);
        console.log(`  ${r.row_id}  ${r.ok ? "ok" : r.skipped ? "skip" : "FAIL"}  ${r.elapsed_ms ?? 0}ms  ${r.phenomenon ?? r.error ?? ""}`);
        results.push(r);
      } catch (e) {
        console.error(`  ${item.image_id}  THROW  ${e.message}`);
        results.push({ row_id: item.image_id, error: e.message });
      }
    }
  });
  await Promise.all(workers);
  return results;
}

const manifest = parseManifest(join(EVAL_ROOT, "dataset-manifest.csv"));
console.log(`Classifier eval: ${manifest.length} rows, concurrency=${CONCURRENCY}, run_date=${RUN_DATE}`);
console.log(`Writing per-row results to eval/runs/${RUN_DATE}/`);

const t0 = Date.now();
const results = await runWithConcurrency(manifest, CONCURRENCY, classifyOne);
const elapsed = Date.now() - t0;
const ok = results.filter((r) => r.ok).length;
const skipped = results.filter((r) => r.skipped).length;
const failed = results.filter((r) => r.error).length;

console.log(`\nDone. ok=${ok} skipped=${skipped} failed=${failed} total=${results.length} elapsed=${(elapsed / 1000).toFixed(1)}s`);
