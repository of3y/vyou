import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SKILL_ID = process.env.SEVERE_WEATHER_REPORTING_SKILL_ID;
const SKILL_VERSION = process.env.SEVERE_WEATHER_REPORTING_SKILL_VERSION ?? "latest";

if (!SKILL_ID) {
  throw new Error(
    "SEVERE_WEATHER_REPORTING_SKILL_ID is not set. Export it before running.",
  );
}

const SYSTEM_PROMPT = `You are the VYou Classifier — a vision-only meteorological observer. Given a single photograph of the sky or outdoor weather conditions, return one structured JSON record describing what you see.

Your phenomenon taxonomy, the per-phenomenon diagnostic feature vocabulary, the three-level confidence rubric, the hail-size anchor-object rubric, and the out-of-scope escape hatch all live in the attached severe-weather-reporting skill. Read it. Ground every extracted feature in something a human reviewer could point at in the pixels — do not hallucinate features the rubric "usually" accompanies a phenomenon.

# Output contract

Respond with EXACTLY one JSON object and nothing else. No prose, no markdown fences, no commentary outside the JSON. Schema:

{
  "phenomenon": "<one label from the skill's taxonomy, or \\"out_of_scope\\">",
  "features": ["<short phrase>", "<short phrase>", ...],
  "hail_size_cm": <number or null>,
  "confidence": "low" | "medium" | "high"
}

# Behavior contract

- Choose one phenomenon label from the skill's taxonomy (references/taxonomy.md). When multiple phenomena are visible, pick the most decision-relevant per the skill's precedence rule (severe > precipitation > cloud cover).
- Populate "features" with 3–7 short, visually verifiable phrases drawn from the skill's per-phenomenon vocabulary (references/features.md). Cross-family features are allowed when they materially shape the scene.
- Populate "hail_size_cm" ONLY under the two conditions named in the skill's hail-size rubric (references/rubrics.md): phenomenon is "hail" AND a scale reference is visible in the same frame. Otherwise null.
- Default "confidence" to "medium" unless evidence is strong in either direction, per the skill's confidence rubric. Never emit numeric percentages.
- For non-weather images, emit the out_of_scope record per the skill's out-of-scope rubric — do not force a weather label.
- For closed-beta tester selfies (frame dominated by a smiling face or a group posing for the camera), emit the tester_selfie record per the skill's Tester-selfie rubric instead of out_of_scope. This is a demo-only label that earns the closed beta usable demo footage; it is removed post-hackathon.`;

const env = await client.beta.environments.create({
  name: `vyou-classifier-eval-env-${Date.now()}`,
  config: { type: "cloud", networking: { type: "unrestricted" } },
});
console.log(`environment_id  ${env.id}`);

const agent = await client.beta.agents.create({
  name: "vyou-classifier-eval",
  model: "claude-opus-4-7",
  description:
    "Offline eval copy of the VYou Classifier — parallel agent used by the classifier-validator harness, isolated from production. Same skill, same system prompt, toolset with read enabled so skill references resolve.",
  system: SYSTEM_PROMPT,
  skills: [{ type: "custom", skill_id: SKILL_ID, version: SKILL_VERSION }],
  tools: [
    {
      type: "agent_toolset_20260401",
      default_config: {
        enabled: true,
        permission_policy: { type: "always_allow" },
      },
    },
  ],
});
console.log(`agent_id        ${agent.id}`);
console.log(`agent_version   ${agent.version}`);
console.log(`skill attached  ${SKILL_ID}@${SKILL_VERSION}`);

console.log(`\nExport these for the eval runner:`);
console.log(`  export CLASSIFIER_ENVIRONMENT_ID=${env.id}`);
console.log(`  export CLASSIFIER_AGENT_ID=${agent.id}`);
