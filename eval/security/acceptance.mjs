#!/usr/bin/env node
// Security acceptance harness for paid edge functions.
//
// Asserts that /functions/v1/classify and /functions/v1/reconcile reject
// requests without an x-vyou-invite header before opening an Anthropic
// session. The audit in docs/security-audit.md calls this out as the Phase 0
// verification step that must pass before the tester cohort link circulates.
//
// The negative path is the security guarantee: a call without the invite
// header must fail at 401 and must not create a classifications,
// verified_reports, or session-cost row. The positive path is optional and
// relies on idempotency short-circuits — when VYOU_TEST_REPORT_ID and
// VYOU_TEST_CLASSIFICATION_ID point at rows that already have cached
// outputs, a valid call returns { cached: true } without opening a paid
// session, so the harness is free to run.
//
// Usage:
//   set -a; source .env.local; set +a
//   VYOU_INVITE_TOKEN=<issued-token> node eval/security/acceptance.mjs
//
// Env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.local work too):
//   SUPABASE_URL              required
//   SUPABASE_ANON_KEY         required
//   SUPABASE_SERVICE_ROLE_KEY required
//   VYOU_INVITE_TOKEN         optional; enables positive path
//   VYOU_TEST_REPORT_ID       optional; enables classifications-row DB assertion
//   VYOU_TEST_CLASSIFICATION_ID optional; enables verified-row DB assertion
//
// Exit 0 = all required assertions passed; 1 = any failure.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Accept VITE_-prefixed fallbacks so the harness can read straight from .env.local.
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INVITE_TOKEN = process.env.VYOU_INVITE_TOKEN;
const TEST_REPORT_ID = process.env.VYOU_TEST_REPORT_ID;
const TEST_CLASSIFICATION_ID = process.env.VYOU_TEST_CLASSIFICATION_ID;

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

if (!SUPABASE_URL) fail("SUPABASE_URL must be set");
if (!SUPABASE_ANON_KEY) fail("SUPABASE_ANON_KEY must be set");
if (!SUPABASE_SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY must be set");

const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const functionsBase = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1`;

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function post(path, { body, invite }) {
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  if (invite) headers["x-vyou-invite"] = invite;
  const res = await fetch(`${functionsBase}/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });
  let parsed = null;
  const text = await res.text();
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { _raw: text };
  }
  return { status: res.status, body: parsed };
}

async function classificationCountForReport(reportId) {
  const { count, error } = await service
    .from("classifications")
    .select("id", { count: "exact", head: true })
    .eq("report_id", reportId);
  if (error) throw new Error(`classifications count: ${error.message}`);
  return count ?? 0;
}

async function verifiedCountForClassification(classificationId) {
  const { count, error } = await service
    .from("verified_reports")
    .select("id", { count: "exact", head: true })
    .eq("classification_id", classificationId);
  if (error) throw new Error(`verified_reports count: ${error.message}`);
  return count ?? 0;
}

// Probe report_id / classification_id only exist to satisfy the request body
// shape; the invite check runs before body validation so these never resolve.
const probeReportId = TEST_REPORT_ID ?? randomUUID();
const probeClassificationId = TEST_CLASSIFICATION_ID ?? randomUUID();

console.log(`Target: ${functionsBase}`);
console.log("");
console.log("--- Negative path: no x-vyou-invite header ---");

// classify
{
  const before = TEST_REPORT_ID ? await classificationCountForReport(probeReportId) : null;
  const { status, body } = await post("classify", { body: { report_id: probeReportId } });
  const blocked = status === 401 || status === 403;
  record(
    "classify rejects missing invite with 401/403",
    blocked,
    `status=${status} body=${JSON.stringify(body)}`,
  );
  if (TEST_REPORT_ID) {
    const after = await classificationCountForReport(probeReportId);
    record(
      "classify did not create a classifications row without invite",
      after === before,
      `before=${before} after=${after}`,
    );
  }
}

// reconcile
{
  const before = TEST_CLASSIFICATION_ID
    ? await verifiedCountForClassification(probeClassificationId)
    : null;
  const { status, body } = await post("reconcile", {
    body: { classification_id: probeClassificationId },
  });
  const blocked = status === 401 || status === 403;
  record(
    "reconcile rejects missing invite with 401/403",
    blocked,
    `status=${status} body=${JSON.stringify(body)}`,
  );
  if (TEST_CLASSIFICATION_ID) {
    const after = await verifiedCountForClassification(probeClassificationId);
    record(
      "reconcile did not create a verified_reports row without invite",
      after === before,
      `before=${before} after=${after}`,
    );
  }
}

// Optional positive path — requires an invite token and existing cached rows,
// so the idempotency short-circuits return without opening a paid session.
if (INVITE_TOKEN && TEST_REPORT_ID && TEST_CLASSIFICATION_ID) {
  console.log("");
  console.log("--- Positive path: valid invite, cached rows ---");

  const beforeClass = await classificationCountForReport(TEST_REPORT_ID);
  const beforeVerified = await verifiedCountForClassification(TEST_CLASSIFICATION_ID);

  const classifyRes = await post("classify", {
    body: { report_id: TEST_REPORT_ID },
    invite: INVITE_TOKEN,
  });
  record(
    "classify with valid invite returns cached classification",
    classifyRes.status === 200 && classifyRes.body?.cached === true,
    `status=${classifyRes.status} cached=${classifyRes.body?.cached}`,
  );

  const reconcileRes = await post("reconcile", {
    body: { classification_id: TEST_CLASSIFICATION_ID },
    invite: INVITE_TOKEN,
  });
  record(
    "reconcile with valid invite returns cached verified_report",
    reconcileRes.status === 200 && reconcileRes.body?.cached === true,
    `status=${reconcileRes.status} cached=${reconcileRes.body?.cached}`,
  );

  const afterClass = await classificationCountForReport(TEST_REPORT_ID);
  const afterVerified = await verifiedCountForClassification(TEST_CLASSIFICATION_ID);
  record(
    "positive path opened no new paid session (row counts stable)",
    afterClass === beforeClass && afterVerified === beforeVerified,
    `classifications ${beforeClass}→${afterClass}, verified ${beforeVerified}→${afterVerified}`,
  );
} else {
  console.log("");
  console.log("--- Positive path skipped ---");
  console.log("Set VYOU_INVITE_TOKEN, VYOU_TEST_REPORT_ID, VYOU_TEST_CLASSIFICATION_ID to run.");
}

const failed = results.filter((r) => !r.ok);
console.log("");
console.log(`Summary: ${results.length - failed.length}/${results.length} passed.`);
process.exit(failed.length ? 1 : 0);
