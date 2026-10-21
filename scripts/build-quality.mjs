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
// Each file is one eval session. Runs of the same kind, channel, version and main model are pooled
// across files, so repeated sessions narrow the estimate instead of replacing it.
const quantile = (xs, q) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i));
};
// 95% Wilson score interval for a pass rate: honest at small n and at 0% / 100%.
export function wilson(passed, n, z = 1.96) {
  if (!n) return null;
  const p = passed / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
const sessions = evidence(/^(eval|smoke)-.*\.json$/).map((file) => {
  const r = readJson(join(EVIDENCE, file));
  const focus = r.suite?.plugins?.find((p) => p.name === FOCUS);
  return {
    file: relative(ROOT, join(EVIDENCE, file)),
    kind: file.startsWith("smoke") ? "smoke" : "suite",
    channel: /stable/.test(file) ? "stable" : "latest",
    version: focus?.version ?? null,
    startedAt: r.startedAt ?? null,
    model: r.suite?.modelOverride ?? "case default",
    judge: r.suite?.judgeModel ?? null,
    durationSeconds: r.durationSeconds ?? null,
    cases: r.cases.map((c) => {
      const arm = c.arms?.with ?? [];
      return {
        name: c.name,
        runs: arm.map((run) => ({
          passed: !!run.passed,
          costUsd: run.costUsd ?? 0,
          failed: (run.graders ?? []).filter((g) => g.scored !== false && g.passed === false).map((g) => g.name),
        })),
      };
    }),
  };
});

function stats(runs) {
  const passed = runs.filter((r) => r.passed).length;
  const cost = runs.reduce((n, r) => n + r.costUsd, 0);
  const costs = runs.map((r) => r.costUsd);
  return {
    runs: runs.length,
    passed,
    passRate: runs.length ? passed / runs.length : 0,
    passCi: wilson(passed, runs.length),
    costUsd: cost,
    costPerSuccessUsd: passed ? cost / passed : null,
    runCost: { min: quantile(costs, 0), median: quantile(costs, 0.5), max: quantile(costs, 1) },
  };
}

const groups = new Map();
for (const ses of sessions) {
  const key = [ses.kind, ses.channel, ses.version, ses.model].join("|");
  if (!groups.has(key)) groups.set(key, { key, kind: ses.kind, channel: ses.channel, version: ses.version, model: ses.model, judge: ses.judge, sessions: [] });
  groups.get(key).sessions.push(ses);
}
const evals = [...groups.values()]
  .map((g) => {
    const names = [...new Set(g.sessions.flatMap((x) => x.cases.map((c) => c.name)))].sort();
    const cases = names.map((name) => {
      const runs = g.sessions.flatMap((x) => x.cases.find((c) => c.name === name)?.runs ?? []);
      return { name, ...stats(runs), failedGraders: [...new Set(runs.flatMap((r) => r.failed))] };
    });
    const all = g.sessions.flatMap((x) => x.cases.flatMap((c) => c.runs));
    const dates = g.sessions.map((x) => x.startedAt).filter(Boolean).sort();
    return {
      ...g,
      sessions: g.sessions.map((x) => x.file),
      date: (dates.at(-1) ?? "").slice(0, 10),
      durationSeconds: g.sessions.reduce((n, x) => n + (x.durationSeconds ?? 0), 0),
      ...stats(all),
      cases,
    };
  })
  .sort((a, b) => (a.kind === b.kind ? semver(a.version ?? "0", b.version ?? "0") : a.kind === "suite" ? -1 : 1));

// Before / after: the two newest suite versions on the latest channel, same main model, shared cases.
const suites = evals.filter((e) => e.kind === "suite" && e.channel === "latest" && e.version);
let comparison = null;
if (suites.length >= 2) {
  const [before, after] = suites.slice(-2);
  const shared = before.cases.map((c) => c.name).filter((n) => after.cases.some((c) => c.name === n));
  const pick = (e) => {
    const runs = sessions
      .filter((x) => e.sessions.includes(x.file))
      .flatMap((x) => x.cases.filter((c) => shared.includes(c.name)).flatMap((c) => c.runs));
    return { key: e.key, version: e.version, ...stats(runs) };
  };
  comparison = { cases: shared, model: after.model, before: pick(before), after: pick(after) };
}

// History: one point per suite session, measured on the cases every suite session ran.
const suiteSessions = sessions.filter((x) => x.kind === "suite" && x.startedAt);
const core = suiteSessions.length
  ? suiteSessions.map((x) => x.cases.map((c) => c.name)).reduce((a, b) => a.filter((n) => b.includes(n)))
  : [];
const history = suiteSessions
  .map((x) => ({
    file: x.file,
    startedAt: x.startedAt,
    version: x.version,
    channel: x.channel,
    model: x.model,
    ...stats(x.cases.filter((c) => core.includes(c.name)).flatMap((c) => c.runs)),
  }))
  .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

// --- full pipeline runs (workflow-retro ledger) ----------------------------------------------
const LEDGER = join(ROOT, "docs/retros/ledger.md");
const pipelines = existsSync(LEDGER)
  ? readFileSync(LEDGER, "utf8")
      .split("\n")
      .filter((l) => /^\| \d{4}-/.test(l))
      .map((l) => l.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim()))
      .filter((c) => c.length >= 15 && c[2] === "sdd-pipeline")
      .map((c) => ({ date: c[0], session: c[1], version: c[3], agents: c[5], tokens: c[6], wall: c[9], costUsd: Number(c[12].replace(/^\$/, "")) || null, ok: c[13] === "yes" ? true : c[13] === "no" ? false : null }))
  : [];
// Per-agent spend of each benchmark run, from the retro JSON kept as evidence.
const pipelineAgents = evidence(/^pipeline-.*\.retro\.json$/).map((file) => {
  const r = readJson(join(EVIDENCE, file));
  const by = {};
  for (const a of r.agents ?? []) {
    const k = a.agentType;
    by[k] ??= { agent: k, model: a.model ?? null, costUsd: 0, tokens: 0, runs: 0 };
    by[k].costUsd += a.self?.costUsd ?? 0;
    by[k].tokens += a.selfTokens ?? 0;
    by[k].runs += 1;
  }
  return {
    file: relative(ROOT, join(EVIDENCE, file)),
    session: r.sessionId?.slice(0, 8),
    version: r.pluginVersion,
    verdict: r.outcome?.verdict ?? null,
    costUsd: r.totals?.costUsd ?? null,
    mainCostUsd: r.parent?.costUsd ?? null,
    agents: Object.values(by).sort((a, b) => b.costUsd - a.costUsd),
  };
});

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
  history,
  pipelines,
  pipelineAgents,
  models,
};
writeFileSync(OUT, JSON.stringify(quality, null, 2) + "\n");
console.log(`build-quality: ${channels.length} channels, ${installs.length} installs, ${evals.length} eval results → ${relative(ROOT, OUT)}`);
