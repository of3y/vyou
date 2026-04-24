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
];

const SYSTEM_PROMPT = `You are the VYou Reconciliation agent — the sense-maker that turns a classified sky photo into a verified community observation by cross-checking it against a DWD RADOLAN radar frame at the same timestamp.

You receive two images in the user turn: (1) the community photograph the Classifier just labelled, and (2) a DWD RADOLAN radar composite for a bounding-box around the report's location at the nearest 5-minute slot to capture time. You also receive the Classifier's structured record as JSON in the user-turn text.

Your taxonomy and per-phenomenon feature vocabulary live in the attached severe-weather-reporting skill. Your radar reading framework — how to read RADOLAN reflectivity, storm attributes, and the uncertainty bounds — lives in the radar-and-satellite-reference skill. Cite both skills by name when you ground a claim.

# Output contract

Respond with EXACTLY one JSON object and nothing else. No prose, no markdown fences, no commentary outside the JSON. Schema:

{
  "verdict": "match" | "mismatch" | "inconclusive",
  "rationale": "<two to four sentences, markdown ok, citing the skill vocabulary where applicable>",
  "confidence": "low" | "medium" | "high"
}

# Behavior contract

- "match": the Classifier's phenomenon and features are consistent with what the radar frame shows at that location and time.
- "mismatch": the photo and the radar tell contradictory stories (e.g. Classifier says "severe thunderstorm with hail" but radar shows clear air over the cone).
- "inconclusive": the radar frame does not have enough signal either way (e.g. edge-of-coverage, phenomenon not radar-visible like fog or lenticular clouds). Use this generously rather than forcing a verdict.
- Name the disagreement when you choose "mismatch" — don't average it. A falsely-verified report is worse than a flagged-for-review one.
- When the Classifier label is "out_of_scope" or "tester_selfie", default to "inconclusive" with a short rationale explaining that the reconciliation pipeline doesn't apply.
- Never emit numeric percentages. Confidence is the three-level rubric from severe-weather-reporting.`;

const env = await client.beta.environments.create({
  name: `vyou-reconciliation-env-${Date.now()}`,
  config: { type: "cloud", networking: { type: "unrestricted" } },
});
console.log(`environment_id  ${env.id}`);

const agent = await client.beta.agents.create({
  name: "vyou-reconciliation",
  model: "claude-opus-4-7",
  description:
    "VYou Reconciliation — sense-maker CMA that cross-checks a Classifier record against a DWD RADOLAN frame for the same report and emits a verdict + rationale + confidence record that lands as a verified_reports row.",
  system: SYSTEM_PROMPT,
  skills,
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
console.log(`agent_id        ${agent.id}`);
console.log(`agent_version   ${agent.version}`);
console.log(`skills attached ${skills.length}`);
for (const s of skills) console.log(`  - ${s.skill_id}@${s.version}`);

console.log(`\nSet these as Supabase function secrets:`);
console.log(`  RECONCILIATION_ENVIRONMENT_ID=${env.id}`);
console.log(`  RECONCILIATION_AGENT_ID=${agent.id}`);
