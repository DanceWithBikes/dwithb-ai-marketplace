---
max_turns: 30
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep, TodoWrite]
plugins: ["../..", "../../../engineering-paved-path"]
---

Billing now needs order totals, so on the `feature` branch I changed `src/modules/billing/service.ts` and `src/modules/billing/compose.ts`. Ask the architecture-reviewer agent to review the branch against `main` and give me its full report verbatim.
