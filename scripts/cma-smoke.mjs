import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const environment = await client.beta.environments.create({
  name: `vyou-smoke-${Date.now()}`,
  config: { type: "cloud", networking: { type: "unrestricted" } },
});
console.log(`env   ${environment.id}`);

const agent = await client.beta.agents.create({
  name: "vyou-smoke-agent",
  model: "claude-opus-4-7",
  system: "You are a ping-pong bot. When the user says 'ping', reply with exactly 'PONG'.",
});
console.log(`agent ${agent.id} v${agent.version}`);

const session = await client.beta.sessions.create({
  agent: agent.id,
  environment_id: environment.id,
  title: "vyou cma smoke test",
});
console.log(`sesn  ${session.id}`);

const stream = await client.beta.sessions.events.stream(session.id);
await client.beta.sessions.events.send(session.id, {
  events: [{ type: "user.message", content: [{ type: "text", text: "ping" }] }],
});

let transcript = "";
for await (const event of stream) {
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

console.log(`---\ntranscript: ${JSON.stringify(transcript)}`);
console.log(`PONG present: ${transcript.includes("PONG")}`);

await client.beta.sessions.archive(session.id).catch(() => {});
await client.beta.agents.archive(agent.id).catch(() => {});
await client.beta.environments.archive(environment.id).catch(() => {});
