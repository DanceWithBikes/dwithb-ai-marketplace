---
name: workflow-retro
description: "Retrospective of a multi-agent Claude Code run: tokens, cache hits, tool calls, duration and parallelism per agent (nested subagents included) from local session logs, 1–5 actions, and a ledger trend row. Use after an SDD pipeline or subagent fan-out, or to ask what a run cost."
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/*), Bash(node "${CLAUDE_SKILL_DIR}/scripts/*)
metadata:
  version: "1.1.1"
  updated: "2026-10-21"
---

# Workflow retro

Measure a finished run, name what to change, and record it in the ledger. Not a code review, and not a review of the agents' output quality.

**Why `--deep` exists:** in the parent transcript, an `Agent` tool result reports `totalTokens`. That number is the child's **last-turn context**, not what the child spent. Background children report it only in a later `<task-notification>`, and grandchildren (depth ≥ 2) never show up in the parent at all. On a real 10-reviewer fan-out, the parent saw 0.6M of the 2.9M tokens its children spent. Deep mode reads every `subagents/agent-*.jsonl` log.

## Steps

The scripts live in `${CLAUDE_SKILL_DIR}/scripts/` (plain Node ≥ 18, no dependencies, no network). Run them from the project root. The ledger is `${user_config.retro_ledger}` unless the user names another file. If that still shows a literal `user_config` placeholder, the plugin's settings were not filled in: use the default `docs/retros/ledger.md`.

1. **Pick the session.** The default `latest` is the newest transcript of this project, other than the session running the retro. If the user named a run ("the review an hour ago"), list the candidates with `ls -t ~/.claude/projects/<slug>/*.jsonl | head` and pick one by id. For a session started in a git worktree, pass `--cwd <worktree path>`.

2. **Measure.** Deep is the default for a retro; quick (no `--deep`) is only for a fast look at the parent:
   ```sh
   node "${CLAUDE_SKILL_DIR}/scripts/retro.mjs" <sessionId|latest> --deep --label "<kind of run>" > /tmp/retro.json
   node "${CLAUDE_SKILL_DIR}/scripts/retro.mjs" <same> --deep --md          # readable table + signals
   ```
   Choose a `--label` that is stable across runs of the same kind (`sdd-pipeline`, `code-review`, `skill-eval`) so the ledger rows can be compared.

3. **Turn signals into actions.** Read `${CLAUDE_SKILL_DIR}/references/heuristics.md` and `/tmp/retro.json` (`signals`, `agents`, `parallelism`, `totals`). Write 1–5 actions, highest saving first. Each action has:
   - **what** to change and **where**: the agent definition, skill, or script that spawned the agents;
   - **evidence**: agent id/description, file path, numbers from the JSON;
   - **expected saving**, estimated from those numbers.

   Don't invent actions to fill the list. A legitimately bigger agent is not an outlier, and "no action" is a valid result.

4. **Append to the ledger.** Pass the single top action as one short line:
   ```sh
   node "${CLAUDE_SKILL_DIR}/scripts/append-ledger.mjs" /tmp/retro.json --ledger "${user_config.retro_ledger}" --action "<top action, ≤ 80 chars>"
   ```
   A relative `--ledger` path resolves against the git root of the current directory. The script creates the ledger with a header if it's missing, and refuses to add the same session + mode + label twice (`--force` overrides). It never rewrites existing rows. Before writing the conclusion, read the previous rows with the same label and say whether the trend improved.

5. **Report in chat, briefly:** totals line, top agents by `subtreeTokens` (≤ 5 rows), the actions, the trend versus the previous row with the same label, and the ledger row that was appended.

## Gotchas

- Only compare **deep with deep**. A quick row is missing the child spend.
- `totals.costUsd` is priced per message at the list prices in `scripts/lib.mjs` (`PRICES`, by model family). Turns of a model it doesn't know are counted in `unpricedTurns` and left out of the cost — say so when it's non-zero.
- `pluginVersion` comes from the plugin's SessionStart hook (`sdd-engineering vX.Y.Z active`); it is null for runs on 1.0.x, which had no hook. `outcome.success` is true only when the last plan-verifier report said `COMPLETE`; for a run without plan-verifier pass `--success yes|no` to `append-ledger.mjs`.
- Report the **cost per successful run** that `append-ledger.mjs` prints (`trend`) next to the previous version's figure for the same label — that is the number an optimisation has to move.
- A session that is still running gives partial numbers. Say so if its last record is recent.
- `filesRead` covers `Read` plus plain `cat|head|tail|sed -n` in Bash. Reads hidden inside scripts or pipelines are missed.
- The scripts read `~/.claude/projects/` (override with `CLAUDE_PROJECTS_DIR`) and write only the ledger file.
- Tests: `node --test "${CLAUDE_SKILL_DIR}/scripts/retro.test.mjs"`.
