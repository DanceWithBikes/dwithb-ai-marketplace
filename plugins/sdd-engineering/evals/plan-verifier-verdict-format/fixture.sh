#!/usr/bin/env bash
# A tiny plan with two implementer steps; only Step 1 is in the tree.
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "eval@example.invalid"
mkdir -p docs/plans/greeting src
cat > AGENTS.md <<'MD'
# greeter

Tiny TypeScript library. Code in `src/`. No build or test scripts yet.
MD
cat > docs/plans/greeting/plan.md <<'MD'
# Implementation Plan: greeting

## Goal
Expose a greeting helper and a farewell helper.

## Requirements
- Source: request — no spec. R-1 `greet(name)` returns "Hello, <name>!". R-2 `farewell(name)` returns "Bye, <name>!".

## Steps

### Step 1 — Add greet
- **Files:** `src/greet.ts` (NEW)
- **Change:** export `greet(name: string): string` returning `Hello, ${name}!`.
- **Satisfies:** R-1
- **Skills:** none
- **Notes:** none apply
- **Owner:** implementer
- **Depends on:** nothing
- **Done when:** `src/greet.ts` exports `greet` returning `Hello, ${name}!`.

### Step 2 — Add farewell
- **Files:** `src/farewell.ts` (NEW)
- **Change:** export `farewell(name: string): string` returning `Bye, ${name}!`.
- **Satisfies:** R-2
- **Skills:** none
- **Notes:** none apply
- **Owner:** implementer
- **Depends on:** nothing
- **Done when:** `src/farewell.ts` exports `farewell` returning `Bye, ${name}!`.

## Batches
| Batch | Steps | Why together | Gate at the end |
|---|---|---|---|
| B1 | 1, 2 | tiny | none |
MD
git add -A && git commit -qm "plan"
cat > src/greet.ts <<'TS'
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
TS
