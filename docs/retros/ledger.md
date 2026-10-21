# Workflow retro ledger

One row per retro run, appended by the `workflow-retro` skill's `append-ledger.mjs` script.
Compare rows of the same kind of run (same label) to see whether the last action paid off.

- **mode** - `quick` counts the parent only (child spend missing); `deep` reads every subagent log. Only compare deep with deep.
- **tokens** - input + output + cache read + cache write, all agents. **cache** - cache read / all prompt tokens.
- **agents / depth** - subagents spawned / deepest nesting. **peak** - most agents alive at once.
- **par.** - agent-time / time any agent was alive (1.0 = sequential).
- **version** - active sdd-engineering version from the version-trace hook. **cost** - USD at list prices, all agents.
- **ok** - `yes` when plan-verifier said COMPLETE (or `--success yes`). Cost per successful run = Σ cost / rows with ok = yes.

| date | session | label | version | mode | agents / depth | tokens | cache | tool calls | wall | peak | par. | cost | ok | top action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-21 | a8d507a4 | sdd-pipeline | 1.0.1 | deep | 5 / 1 | 934.2k | 80.6% | 46 | 5m07s | 1 | 1× | $1.09 | yes | pipeline benchmark, main model haiku, budget $6 |
| 2026-10-21 | d9272304 | sdd-pipeline | 1.1.0 | deep | 5 / 1 | 1.07M | 86% | 53 | 4m27s | 1 | 1× | $0.714 | yes | pipeline benchmark, main model haiku, budget $6 |
