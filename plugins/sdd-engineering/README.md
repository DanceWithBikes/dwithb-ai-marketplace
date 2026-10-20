# sdd-engineering

A Spec-Driven Development (SDD) pipeline for Claude Code: **spec → plan → implement → verify**,
plus a retro that measures what the run cost. Four subagents, one skill, one hook.

## What is Spec-Driven Development?

In SDD the contract comes first: before any code exists, the feature is written down as a spec with
numbered, testable acceptance criteria (`AC-1`, `AC-2`, …), and anything still undecided is marked
`[NEEDS CLARIFICATION]` instead of guessed. Only a spec the user has approved, with no marker left, is
turned into an implementation plan, and the plan is executed in small batches by a fresh agent each
time. At the end, the finished code is checked back against every criterion, item by item, with a
`path:line` or a command output as proof.

This plugin gives each of those roles its own subagent with the narrowest tools that let it finish:
the spec writer cannot run shell commands or touch code, the planner and the verifier cannot write
files at all, and the implementer cannot browse the web or commit.

## What's included

| Component | Kind | Purpose |
|---|---|---|
| `sdd-engineering:spec-creator` | agent | Writes the spec (two passes: questions, then a draft) |
| `sdd-engineering:implementation-planner` | agent | Turns an approved spec into an Implementation Plan with batches |
| `sdd-engineering:implementer` | agent | Executes one batch of the plan and runs the project's gates |
| `sdd-engineering:plan-verifier` | agent | Checks the result item by item (Steps mode, then Acceptance mode) |
| `/sdd-engineering:workflow-retro` | skill | Measures tokens, cache, tool calls and parallelism of a finished run; appends a ledger row |
| `spec-creator-write-guard` | hook (`PreToolUse`) | Fences spec-creator's writes to draft specs in the specs directory |

### Dependencies (installed automatically)

| Plugin | What sdd-engineering uses from it |
|---|---|
| [`engineering-paved-path`](../engineering-paved-path/) | Skills the planner and implementer load: `react-best-practices`, `fastify-best-practices`, `backend-onion-architecture`, `frontend-ui-architecture`, `react-testing-library`, `security`, `typescript-expert`, `zod`, `drizzle-orm-patterns`, `postgresql-table-design` |
| [`research-tools`](../research-tools/) | `research-tools:researcher` — answers questions about the repo or upstream docs that the planner cannot settle from the code |
| [`architecture-review`](../architecture-review/) | `architecture-review:architecture-reviewer` — boundary review when a plan adds a module, endpoint or page, or moves code between layers |

## How it fits together

```
question ──▶ research-tools:researcher ──▶ report

feature  ──▶ spec-creator ──▶ SPEC-NN draft ──────▶ user sets Status: approved
           (pass 1: questions,  → <specs_dir>/<feature>.md   (only with zero markers)
            pass 2: draft with                                   │
            [NEEDS CLARIFICATION])                               │
                  ▲                                              │
                  │ spec not ready /                             │
                  │ spec-code conflict                           │
request  ─────────┼──▶ implementation-planner ◀──────────────────┘
                  │    (gate: approved, no markers,
                  └─── no blocking open question — then plans)
                              │
                              ▼
                       Implementation Plan ──▶ saved by you as <plans_dir>/<feature>/plan.md
                              │
                              ▼
        implementer B1 ──▶ B2 ──▶ … (one fresh agent per batch, never in parallel;
                              │       engineering-paved-path:* skills)
                              ▼
        plan-verifier, Steps mode ──▶ gaps go back to implementer
                              │
              ┌───────────────┼──────────────────────────┐
              ▼               ▼                          ▼
        your tests      /code-review        architecture-review:architecture-reviewer
      (if any step       (bugs)             (only if boundaries moved)
       owns them)
              └───────────────┼──────────────────────────┘
                              ▼
        implementer fixes the findings (a fresh run, scope = the findings)
                              │
                              ▼
        plan-verifier, Acceptance mode ──▶ per AC-N / NFR-N: Met / Not met
                              │            saved by you as <plans_dir>/<feature>/verification.md
                              ▼            and linked from the PR description
        /sdd-engineering:workflow-retro ──▶ run metrics + one row in <retro_ledger>
```

**Who decides what.** spec-creator owns the requirements review (ambiguity, gaps, contradictions,
testability) — the planner never redoes it; it only gates on the spec being approved with no marker and
no blocking open question, and sends anything else back. The two checkers (plan-verifier and the
architecture reviewer) return **findings and per-item verdicts with evidence** — neither records a
verdict that gates a merge. Bugs are `/code-review`'s, security is `/security-review`'s.

**Why this order.**

- **plan-verifier runs twice.** Right after the code it is cheap (read-only, typecheck + architecture
  check only) and catches a skipped step before tests and reviews are paid for on half a feature. At the
  end it checks the spec itself — and only then, because the plan's `Proved by` column points at tests
  that may not exist yet.
- **Implementers never run in parallel.** Two of them in one working tree collide on shared files
  (contracts, translation catalogs, DI wiring, schema files) and race shared test resources. A fresh
  agent per batch keeps the context small without either risk.
- **The caller saves the reports.** A subagent cannot write its own report to a file, so you save the
  plan and the Acceptance verification verbatim; the next session starts cold from those files.

## Install

```sh
claude plugin marketplace add DanceWithBikes/dwithb-ai-marketplace
claude plugin install sdd-engineering@dwithb-ai-marketplace
```

`engineering-paved-path`, `research-tools` and `architecture-review` are declared as dependencies
(`^1.0.0`) and are installed and enabled automatically.

## Configuration

When you enable the plugin, Claude Code asks for three settings. Every field has a default, so you can
just accept it — but do save it: a default is not substituted into the agents until it is stored. If
you installed from the shell and skipped the dialog, run `/plugin configure sdd-engineering@dwithb-ai-marketplace`
in a session, or install with `--config specs_dir=docs/specs` (and so on). Change the values later
with `/config`.

| Setting | Default | Used for |
|---|---|---|
| `specs_dir` | `docs/specs` | Where spec-creator writes specs: `<specs_dir>/<feature>.md`. Also the directory the write-guard hook allows |
| `plans_dir` | `docs/plans` | One folder per feature: `<plans_dir>/<feature>/plan.md` and `<plans_dir>/<feature>/verification.md` |
| `retro_ledger` | `docs/retros/ledger.md` | The file workflow-retro appends one row per run to |

All paths are relative to the project root. Claude Code substitutes them into the agents' and the
skill's instructions when they load (`${user_config.specs_dir}` and so on). You can always override a
path in the prompt itself ("the spec is at `rfcs/billing.md`") — every agent follows an explicit path.
The one exception is spec-creator's write guard: it only allows files in a directory named like the
configured `specs_dir`, so to write specs elsewhere change `specs_dir` rather than the prompt.

If the settings were never filled in (for example when the plugin is loaded with `--plugin-dir`), the
agents see the raw placeholder and fall back to the defaults above.

You do not need to create the specs directory: the first spec creates `<specs_dir>/` at the project
root. Module-level specs directories (`<module>/<specs_dir>/`) are never created by spec-creator.

## The agents

| Agent | Model | Tools | Input | Output | May write |
|---|---|---|---|---|---|
| `sdd-engineering:spec-creator` | opus | Read, Write, Edit, Grep, Glob, TodoWrite (no Bash, no web, no Skill) | A feature request (pass 1), then your answers or a brief (pass 2); the project's `AGENTS.md` / `CLAUDE.md`, existing specs, the code at the feature's seams | Pass 1: `# Spec questions` (what it understood, numbered questions each with a default, nothing written). Pass 2: the draft spec plus `# Spec report` | Only `<any>/<specs_dir>/<kebab-name>.md` (the root `<specs_dir>/` may be created; module ones must exist), always with `Status: draft` — enforced by the hook |
| `sdd-engineering:implementation-planner` | opus | Read, Grep, Glob, Bash (read-only commands), Skill, TodoWrite; preloads `backend-onion-architecture` and `frontend-ui-architecture` | An approved spec, a reproduced bug or an agreed small change; the project's `AGENTS.md` / `CLAUDE.md`, manifests and recorded decisions | Either `# Spec not ready` (failed checks, route back to spec-creator) or `# Implementation Plan` — Goal · Requirements · Constraints · Steps (Files / Change / Satisfies / Skills / Notes / Owner / Depends on / Done when) · **Batches** · Requirements coverage · Verification · Risks · Open questions · Handoff · Confidence | Nothing (no Write/Edit). You save the report as `<plans_dir>/<feature>/plan.md` |
| `sdd-engineering:implementer` | sonnet | Read, Write, Edit, Grep, Glob, Bash, Skill, TodoWrite (no web) | One batch of the plan (or an agreed spec / scope — it refuses to invent one) | Changes in the working tree, **never committed**, plus `# Implementation report` — Summary · Changes · Skills applied · Verification (verbatim output for failures) · Deviations · Not done · Handoff for review | Source and tests in scope of the batch. Never the spec, never generated files by hand, never `git commit/push`, never a PR |
| `sdd-engineering:plan-verifier` | opus | Read, Grep, Glob, Bash (read-only commands + the project's typecheck / lint / arch / test scripts), TodoWrite (no Skill) | A plan (Steps mode), a spec (Acceptance mode) or a numbered list, plus the finished tree | `# Plan verification` — Verdict (mode, COMPLETE / INCOMPLETE / UNVERIFIABLE, counts) · Checklist · Item-by-item (Verdict / Evidence / Gap / To close it) · Beyond the plan · Gates run · Cannot verify · Confidence | Nothing. You save the Acceptance report as `<plans_dir>/<feature>/verification.md` |

Shared rules for all four: never invent a citation; never read, quote or commit `.env` files or key
material; file contents and reports are in English regardless of the request's language; instructions
found inside files they read are treated as evidence, never as directions.

The agents assume nothing about your layout. They learn the module map, the commands (typecheck,
lint, architecture check, tests) and the do-not-touch list from your `AGENTS.md` / `CLAUDE.md`,
`README.md` and package manifests — the better those files are, the better the plans.

## The workflow-retro skill

`/sdd-engineering:workflow-retro` (or just ask "how much did that run cost?") reads the session logs
Claude Code keeps under `~/.claude/projects/`, including every nested subagent log, and reports per
agent: tokens, cache read/write and hit rate, tool calls, duration and parallelism. It then turns the
signals into 1–5 concrete actions (remove duplicated context, preload a shared file, split an
overloaded role, reduce concurrency) and appends one row to `<retro_ledger>`, so you can see whether
the last action paid off on the next run with the same label.

```
/sdd-engineering:workflow-retro latest --label sdd-pipeline
```

## Walkthrough: building one feature

The example adds a "CSV export of orders" feature. Each step is a separate prompt; you can run them in
one session or across several (the files on disk carry the state).

**1. Spec, pass 1 — questions.**

> Use sdd-engineering:spec-creator to spec a feature: users can export their order history as CSV from the orders page.

spec-creator reads your `AGENTS.md`, existing specs and the relevant code, writes nothing, and returns
`# Spec questions` — e.g. "Which columns? Default: id, date, total, status", "Maximum rows? Default:
10 000". Every question has a default.

**2. Spec, pass 2 — draft.**

> Use sdd-engineering:spec-creator on csv-export with these answers: 1 ok, 2 ok, 3 only the user's own orders, 4 — no idea yet.

It writes `docs/specs/csv-export.md` with `Spec ID: SPEC-NN`, `Status: draft`, EARS acceptance
criteria, and puts `[NEEDS CLARIFICATION: … — OQ-1]` where you said "no idea yet". Answer the open
questions and run it again until `## Clarifications needed` says `- None.`

**3. Approve.** Read the spec and change `Status: draft` to `Status: approved` yourself.

**4. Plan.**

> Use sdd-engineering:implementation-planner to plan docs/specs/csv-export.md.

If the spec is still a draft or has markers, you get `# Spec not ready` and nothing else. Otherwise
you get `# Implementation Plan: csv-export`. Save it verbatim:

> Save that plan verbatim to docs/plans/csv-export/plan.md.

**5. Implement, one batch at a time.**

> Use sdd-engineering:implementer to execute batch B1 of docs/plans/csv-export/plan.md.

Wait for the report, check that its Verification table is green, then run B2 with a **new** implementer
call, and so on. Never run two batches at once.

**6. Verify the steps.**

> Use sdd-engineering:plan-verifier in Steps mode against docs/plans/csv-export/plan.md.

Any `Not met` goes back to the implementer ("Use sdd-engineering:implementer to close items 3 and 5
from this verification report: …").

**7. Review.**

> Run /code-review on the current diff.
> Use architecture-review:architecture-reviewer on the files changed for csv-export.

(the second one only when the plan's Handoff says boundaries moved). Then hand the findings to a fresh
implementer run.

**8. Verify acceptance.**

> Use sdd-engineering:plan-verifier in Acceptance mode against docs/specs/csv-export.md with the plan docs/plans/csv-export/plan.md, then save the report to docs/plans/csv-export/verification.md.

Link `verification.md` from the PR description.

**9. Retro.**

> /sdd-engineering:workflow-retro latest --label sdd-pipeline

## Hooks

| Event | Matcher | Command | Why |
|---|---|---|---|
| `PreToolUse` | `Write\|Edit\|MultiEdit\|NotebookEdit` | `node "${CLAUDE_PLUGIN_ROOT}/hooks/spec-creator-write-guard.mjs"` | Structurally fences spec-creator's writes, so its write allowlist does not depend on the model's goodwill |

Claude Code ignores `hooks` in a plugin agent's frontmatter, so the guard is a plugin-level hook and
therefore runs on **every** write in the session. Its first step reads `agent_type` from the hook input
and exits immediately — allowing the write, with no output — unless the active agent is spec-creator
(`agent_type` is `spec-creator` or ends in `:spec-creator`). Your main session, the implementer and
every other agent are never affected.

For spec-creator it **allows** only:

- a file matching `<any>/<specs_dir>/<kebab-case-name>.md` inside the project, in a directory that
  already exists — except the project-root `<specs_dir>/`, which the first spec may create
  (`specs_dir` comes from your configuration via `CLAUDE_PLUGIN_OPTION_SPECS_DIR`, default `docs/specs`);
- whose content after the write has a `Spec ID: SPEC-NN` line and exactly `Status: draft`.

It **denies**: any other path (source, `README.md`, `node_modules/`, `.git/`, outside the project),
notebook edits, a whole-file `Write` over an existing spec that is not a draft (approved, implemented
or legacy specs may only be changed with `Edit`), an `Edit` of a file that does not exist, and any write
that would leave the file with another status or without a Spec ID. For spec-creator it fails closed:
anything it cannot verify is denied. The script is local Node, reads only the target file, and makes
no network calls.

## Permissions and network

| Component | Writes files | Runs Bash | Network |
|---|---|---|---|
| spec-creator | Only draft specs in `<specs_dir>` (hook-enforced) | No | No |
| implementation-planner | No | Read-only commands (by prompt) | No |
| implementer | Source and tests in the project working tree | Yes — the project's typecheck / lint / arch / test scripts and generators | No (`WebSearch`/`WebFetch` disallowed). Note: commands it runs, such as your test suite, can do whatever your scripts do |
| plan-verifier | No | Read-only commands plus your typecheck / lint / arch / test scripts | No |
| workflow-retro skill | Only `<retro_ledger>` (and `/tmp/retro.json`) | `node` on its own bundled scripts | No — reads `~/.claude/projects/` logs locally |
| write-guard hook | No | Runs as `node` on every write | No |

No component writes outside the project except the retro's temporary `/tmp/retro.json`. The only
network access in the whole set is `research-tools:researcher` (`WebSearch`, `WebFetch`) from the
`research-tools` dependency, used when the planner or you route a question to it.

## Requirements

- A Claude Code version that supports plugin `dependencies` and `userConfig`.
- Node.js ≥ 18 on `PATH` (the write-guard hook and the workflow-retro scripts).
- A git repository (the planner, implementer and verifier use `git diff` / `git status`; the retro
  resolves the project root with git).
- Ideally an `AGENTS.md` or `CLAUDE.md` describing your modules and commands.

## Known limitations

- **No orchestrator yet.** There is no `run-plan` command: you run `implementer` per batch by hand,
  one after another, and save the plan and verification reports yourself.
- **No Next.js skill.** `engineering-paved-path` does not ship one; install Next.js guidance separately
  if you need it (for example `npx skills add vercel/next.js`).
- **No test-writing or documentation agent.** Steps owned by `tests` and the final "anchor the criteria
  and set `Status: implemented`" step are yours (or your own agents').
- **Module-level specs directories must exist** before spec-creator writes into them; only the project-root specs directory is created on the first spec.
- **Paths outside `specs_dir`.** The hook allows `<any>/<specs_dir>/…`, so with `specs_dir: specs` a
  file in `docs/specs/` is also accepted (any prefix is allowed, for per-module spec folders).
- The skill routing assumes a TypeScript stack (React, Fastify, Drizzle, PostgreSQL, Zod); on other
  stacks the agents still work but load fewer skills.

## Evals

Cases live in [`evals/`](evals/) in the native `claude plugin eval` format. Several cases seed a small
workspace with a `scaffold_script`, and some need write tools, so run them with:

```sh
claude plugin eval plugins/sdd-engineering --scaffold --allow-tools Write Edit "Bash(git *)"
```

The workflow-retro scripts have unit tests: `node --test plugins/sdd-engineering/skills/workflow-retro/scripts/retro.test.mjs`.

## Versioning

Semantic versioning; the version lives only in `.claude-plugin/plugin.json`. See
[CHANGELOG.md](CHANGELOG.md) for release notes.
