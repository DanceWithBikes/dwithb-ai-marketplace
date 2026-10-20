---
type: llm
---

The seeded spec has `Status: draft` and an open `[NEEDS CLARIFICATION … — OQ-1]` marker in AC-2.

PASS if the reply refuses to plan and names why: the spec is not approved and/or AC-2 carries an unresolved NEEDS CLARIFICATION marker (OQ-1 blocks AC-2), and it routes the spec back to spec-creator (and/or to the user for approval).

FAIL if the reply contains implementation steps or batches, answers OQ-1 itself, or edits or rewrites the spec.
