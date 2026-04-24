import Anthropic from "@anthropic-ai/sdk";

const AGENT_ID = process.env.CLASSIFIER_AGENT_ID;
const ENV_ID = process.env.CLASSIFIER_ENVIRONMENT_ID;
const IMAGE_URL =
  process.argv[2] ??
  "https://upload.wikimedia.org/wikipedia/commons/3/38/Mammatocumulus_-_NOAA.jpg";

if (!AGENT_ID || !ENV_ID) {
  throw new Error(
    "Set CLASSIFIER_AGENT_ID and CLASSIFIER_ENVIRONMENT_ID in env.",
  );
}

const anthropic = new Anthropic();

const t0 = Date.now();
const session = await anthropic.beta.sessions.create({
  agent: AGENT_ID,
  environment_id: ENV_ID,
  title: `smoke-${Date.now()}`,
});
console.log(`session ${session.id}`);

const stream = await anthropic.beta.sessions.events.stream(session.id);
await anthropic.beta.sessions.events.send(session.id, {
  events: [
    {
      type: "user.message",
      content: [
        { type: "image", source: { type: "url", url: IMAGE_URL } },
        { type: "text", text: "Classify this sky photo per the output contract." },
      ],
    },
  ],
});

let transcript = "";
let stopReason;
let eventCount = 0;
const deadline = Date.now() + 90_000;
try {
  for await (const event of stream) {
    eventCount++;
    if (Date.now() > deadline || eventCount > 200) {
      console.warn("timeout/cap hit");
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
  anthropic.beta.sessions
    .archive(session.id)
    .catch((e) => console.warn(`archive failed: ${e?.message}`));
}

const elapsed = Date.now() - t0;
console.log(`elapsed ${elapsed}ms events ${eventCount} stop ${stopReason}`);
console.log("--- transcript ---");
console.log(transcript);
console.log("--- parsed ---");
try {
  console.log(JSON.stringify(JSON.parse(transcript.trim()), null, 2));
} catch (e) {
  console.error("parse failed:", e.message);
  process.exit(1);
}
