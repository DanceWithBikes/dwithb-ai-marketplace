Run the Spec-Driven Development pipeline for one feature in this repository, end to end, without asking me anything. Use the sdd-engineering agents, one step at a time, and wait for each to finish.

Feature: notes can be archived.

Decisions (treat them as my answers; nothing else is open):
- `POST /notes/:id/archive` sets `archivedAt` (ISO timestamp) on the note and returns 200 with the note; 404 for an unknown id; archiving an archived note is a no-op that returns 200 with the unchanged note.
- `GET /notes` hides archived notes; `GET /notes?archived=true` returns only archived notes.
- `GET /notes/:id` still returns an archived note.
- No unarchive, no new dependencies; tests in `test/` with node:test.

Steps:
1. Ask `sdd-engineering:spec-creator` to write the spec now from the decisions above (they are final, so it can draft directly) into `docs/specs/note-archive.md`.
2. Approve the spec yourself: change its `Status: draft` line to `Status: approved`.
3. Ask `sdd-engineering:implementation-planner` to plan `docs/specs/note-archive.md`. Save its full report verbatim to `docs/plans/note-archive/plan.md`.
4. For each batch in the plan, in order, ask `sdd-engineering:implementer` to execute that batch of `docs/plans/note-archive/plan.md`.
5. Ask `sdd-engineering:plan-verifier` to verify `docs/specs/note-archive.md` in Acceptance mode against the current tree. Save its full report verbatim to `docs/plans/note-archive/verification.md`.
6. Reply with the verifier's `## Verdict` section only.
