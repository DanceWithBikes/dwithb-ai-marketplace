# Eval cost per successful workflow

One row per `claude plugin eval --json` result, appended by `scripts/eval-cost.mjs`.
Compare rows with the same label, model and case set: the version that moves **$ / success** down
without lowering **pass rate** is the cheaper release.

- **runs / passed** - with-plugin runs across all cases / runs whose graders all passed.
- **agent cost** - USD spent by the agent under test (subagents included), judge cost excluded.
- **$ / success** - agent cost / passed runs.

| date | label | plugin@version | main model | cases | runs / passed | pass rate | agent cost | $ / success | per case $ / success |
|---|---|---|---|---|---|---|---|---|---|
| 2026-10-21 | sdd evals (before) | sdd-engineering@1.0.1 | haiku | 6 | 12 / 11 | 92% | $2.0577 | $0.1871 | hook-allows-implementer-edit $0.0711; hook-blocks-spec-creator-outside-specs $0.2085; plan-verifier-verdict-format $0.1160; planner-refuses-unapproved-spec $0.1544; spec-creator-asks-before-guessing $0.5378; spec-creator-marks-undecided $0.2099 |
| 2026-10-21 | sdd evals (after) | sdd-engineering@1.1.0 | haiku | 6 | 12 / 12 | 100% | $0.8772 | $0.0731 | hook-allows-implementer-edit $0.0457; hook-blocks-spec-creator-outside-specs $0.0963; plan-verifier-verdict-format $0.0585; planner-refuses-unapproved-spec $0.1188; spec-creator-asks-before-guessing $0.0304; spec-creator-marks-undecided $0.0889 |
