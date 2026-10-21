#!/usr/bin/env bash
# Seeds a tiny dependency-free Node project for the SDD pipeline benchmark: an in-memory notes
# store with node:test tests. Gates: `npm test` (node --test) and `npm run typecheck` (node --check).
set -euo pipefail
git init -q -b main .
git config user.name "Pipeline Fixture"
git config user.email "pipeline@example.invalid"
mkdir -p src/notes test docs/specs docs/plans
cat > AGENTS.md <<'MD'
# notes-api

In-memory notes service. Plain Node.js ≥ 18, ES modules, no dependencies.

- Code: `src/notes/` — `store.js` (data), `service.js` (rules), `routes.js` (HTTP-style handlers).
- Tests: `test/*.test.js` with `node:test` and `node:assert/strict`.
- Specs in `docs/specs/`, plans in `docs/plans/<feature>/`.
- Gates: `npm run typecheck`, `npm test`. Both must pass before a batch is done.
- Do not add dependencies.
MD
cat > package.json <<'JSON'
{
  "name": "notes-api",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "node --check src/notes/store.js && node --check src/notes/service.js && node --check src/notes/routes.js",
    "test": "node --test test/*.test.js"
  }
}
JSON
cat > src/notes/store.js <<'JS'
// In-memory note storage. Notes: { id, title, body, createdAt }.
export function createStore() {
  const notes = new Map();
  let next = 1;
  return {
    insert({ title, body }) {
      const note = { id: String(next++), title, body, createdAt: new Date().toISOString() };
      notes.set(note.id, note);
      return note;
    },
    get: (id) => notes.get(id) ?? null,
    list: () => [...notes.values()],
    update(id, patch) {
      const note = notes.get(id);
      if (!note) return null;
      Object.assign(note, patch);
      return note;
    },
  };
}
JS
cat > src/notes/service.js <<'JS'
// Business rules for notes. Titles are required, 1-120 characters.
export function createService(store) {
  return {
    create({ title, body = "" }) {
      if (typeof title !== "string" || title.length < 1 || title.length > 120) throw new Error("invalid title");
      return store.insert({ title, body });
    },
    list: () => store.list(),
    get: (id) => store.get(id),
  };
}
JS
cat > src/notes/routes.js <<'JS'
// HTTP-style handlers: (req) => { status, body }. req = { params, query, body }.
export function createRoutes(service) {
  return {
    "GET /notes": () => ({ status: 200, body: service.list() }),
    "GET /notes/:id": ({ params }) => {
      const note = service.get(params.id);
      return note ? { status: 200, body: note } : { status: 404, body: { error: "not found" } };
    },
    "POST /notes": ({ body }) => {
      try {
        return { status: 201, body: service.create(body ?? {}) };
      } catch (e) {
        return { status: 400, body: { error: e.message } };
      }
    },
  };
}
JS
cat > test/notes.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/notes/store.js";
import { createService } from "../src/notes/service.js";
import { createRoutes } from "../src/notes/routes.js";

const app = () => createRoutes(createService(createStore()));

test("creates and lists notes", () => {
  const r = app();
  assert.equal(r["POST /notes"]({ body: { title: "a" } }).status, 201);
  assert.equal(r["GET /notes"]({ query: {} }).body.length, 1);
});

test("rejects an empty title", () => {
  assert.equal(app()["POST /notes"]({ body: { title: "" } }).status, 400);
});
JS
git add -A && git commit -q -m "notes-api fixture"
