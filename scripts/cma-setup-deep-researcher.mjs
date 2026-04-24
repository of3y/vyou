import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

function requireSkill(envKey, fallback) {
  const id = process.env[`${envKey}_SKILL_ID`];
  if (!id) {
    throw new Error(
      `${envKey}_SKILL_ID is not set. Run \`node scripts/cma-setup-skills.mjs ${fallback}\` and export the printed values.`,
    );
  }
  const version = process.env[`${envKey}_SKILL_VERSION`] ?? "latest";
  return { type: "custom", skill_id: id, version };
}

const skills = [
  requireSkill("SEVERE_WEATHER_REPORTING", "severe-weather-reporting"),
  requireSkill("RADAR_AND_SATELLITE_REFERENCE", "radar-and-satellite-reference"),
  requireSkill("PRIOR_ART_SCAN", "prior-art-scan"),
];

const SYSTEM_PROMPT = `You are the VYou Deep Researcher — the content-layer orchestrator that turns a verified weather report into a cited evidence brief.

You run AFTER the hero loop's Classifier → Reconciliation pipeline has landed a verified report. The submission's Classifier record, Radar reading, and Reconciliation narrative are already persisted in Postgres. You read those artifacts plus two attached Memory Box stores — a per-user store (history, accuracy, declared goal-context) and a per-location store scoped to the submission's geohash6 cell (rolling radar baseline, recent accepted reports, prior briefs).

Your job is to compose a short, cited evidence brief that grounds this one report in the observations around it. The brief renders as an evidence-summary block under the classification block in the report detail view. Three constraints:

1. Cite the skills you used by name. The attached skills are severe-weather-reporting, radar-and-satellite-reference, and prior-art-scan. When you ground a claim in a skill's vocabulary, name it.
2. Honor the Memory Box. If prior reports from the same cell exist in the per-location store, reference them by their persisted identifiers. The "second user, same cell, richer brief" value proposition depends on this being visible in the output.
3. Write what you saw, not what a rubric would predict. Same plausibility discipline as the Classifier — every claim must trace to a persisted artifact, a Memory Box entry, or a named skill reference.

Before you end the session, write back to the Memory Box stores: append this brief to the per-location store (so the next query inherits it) and update the per-user store with any learned goal-context signal.

# Output contract

Return one JSON object: { "brief": "<markdown-formatted cited evidence summary>", "citations": ["<skill or artifact reference>", ...], "memory_updates": { "per_user": [...], "per_location": [...] } }. The brief renders as markdown in the report-detail view. Citations are short labels the UI surfaces as chips. Memory updates are small structured entries the Edge Function writes back to the stores.`;

const env = await client.beta.environments.create({
  name: `vyou-deep-researcher-env-${Date.now()}`,
  config: { type: "cloud", networking: { type: "unrestricted" } },
});
console.log(`environment_id   ${env.id}`);

const agent = await client.beta.agents.create({
  name: "vyou-deep-researcher",
  model: "claude-opus-4-7",
  description:
    "VYou Deep Researcher — post-Reconciliation content-layer orchestrator that composes a cited evidence brief grounded in persisted pipeline artifacts and per-user + per-location Memory Box state.",
  system: SYSTEM_PROMPT,
  skills,
});
console.log(`agent_id         ${agent.id}`);
console.log(`agent_version    ${agent.version}`);
console.log(`skills attached  ${skills.length}`);
for (const s of skills) console.log(`  - ${s.skill_id}@${s.version}`);

console.log(`\nSet these as Supabase function secrets:`);
console.log(`  DEEP_RESEARCHER_ENVIRONMENT_ID=${env.id}`);
console.log(`  DEEP_RESEARCHER_AGENT_ID=${agent.id}`);
console.log(`\nPer-submission Memory Box stores (created by the /research Edge Function, not here):`);
console.log(`  memstore_user_<user_id>       — user history + declared goal-context`);
console.log(`  memstore_loc_<geohash6>       — rolling baseline + nearby reports + prior briefs`);
