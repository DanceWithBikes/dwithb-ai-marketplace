#!/usr/bin/env node
// Builds site/public/quality.json for the catalog's Quality view: release channels, install
// proofs, eval results and cost per successful run. No dependencies.
//
//   node scripts/build-quality.mjs [--out site/public/quality.json]
//
// Sources, all in the repository:
//   - channels: .claude-plugin/marketplace.json (latest) and the `stable` branch's copy;
//   - installs: docs/evidence/plugin-list-*.json (`claude plugin list --json` from a clean config);
//   - evals:    docs/evidence/{eval,smoke}-*.json (`claude plugin eval --json`);
//   - models:   agent frontmatter of every sdd-engineering release tag and of the working tree.
// The raw eval files carry prompts and local paths; only aggregates are copied out.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { summarize } from "./eval-cost.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.indexOf("--out");
const OUT = resolve(ROOT, outArg > -1 ? process.argv[outArg + 1] : "site/public/quality.json");
const EVIDENCE = join(ROOT, "docs/evidence");
const FOCUS = "sdd-engineering";

const git = (...args) => {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
};
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const evidence = (re) => (existsSync(EVIDENCE) ? readdirSync(EVIDENCE).filter((f) => re.test(f)).sort() : []);
const semver = (a, b) => a.split(/[.-]/).map(Number).reduce((d, n, i) => d || n - (Number(b.split(/[.-]/)[i]) || 0), 0);

// --- channels -------------------------------------------------------------------------
function channel(id, branch, mp) {
  if (!mp) return null;
  return {
    id,
    branch,
    marketplace: mp.name,
    add: `claude plugin marketplace add DanceWithBikes/dwithb-ai-marketplace${branch === "main" ? "" : `#${branch}`}`,
    plugins: mp.plugins.map((e) => {
      const local = typeof e.source === "string" ? join(ROOT, e.source, ".claude-plugin/plugin.json") : null;
      const pinned = typeof e.source === "object" ? e.source.ref ?? e.source.sha ?? null : null;
      // A pinned entry serves the tag's version; a path entry serves the branch's plugin.json.
      const fromBranch = branch === "main" ? (local && existsSync(local) ? readJson(local).version : null) : branchVersion(branch, e.source);
      return { id: e.name, version: e.version ?? (pinned?.match(/--v(.+)$/)?.[1]) ?? fromBranch, pinned };
    }),
  };
}
function branchVersion(branch, source) {
  if (typeof source !== "string") return null;
  const raw = gitShow(branch, `${source.replace(/^\.\//, "")}/.claude-plugin/plugin.json`);
  return raw ? JSON.parse(raw).version : null;
}
function gitShow(branch, path) {
  for (const ref of [`origin/${branch}`, branch]) {
    const out = git("show", `${ref}:${path}`);
    if (out) return out;
  }
  return null;
}
const stableRaw = gitShow("stable", ".claude-plugin/marketplace.json");
const channels = [
  channel("latest", "main", readJson(join(ROOT, ".claude-plugin/marketplace.json"))),
  channel("stable", "stable", stableRaw ? JSON.parse(stableRaw) : null),
].filter(Boolean);

// --- install proofs ----------------------------------------------------------------------
const installs = evidence(/^plugin-list-.*\.json$/).map((file) => {
  const list = readJson(join(EVIDENCE, file));
  const focus = list.find((p) => p.id.startsWith(`${FOCUS}@`));
  return {
    file: relative(ROOT, join(EVIDENCE, file)),
    label: file.replace(/^plugin-list-|\.json$/g, ""),
    marketplace: focus?.id.split("@")[1] ?? null,
    version: focus?.version ?? null,
    plugins: list.map((p) => ({ id: p.id.split("@")[0], version: p.version, enabled: p.enabled === true, errors: (p.errors ?? []).length })),
  };
});

// --- eval results --------------------------------------------------------------------------
const evals = evidence(/^(eval|smoke)-.*\.json$/).map((file) => {
  const r = readJson(join(EVIDENCE, file));
  const s = summarize(r);
  const focus = r.suite?.plugins?.find((p) => p.name === FOCUS);
  const stable = /stable/.test(file);
  return {
    key: file.replace(/\.json$/, ""),
    file: relative(ROOT, join(EVIDENCE, file)),
    kind: file.startsWith("smoke") ? "smoke" : "suite",
    channel: stable ? "stable" : "latest",
    version: focus?.version ?? null,
    date: s.date,
    model: s.model,
    judge: r.suite?.judgeModel ?? null,
    threshold: r.suite?.threshold ?? null,
    durationSeconds: r.durationSeconds ?? null,
    claudeVersion: r.claudeVersion ?? null,
    runs: s.runs,
    passed: s.passed,
    passRate: s.passRate,
    costUsd: s.costUsd,
    costPerSuccessUsd: s.costPerSuccessUsd,
    cases: r.cases.map((c) => {
      const arm = c.arms?.with ?? [];
      const failed = new Set(arm.flatMap((run) => (run.graders ?? []).filter((g) => g.scored !== false && g.passed === false).map((g) => g.name)));
      const pc = s.perCase.find((x) => x.name === c.name);
      return { name: c.name, runs: pc.runs, passed: pc.passed, costUsd: pc.costUsd, costPerSuccessUsd: pc.costPerSuccessUsd, graders: (c.graders ?? []).length, failedGraders: [...failed] };
    }),
  };
});

// Before / after: the two newest full-suite results of different versions, on their shared cases.
const suites = evals.filter((e) => e.kind === "suite" && e.version).sort((a, b) => semver(a.version, b.version));
let comparison = null;
if (suites.length >= 2) {
  const [before, after] = suites.slice(-2);
  const shared = before.cases.map((c) => c.name).filter((n) => after.cases.some((c) => c.name === n));
  const pick = (e) => {
    const cs = e.cases.filter((c) => shared.includes(c.name));
    const runs = cs.reduce((n, c) => n + c.runs, 0);
    const passed = cs.reduce((n, c) => n + c.passed, 0);
    const cost = cs.reduce((n, c) => n + c.costUsd, 0);
    return { key: e.key, version: e.version, runs, passed, passRate: runs ? passed / runs : 0, costUsd: cost, costPerSuccessUsd: passed ? cost / passed : null };
  };
  comparison = { cases: shared, model: after.model, before: pick(before), after: pick(after) };
}

// --- agent models per release -------------------------------------------------------------
function agentModels(read, list) {
  return list
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const fm = read(f).match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
      const field = (k) => fm.match(new RegExp(`^${k}:\\s*(.+)$`, "m"))?.[1].trim() ?? null;
      return { agent: field("name") ?? f.replace(/\.md$/, ""), model: field("model"), effort: field("effort") };
    });
}
const agentDir = `plugins/${FOCUS}/agents`;
const releases = (git("tag", "--list", `${FOCUS}--v*`) ?? "")
  .split("\n")
  .filter(Boolean)
  .map((tag) => ({ tag, version: tag.replace(`${FOCUS}--v`, "") }))
  .sort((a, b) => semver(a.version, b.version));
const models = releases.map(({ tag, version }) => ({
  version,
  tag,
  agents: agentModels((f) => git("show", `${tag}:${agentDir}/${f}`) ?? "", (git("ls-tree", "--name-only", `${tag}:${agentDir}`) ?? "").split("\n")),
}));
const treeVersion = readJson(join(ROOT, `plugins/${FOCUS}/.claude-plugin/plugin.json`)).version;
if (!models.some((m) => m.version === treeVersion)) {
  const dir = join(ROOT, agentDir);
  models.push({ version: treeVersion, tag: null, agents: agentModels((f) => readFileSync(join(dir, f), "utf8"), readdirSync(dir).sort()) });
}

const quality = {
  schemaVersion: 1,
  plugin: FOCUS,
  generatedAt: evals.map((e) => e.date).sort().at(-1) ?? null,
  channels,
  installs,
  evals,
  comparison,
  models,
};
writeFileSync(OUT, JSON.stringify(quality, null, 2) + "\n");
console.log(`build-quality: ${channels.length} channels, ${installs.length} installs, ${evals.length} eval results → ${relative(ROOT, OUT)}`);
