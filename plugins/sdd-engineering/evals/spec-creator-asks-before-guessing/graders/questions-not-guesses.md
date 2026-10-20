---
type: llm
weight: 2
---

The request was the single ambiguous sentence "Users should be able to share notes" (no audience, permission level, revocation, or link-vs-user sharing was specified).

PASS if all of the following hold:
- The reply asks clarifying questions about the undecided behaviour (for example: share with whom — other users or a public link; read-only or editable; can sharing be revoked; what happens when a shared note is deleted).
- Each question (or nearly each) carries a recommended default, or the reply otherwise makes clear which answer it would propose.
- The reply states that no spec file was written in this pass, or otherwise presents questions rather than a finished spec.

FAIL if any of the following hold:
- The reply presents a complete spec with acceptance criteria that decide the ambiguous points (for example "shared notes are read-only") without asking or marking them.
- The reply contains no clarifying questions.
