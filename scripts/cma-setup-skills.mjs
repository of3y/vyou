import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { createReadStream, readdirSync, statSync } from "node:fs";
import { join, relative, sep, posix } from "node:path";
import { fileURLToPath } from "node:url";

const client = new Anthropic();

const SKILLS_ROOT = fileURLToPath(new URL("../skills", import.meta.url));
const SKILL_NAME = process.argv[2] ?? "severe-weather-reporting";
const SKILL_DIR = join(SKILLS_ROOT, SKILL_NAME);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}

const absoluteFiles = walk(SKILL_DIR);
if (!absoluteFiles.some((p) => p.endsWith(`${sep}SKILL.md`))) {
  throw new Error(`No SKILL.md found at the root of ${SKILL_DIR}`);
}

const uploads = await Promise.all(
  absoluteFiles.map(async (abs) => {
    const rel = relative(SKILLS_ROOT, abs).split(sep).join(posix.sep);
    return toFile(createReadStream(abs), rel);
  }),
);

console.log(`Uploading ${uploads.length} files under top-level "${SKILL_NAME}"/`);

const skill = await client.beta.skills.create({
  display_title: SKILL_NAME,
  files: uploads,
});

console.log(`skill_id         ${skill.id}`);
console.log(`latest_version   ${skill.latest_version}`);
console.log(`display_title    ${skill.display_title}`);
console.log(`\nSet these as Supabase function secrets (or env for cma-setup-classifier.mjs):`);
console.log(`  ${envKey(SKILL_NAME)}_SKILL_ID=${skill.id}`);
console.log(`  ${envKey(SKILL_NAME)}_SKILL_VERSION=${skill.latest_version}`);

function envKey(name) {
  return name.replace(/-/g, "_").toUpperCase();
}
