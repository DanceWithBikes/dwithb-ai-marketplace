#!/usr/bin/env node
// Cost per successful workflow from a `claude plugin eval --json` result, appended as one row
// to docs/retros/eval-cost.md so releases can be compared (before / after an optimisation).
// No dependencies.
//
//   node scripts/eval-cost.mjs <eval.json> [--label <text>] [--exclude <case,case>] [--out docs/retros/eval-cost.md] [--dry-run]
//
// --exclude drops cases, so two results are compared on the same case set.
//
// A "successful workflow" is one eval run (with-plugin arm) whose graders passed. Cost is what
// the agent under test spent in that arm, judge cost excluded: Σ run cost / passed runs. Every
// run counts toward the cost, failed ones included — a retry is what a failure costs.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const HEADER = `# Eval cost per successful workflow

One row per \`claude plugin eval --json\` result, appended by \`scripts/eval-cost.mjs\`.
Compare rows with the same label, model and case set: the version that moves **$ / success** down
without lowering **pass rate** is the cheaper release.

- **runs / passed** - with-plugin runs across all cases / runs whose graders all passed.
- **agent cost** - USD spent by the agent under test (subagents included), judge cost excluded.
- **$ / success** - agent cost / passed runs.

| date | label | plugin@version | main model | cases | runs / passed | pass rate | agent cost | $ / success | per case $ / success |
|---|---|---|---|---|---|---|---|---|---|
`;

export function summarize(result, exclude = []) {
  const perCase = [];
  let runs = 0;
  let passed = 0;
  let cost = 0;
  const cases = result.cases.filter((c) => !exclude.includes(c.name));
  for (const c of cases) {
    const arm = c.arms?.with ?? [];
    const ok = arm.filter((r) => r.passed).length;
    const spent = arm.reduce((n, r) => n + (r.costUsd ?? 0), 0);
    runs += arm.length;
    passed += ok;
    cost += spent;
    perCase.push({ name: c.name, runs: arm.length, passed: ok, costUsd: spent, costPerSuccessUsd: ok ? spent / ok : null });
  }
  const plugin = result.suite?.plugins?.find((p) => p.name === "sdd-engineering") ?? result.suite?.plugins?.[0] ?? {};
  return {
    date: (result.startedAt ?? new Date().toISOString()).slice(0, 10),
    plugin: plugin.name ? `${plugin.name}@${plugin.version}` : null,
    model: result.suite?.modelOverride ?? "case default",
    cases: cases.length,
    runs,
    passed,
    passRate: runs ? passed / runs : 0,
    costUsd: cost,
    costPerSuccessUsd: passed ? cost / passed : null,
    perCase,
  };
}

const usd = (n) => (n == null ? "n/a" : `$${n.toFixed(4)}`);

export function row(s, label) {
  const per = s.perCase.map((c) => `${c.name} ${usd(c.costPerSuccessUsd)}`).join("; ");
  return `| ${[s.date, label ?? "-", s.plugin ?? "-", s.model, s.cases, `${s.runs} / ${s.passed}`, `${Math.round(s.passRate * 100)}%`, usd(s.costUsd), usd(s.costPerSuccessUsd), per].join(" | ")} |`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const opt = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const src = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
  if (!src) {
    console.error("usage: eval-cost.mjs <eval.json> [--label <text>] [--exclude <case,case>] [--out <path>] [--dry-run]");
    process.exit(2);
  }
  const s = summarize(JSON.parse(readFileSync(src, "utf8")), (opt("--exclude") ?? "").split(",").filter(Boolean));
  const line = row(s, opt("--label"));
  if (!argv.includes("--dry-run")) {
    const out = resolve(ROOT, opt("--out") ?? "docs/retros/eval-cost.md");
    if (!existsSync(out)) {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, HEADER);
    }
    appendFileSync(out, `${line}\n`);
  }
  console.log(JSON.stringify({ ...s, row: line }, null, 2));
}
