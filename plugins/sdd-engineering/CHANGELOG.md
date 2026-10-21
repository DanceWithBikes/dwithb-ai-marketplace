# Changelog — sdd-engineering

All notable changes to this plugin are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning: [SemVer](https://semver.org/). Release tags: `sdd-engineering--v<version>`.

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
