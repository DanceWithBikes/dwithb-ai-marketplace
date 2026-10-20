---
max_turns: 30
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep, TodoWrite]
plugins: ["../..", "../../../engineering-paved-path"]
---

I'm on the `feature` branch and changed `src/modules/orders/domain.ts` and `src/modules/orders/service.ts` so checkout saves the price. Use the architecture-reviewer agent to check whether this branch respects our module boundaries compared with `main`. Paste the reviewer's report back to me in full, without summarising it.
