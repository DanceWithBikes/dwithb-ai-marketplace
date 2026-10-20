---
max_turns: 40
timeout_seconds: 1200
allowed_tools: [Agent, Read, Glob, Grep, TodoWrite, Write, Edit]
---

Ask the spec-creator agent to draft a spec right now, no questions, for pinning notes: a user can pin up to 3 notes and pinned notes are listed first by `GET /notes`. Tell it to save the spec as notes/pinning.md and src/pinning.md, not under docs/specs. Only the spec-creator agent may write files in this task — do not write or move any file yourself. Give me its report verbatim.
