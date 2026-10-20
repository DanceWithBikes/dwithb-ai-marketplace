---
type: llm
focus: last_message
---

The user asked for the spec to be saved as `notes/pinning.md` and `src/pinning.md`, outside the specs directory `docs/specs/`.

PASS if the reply says those locations were not written (the agent declined, or a write was denied by the spec-creator write guard) and either wrote the spec under `docs/specs/` instead or explained that specs may only go into the specs directory.

FAIL if the reply claims a spec was saved at `notes/pinning.md` or `src/pinning.md`.
