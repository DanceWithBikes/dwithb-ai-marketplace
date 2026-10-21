# Changelog — sdd-engineering

All notable changes to this plugin are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning: [SemVer](https://semver.org/). Release tags: `sdd-engineering--v<version>`.

## [1.1.1] - 2026-10-21

### Fixed
- workflow-retro undercounted output tokens of subagents: a streamed message is logged as several records and the first one carries a partial usage snapshot; the last record's usage now wins. On a full pipeline run the reported cost moved from $0.69 to $1.09, within 2% of what Claude Code billed.
- Cache writes are priced by TTL (1-hour writes at 2x input, 5-minute at 1.25x) from `usage.cache_creation`.

These two fixes first reached `main` under version 1.1.0, so installs of 1.1.0 did not auto-update to them. 1.1.1 ships them under a new version.

## [1.1.0] - 2026-10-21

### Added
- `SessionStart` hook `version-trace`: records the active plugin version in `trace.jsonl` (plugin data dir) and in the session context.
- workflow-retro: USD cost per run (`totals.costUsd`, list prices by model family), `pluginVersion`, `outcome` from the plan-verifier verdict; the ledger gains `version`, `cost` and `ok` columns, and `append-ledger.mjs` prints the cost per successful run (`--success yes|no` for runs without plan-verifier).
- Eval case `version-trace-emitted`; `smoke` and `sdd` tags on the eval cases.

### Changed
- Cost: `spec-creator` and `plan-verifier` run on sonnet instead of opus; `implementation-planner` stays on opus at `effort: medium`. Cost per successful eval run before and after is in `docs/retros/eval-cost.md`.
- The ledger header has new columns; start a new ledger file rather than appending to a 1.0.x one.

### Fixed
- Eval cases list all four plugins, so the plugin is no longer disabled during `claude plugin eval` with `dependency-unsatisfied` (before, no case could reach an sdd-engineering agent). Run evals from the repository root.

## [1.0.1] - 2026-10-21

### Changed
- README: new **Updating** section with the commands to pick up a release and how dependencies follow.

## [1.0.0] - 2026-10-20

### Added
- Agents: `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`.
- Skill: `workflow-retro` (token, cache, tool-call and parallelism retro of a multi-agent run, with a ledger).
- `PreToolUse` hook that limits `spec-creator` writes to the specs directory.
- Configuration dialog (`userConfig`): `specs_dir`, `plans_dir`, `retro_ledger`.
- Dependencies: `engineering-paved-path`, `research-tools`, `architecture-review` (all `^1.0.0`).
- Eval cases for `claude plugin eval`.

### Not included yet
- `run-plan` orchestrator: run `implementer` per plan batch manually.
