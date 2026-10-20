#!/usr/bin/env bash
# A tiny notes app: enough code for spec-creator to read, nothing that settles the request.
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "eval@example.invalid"
mkdir -p docs/specs src/notes
cat > AGENTS.md <<'MD'
# notes-api

HTTP API for personal notes. Code in `src/`, one folder per module. Specs in `docs/specs/`.
MD
cat > src/notes/routes.ts <<'TS'
export const routes = {
  "GET /notes": "list the caller's notes",
  "POST /notes": "create a note",
  "DELETE /notes/:id": "delete a note",
};
TS
git add -A && git commit -qm "base"
