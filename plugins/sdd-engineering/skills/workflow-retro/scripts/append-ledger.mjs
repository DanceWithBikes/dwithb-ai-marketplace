#!/usr/bin/env node
// Step 4 of workflow-retro: append one row per retro to the retro ledger (default
// docs/retros/ledger.md, or --ledger <path>) so runs can be compared over time.
// Append-only - existing rows are never rewritten.
//
//   node append-ledger.mjs <retro.json> --action "<top action>" [--success yes|no] [--ledger <path>] [--force]
//
// <retro.json> is the stdout of retro.mjs (use "-" for stdin). A relative --ledger path resolves
// against the git root of the current directory. The same session + mode + label is not appended
// twice unless --force. Success comes from the run's plan-verifier verdict (COMPLETE); --success
// overrides it for runs without one. After appending, it prints the cost per successful run of
// the same label and plugin version: sum of their cost / number of successful rows.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fmtMs, fmtTokens, fmtUsd, parseArgs, repoRoot } from "./lib.mjs";

export const DEFAULT_LEDGER = join("docs", "retros", "ledger.md");

export const HEADER = `# Workflow retro ledger

One row per retro run, appended by the \`workflow-retro\` skill's \`append-ledger.mjs\` script.
Compare rows of the same kind of run (same label) to see whether the last action paid off.

- **mode** - \`quick\` counts the parent only (child spend missing); \`deep\` reads every subagent log. Only compare deep with deep.
- **tokens** - input + output + cache read + cache write, all agents. **cache** - cache read / all prompt tokens.
- **agents / depth** - subagents spawned / deepest nesting. **peak** - most agents alive at once.
- **par.** - agent-time / time any agent was alive (1.0 = sequential).
- **version** - active sdd-engineering version from the version-trace hook. **cost** - USD at list prices, all agents.
- **ok** - \`yes\` when plan-verifier said COMPLETE (or \`--success yes\`). Cost per successful run = Σ cost / rows with ok = yes.

| date | session | label | version | mode | agents / depth | tokens | cache | tool calls | wall | peak | par. | cost | ok | top action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
`;

const cell = (v) => String(v ?? "-").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim() || "-";

const okCell = (success) => (success == null ? null : success ? "yes" : "no");

export function ledgerRow(r, action, success = r.outcome?.success) {
  const t = r.totals;
  const p = r.parallelism;
  return `| ${[
    (r.startedAt ?? new Date().toISOString()).slice(0, 10),
    r.sessionId.slice(0, 8),
    r.label,
    r.pluginVersion,
    r.mode,
    `${t.agents} / ${t.maxDepth}`,
    fmtTokens(t.totalTokens),
    t.cacheHit == null ? null : `${t.cacheHit}%`,
    t.toolCalls,
    fmtMs(r.wallMs),
    p?.peakConcurrency,
    p ? `${p.factor}×` : null,
    t.costUsd == null ? null : fmtUsd(t.costUsd),
    okCell(success),
    action,
  ]
    .map(cell)
    .join(" | ")} |`;
}

// Rows of one label (and version, when given): runs, successes and cost per successful run.
export function costPerSuccess(text, label, version) {
  const rows = text
    .split("\n")
    .filter((l) => /^\| \d{4}-/.test(l))
    .map((l) => l.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim()))
    .filter((c) => c.length >= 15 && c[2] === cell(label) && (version == null || c[3] === cell(version)));
  const cost = rows.reduce((n, c) => n + (Number(c[12].replace(/^\$/, "")) || 0), 0);
  const ok = rows.filter((c) => c[13] === "yes").length;
  return { label, version: version ?? null, runs: rows.length, successes: ok, costUsd: cost, costPerSuccessUsd: ok ? cost / ok : null };
}

export function appendLedger(ledger, r, action, { force = false, success } = {}) {
  if (!existsSync(ledger)) {
    mkdirSync(dirname(ledger), { recursive: true });
    writeFileSync(ledger, HEADER);
  }
  const existing = readFileSync(ledger, "utf8");
  const key = `| ${r.sessionId.slice(0, 8)} | ${cell(r.label)} | ${cell(r.pluginVersion)} | ${r.mode} |`;
  if (!force && existing.includes(key)) return { appended: false, reason: `row for ${key} already exists (use --force)` };
  const row = ledgerRow(r, action, success ?? r.outcome?.success);
  appendFileSync(ledger, `${existing.endsWith("\n") ? "" : "\n"}${row}\n`);
  return { appended: true, row, trend: costPerSuccess(readFileSync(ledger, "utf8"), r.label, r.pluginVersion) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const src = args._[0];
  if (!src) {
    console.error("usage: append-ledger.mjs <retro.json|-> --action <text> [--success yes|no] [--ledger <path>] [--force]");
    process.exit(2);
  }
  const r = JSON.parse(readFileSync(src === "-" ? 0 : src, "utf8"));
  const root = repoRoot();
  const ledger =
    typeof args.ledger === "string" && args.ledger.trim()
      ? isAbsolute(args.ledger)
        ? args.ledger
        : resolve(root, args.ledger)
      : join(root, DEFAULT_LEDGER);
  const success = args.success === "yes" ? true : args.success === "no" ? false : undefined;
  const res = appendLedger(ledger, r, typeof args.action === "string" ? args.action : null, { force: !!args.force, success });
  console.log(JSON.stringify({ ledger, ...res }));
}
