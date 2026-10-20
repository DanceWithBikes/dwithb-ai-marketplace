---
type: llm
weight: 2
---

The plan has two implementer steps. Step 1 (`src/greet.ts` exporting `greet`) exists in the tree. Step 2 (`src/farewell.ts` exporting `farewell`) does not exist.

PASS if all of the following hold:
- The verdict names Steps mode and is INCOMPLETE (not COMPLETE).
- There is one checklist row per step (2 items), and the counts are given as "X of 2" or equivalent.
- Step 1 is `Met` with evidence pointing at `src/greet.ts` (a path, ideally with a line number).
- Step 2 is `Not met`, with proof of absence (a search or file listing that found nothing).
- Every verdict uses only Met / Partially met / Not met / Cannot verify.

FAIL if Step 2 is marked Met or Partially met, if either step is missing, if the overall verdict is COMPLETE, or if the report adds a general code-quality or suggestions section.
