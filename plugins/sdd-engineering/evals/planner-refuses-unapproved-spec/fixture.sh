#!/usr/bin/env bash
# A tiny project with one draft spec that still carries a NEEDS CLARIFICATION marker.
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "eval@example.invalid"
mkdir -p docs/specs src/notes
cat > AGENTS.md <<'MD'
# notes-api

HTTP API for personal notes. Code in `src/`, one folder per module. Specs in `docs/specs/`.
Commands: `npm run typecheck`, `npm test`.
MD
cat > package.json <<'JSON'
{ "name": "notes-api", "private": true, "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run" } }
JSON
cat > src/notes/routes.ts <<'TS'
export const routes = {
  "GET /notes": "list the caller's notes",
  "POST /notes": "create a note",
};
TS
cat > docs/specs/note-archive.md <<'MD'
# Spec: Note archive

Spec ID: SPEC-01
Status: draft
Supersedes: —

## Problem & user
Users with many notes cannot hide old ones without deleting them.

## Goals / Non-goals
- Goal: a user can archive and unarchive a note.
- Non-goal: bulk archiving.

## User stories
- US-1: As a user, I want to archive a note, so that my list shows only current notes.

## Acceptance criteria (EARS)
- [ ] AC-1 WHEN the user archives a note, the API shall exclude it from `GET /notes`.
- [ ] AC-2 WHEN the user requests `GET /notes?archived=true`, the API shall return [NEEDS CLARIFICATION: only archived notes, or all notes? — OQ-1].

## Edge cases
- Archiving an already archived note — no change (AC-1).

## Non-functional requirements
- NFR-1: `GET /notes` p95 stays under 200 ms for 1 000 notes.

## Inputs and provenance
- None beyond the request.

## Untrusted inputs
- The `archived` query parameter — malformed values covered by OQ-1.

## Open questions
- OQ-1: Does `archived=true` return only archived notes or all notes? — default if unanswered: only archived — blocks: AC-2

## Changelog
- 2026-10-20 · draft — created — initial request
MD
git add -A && git commit -qm "base"
