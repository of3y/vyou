// Memory Box SDK probe — verifies the three properties the hardened plan v2
// (architecture-audit-hardened-plan-v2.md §1 Correction 2) requires:
//
//   (a) client.beta.memoryStores.create returns a server-assigned opaque id
//   (b) sessions.create accepts resources [{ type: 'memory_store', memory_store_id, ... }]
//   (c) the agent reads the attached store via its read tool inside the session
//
// Plus the bonus path used by reconcile/research after the session ends:
//
//   (d) memoryStores.memories.create writes a path/content into the store
//
// PASS on (a) + (b) + (c) + (d) = green-light the memstore_map migration +
// ensureMemstoreFor helper + reconcile/research wiring.
// FAIL on any = surface the failure and recommend dropping Beat 6.

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const results = { a: null, b: null, c: null, d: null };
const cleanup = { storeId: null, sessionId: null, agentId: null, envId: null };

function log(line) { console.log(line); }
function err(line) { console.error(line); }

try {
  // ----- (a) memoryStores.create -----
  log("[probe] (a) creating memory store…");
  const STORE_NAME = `vyou-spike-${Date.now()}`;
  const store = await client.beta.memoryStores.create({
    name: STORE_NAME,
    description: "Spike — per-location rolling baseline probe",
  });
  cleanup.storeId = store.id;
  log(`[probe]     store.id = ${store.id}`);
  log(`[probe]     store.type = ${store.type}`);
  results.a = store.id?.startsWith("memstore_") || /^[a-z]+_[A-Za-z0-9]+/.test(store.id);
  if (!results.a) {
    err(`[probe]     (a) UNEXPECTED id shape: ${store.id}`);
  }

  // ----- (d) memories.create — write a fact the agent should read back -----
  log("[probe] (d) writing a memory fact via memories.create…");
  const seedContent = "On 2026-04-26 at this monastery a contributor noted clear sky and ~22°C.";
  const memory = await client.beta.memoryStores.memories.create(store.id, {
    path: "/sky/baseline.md",
    content: seedContent,
  });
  log(`[probe]     memory.id = ${memory.id}, path = ${memory.path}, bytes = ${memory.content_size_bytes}`);
  results.d = memory.path === "/sky/baseline.md" && memory.content_size_bytes > 0;

  // ----- spin up env + agent -----
  log("[probe] preparing environment + agent…");
  const env = await client.beta.environments.create({
    name: `vyou-memspike-${Date.now()}`,
    config: { type: "cloud", networking: { type: "unrestricted" } },
  });
  cleanup.envId = env.id;
  log(`[probe]     env.id = ${env.id}`);

  // Cheap model for the probe — same toolset shape as the deep-researcher.
  const MOUNT = `/mnt/memory/${STORE_NAME}`;
  const agent = await client.beta.agents.create({
    name: "vyou-memspike-agent",
    model: "claude-haiku-4-5-20251001",
    system:
      `You have an attached memory store mounted at ${MOUNT}. When asked, read the file at ` +
      `${MOUNT}/sky/baseline.md using the read tool, then reply with EXACTLY the file's contents ` +
      "wrapped in <answer>…</answer> tags. Do not add commentary.",
    tools: [
      {
        type: "agent_toolset_20260401",
        default_config: { enabled: false },
        configs: [
          { name: "read", enabled: true, permission_policy: { type: "always_allow" } },
        ],
      },
    ],
  });
  cleanup.agentId = agent.id;
  log(`[probe]     agent.id = ${agent.id} v${agent.version}`);

  // ----- (b) sessions.create with the memory_store resource -----
  log("[probe] (b) creating session with memory_store resource…");
  let session;
  try {
    session = await client.beta.sessions.create({
      agent: agent.id,
      environment_id: env.id,
      title: "memstore-spike",
      resources: [
        {
          type: "memory_store",
          memory_store_id: store.id,
          access: "read_only",
          instructions: `Per-location baseline. The fact lives at ${MOUNT}/sky/baseline.md.`,
        },
      ],
    });
    cleanup.sessionId = session.id;
    results.b = Array.isArray(session.resources) && session.resources.some((r) => r.type === "memory_store");
    log(`[probe]     session.id = ${session.id}`);
    log(`[probe]     session.resources = ${JSON.stringify(session.resources)}`);
  } catch (e) {
    err(`[probe]     (b) FAILED: ${e?.message ?? e}`);
    results.b = false;
  }

  // ----- (c) drive a turn, watch the read tool fire against the memory path -----
  if (results.b && session) {
    log("[probe] (c) sending user message + streaming events…");
    const stream = await client.beta.sessions.events.stream(session.id);
    await client.beta.sessions.events.send(session.id, {
      events: [
        {
          type: "user.message",
          content: [
            {
              type: "text",
              text: `Read ${MOUNT}/sky/baseline.md from memory and reply with its contents in <answer> tags.`,
            },
          ],
        },
      ],
    });

    let transcript = "";
    let sawReadToolUse = false;
    let toolUseCount = 0;
    const toolUses = [];
    const deadline = Date.now() + 90_000; // 90s cap on the probe turn

    for await (const event of stream) {
      if (Date.now() > deadline) {
        err("[probe]     (c) TIMEOUT — session exceeded 90s");
        break;
      }
      if (event.type === "agent.tool_use" || event.type === "agent.custom_tool_use") {
        toolUseCount++;
        const name = event.name ?? event.tool_name;
        const input = event.input ?? event.tool_input;
        toolUses.push({ name, input });
        log(`[probe]     tool_use: ${name} ${JSON.stringify(input).slice(0, 200)}`);
        if (name === "read") {
          const inputStr = JSON.stringify(input);
          if (inputStr.includes("baseline.md") || inputStr.includes("/sky/")) sawReadToolUse = true;
        }
      }
      if (event.type === "agent.message") {
        for (const block of event.content ?? []) {
          if (block.type === "text") transcript += block.text;
        }
      }
      if (event.type === "session.status_terminated") break;
      if (
        event.type === "session.status_idle" &&
        event.stop_reason?.type !== "requires_action"
      ) break;
    }

    log(`[probe]     transcript = ${JSON.stringify(transcript).slice(0, 500)}`);
    log(`[probe]     tool_use count = ${toolUseCount}, saw read against baseline.md = ${sawReadToolUse}`);
    const answerEchoesSeed = transcript.includes("monastery") && transcript.includes("22");
    results.c = sawReadToolUse && answerEchoesSeed;
    if (!results.c) {
      err(`[probe]     (c) FAILED — sawReadToolUse=${sawReadToolUse}, answerEchoesSeed=${answerEchoesSeed}`);
      err(`[probe]     toolUses = ${JSON.stringify(toolUses, null, 2)}`);
    }
  } else {
    err("[probe]     (c) SKIPPED because (b) failed");
    results.c = false;
  }
} catch (e) {
  err(`[probe] HARD FAIL: ${e?.stack ?? e}`);
} finally {
  log("[probe] cleanup…");
  if (cleanup.sessionId) await client.beta.sessions.archive(cleanup.sessionId).catch(() => {});
  if (cleanup.agentId) await client.beta.agents.archive(cleanup.agentId).catch(() => {});
  if (cleanup.envId) await client.beta.environments.archive(cleanup.envId).catch(() => {});
  if (cleanup.storeId) await client.beta.memoryStores.archive(cleanup.storeId).catch(() => {});
}

const verdict = results.a && results.b && results.c && results.d ? "GO" : "NO-GO";
console.log("\n=== Memory Box spike verdict ===");
console.log(`(a) memoryStores.create returns opaque id   : ${results.a ? "PASS" : "FAIL"}`);
console.log(`(b) sessions.create accepts resources[mem]  : ${results.b ? "PASS" : "FAIL"}`);
console.log(`(c) agent reads store via read tool         : ${results.c ? "PASS" : "FAIL"}`);
console.log(`(d) memories.create writes path/content     : ${results.d ? "PASS" : "FAIL"}`);
console.log(`verdict: ${verdict}`);
process.exit(verdict === "GO" ? 0 : 1);
