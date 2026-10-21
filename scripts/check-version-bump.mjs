#!/usr/bin/env node
// Fails when a plugin's shipped files changed against <base> but its plugin.json version did not.
// Claude Code updates an installed plugin only when the version changes, so such a change
// never reaches existing installs. evals/ is ignored: it does not change what users run.
//
//   node scripts/check-version-bump.mjs <base-ref>

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.argv[2];
if (!base) {
  console.error("usage: check-version-bump.mjs <base-ref>");
  process.exit(2);
}

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });

function versionAt(ref, name) {
  try {
    return JSON.parse(git("show", `${ref}:plugins/${name}/.claude-plugin/plugin.json`)).version;
  } catch {
    return null; // plugin did not exist at ref
  }
}

let failed = false;
for (const name of readdirSync(join(ROOT, "plugins")).sort()) {
  const manifest = join(ROOT, "plugins", name, ".claude-plugin", "plugin.json");
  if (!existsSync(manifest)) continue;
  const before = versionAt(base, name);
  if (before === null) continue;
  const now = JSON.parse(readFileSync(manifest, "utf8")).version;
  const changed = git("diff", "--name-only", base, "--", `plugins/${name}`, `:(exclude)plugins/${name}/evals`)
    .split("\n")
    .filter(Boolean);
  if (changed.length && now === before) {
    failed = true;
    console.error(`::error::${name}: ${changed.length} shipped file(s) changed but version is still ${now}. Bump .claude-plugin/plugin.json and add a CHANGELOG entry.`);
    for (const f of changed) console.error(`  ${f}`);
  } else {
    console.log(`${name}: ${changed.length ? `${before} -> ${now}` : "unchanged"}`);
  }
}
process.exit(failed ? 1 : 0);
