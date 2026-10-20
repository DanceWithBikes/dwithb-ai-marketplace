#!/usr/bin/env bash
# A one-step plan whose only step creates src/farewell.ts.
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "eval@example.invalid"
mkdir -p docs/plans/farewell src
cat > AGENTS.md <<'MD'
# greeter

Tiny TypeScript library. Code in `src/`. No build or test scripts yet.
MD
cat > src/greet.ts <<'TS'
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
TS
cat > docs/plans/farewell/plan.md <<'MD'
# Implementation Plan: farewell

## Requirements
- Source: request — no spec. R-1 `farewell(name)` returns "Bye, <name>!".

## Steps

### Step 1 — Add farewell
- **Files:** `src/farewell.ts` (NEW)
- **Change:** export `farewell(name: string): string` returning `Bye, ${name}!`, in the style of `src/greet.ts`.
- **Satisfies:** R-1
- **Skills:** none
- **Notes:** none apply
- **Owner:** implementer
- **Depends on:** nothing
- **Done when:** `src/farewell.ts` exports `farewell`.

## Batches
| Batch | Steps | Why together | Gate at the end |
|---|---|---|---|
| B1 | 1 | single step | none |

## Verification
- None — the project has no scripts.
MD
git add -A && git commit -qm "base"
