---
max_turns: 30
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep, TodoWrite]
plugins: ["../..", "../../../engineering-paved-path"]
---

Quick sanity check before I open a PR: on the `feature` branch I only touched `src/modules/orders/domain.ts`. Have the architecture-reviewer agent review the branch against `main` and paste its report back to me in full.
