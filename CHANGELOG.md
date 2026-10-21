# Changelog

Per-plugin release notes live in each plugin's `CHANGELOG.md`; this file lists marketplace-level changes.

## 2026-10-21 (sdd-engineering 1.1.0)

- `sdd-engineering` 1.1.0: version-trace hook, cost per successful run in workflow-retro, cheaper agent models, eval cases that load their dependencies (see the plugin's CHANGELOG).
- `stable` branch: the `dwithb-stable` marketplace, pinned to verified versions (`sdd-engineering` 1.0.0). Add it with `claude plugin marketplace add DanceWithBikes/dwithb-ai-marketplace#stable`.
- `scripts/eval-cost.mjs`: cost per successful eval run, recorded in `docs/retros/eval-cost.md`; install and eval evidence in `docs/evidence/`.
- Catalog: plugin contents count `commands/`; new **Quality** view (`?view=quality`) built by `scripts/build-quality.mjs` from `docs/evidence`: channels (latest vs stable, pinned tag, install proof), cost per successful run per case before/after, eval matrix with failed graders, agent models per release.

## 2026-10-21 (patch releases)

- `engineering-paved-path` 1.0.1, `research-tools` 1.0.1, `sdd-engineering` 1.0.1: patch releases (see each plugin's CHANGELOG).

## 2026-10-20

- Initial marketplace skeleton.
- Added `engineering-paved-path` 1.0.0, `research-tools` 1.0.0, `architecture-review` 1.0.0 and `sdd-engineering` 1.0.0 (see `plugins/<name>/CHANGELOG.md`).
