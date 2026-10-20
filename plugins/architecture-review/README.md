# architecture-review

A read-only subagent that checks whether a change respects your project's
architectural boundaries:

- **Backend onion rings**: routes talk only to services, only repositories touch
  the database, services take ports rather than the DI container, modules don't
  import each other, adapters and platform code don't know about modules.
- **Frontend layering**: shared code never imports routes, routes never import
  each other, folders are entered through their `index.ts`, the design system only
  through its entry point, no import cycles.

Every finding comes back with evidence: the offending `path:line`, the rule it
breaks and where that rule is written, the actual import chain, a severity, and
the concrete move that fixes it. The agent reports and never repairs, and it
records no PASS/BLOCKED verdict. Keeping review and fix in separate contexts is
the point.

It looks only at boundaries. Security, performance and correctness belong to
`/security-review` and `/code-review`.

## What's included

| Component | Name | Model | Tools | Writes files |
|---|---|---|---|---|
| Agent | `architecture-review:architecture-reviewer` | `opus` | Read, Grep, Glob, Bash, TodoWrite | No (read-only) |

Preloaded skills (from the `engineering-paved-path` dependency):
`engineering-paved-path:backend-onion-architecture` and
`engineering-paved-path:frontend-ui-architecture`. These two skills are its rulebook.

The agent has **no `Skill` tool**. Preloading a skill doesn't restrict what an
agent can load later, so withholding the tool is the only way to keep the review
on boundaries instead of drifting into security or style advice.

No hooks, MCP servers or commands. Evals live in [`evals/`](evals/).

## Install

```sh
claude plugin marketplace add DanceWithBikes/dwithb-ai-marketplace
claude plugin install architecture-review@dwithb-ai-marketplace
```

`engineering-paved-path` is installed and enabled automatically as a dependency.

## How to invoke

- Ask Claude in plain language: *"Use the architecture-reviewer agent to review
  my branch against main."*
- `@`-mention the agent (`@architecture-review:architecture-reviewer …`).
- Let another agent delegate to it. In the `sdd-engineering` pipeline it runs
  after the implementation batches when a change adds a module, endpoint or page,
  or moves code between rings.

Run it proactively before opening a PR that adds a module, endpoint, service,
repository, adapter, port, route, page or shared component. Also run it when the
project's architecture check fails and the fix isn't obvious, or after code has
moved between folders or packages.

## Inputs it expects

- **A scope**: a diff, a branch, a package or a list of paths. If you name none,
  it reviews the current branch against `main` plus the working tree. If you ask
  only to "review the architecture" with no boundary, it replies with a single
  scope question and a default.
- **Your project's map**, which it discovers itself: root and module
  `AGENTS.md` / `CLAUDE.md`, `README.md`, and package manifests. These tell it
  which folder is which ring or layer.
- **Your architecture check, if you have one**: a `package.json` script or
  documented command running dependency-cruiser, `eslint-plugin-boundaries`,
  Nx module-boundary lint or similar, plus any baseline / known-violations file.
  It runs the check as defined and never updates the baseline. If the project
  has no check, it says so in the report and traces imports by hand against the
  rings defined in the skills.

## The report it returns

Always in English, with these literal headings:

1. `# Architecture review: <scope>`
2. `## Summary`: severity counts, the most important finding, and an explicit note that this is not a PASS/BLOCKED verdict
3. `## Scope reviewed`: Package, Files, Ring / layer, How selected
4. `## Gates`: Command, cwd, Result, Ignored-count, What it proves (or a row saying no check exists)
5. `## Findings`: one `### F<N> — <title>` per finding, each with **Rule**, **Source**, **Evidence** (`path:line` and a quote), **Chain** (`A → B → C`), **Fix**, **Severity**, **Confidence**
6. `## Checked and clean`: what was checked and found clean, so a gap isn't mistaken for a pass
7. `## Known deviations (not findings)`: baselined or documented deviations
8. `## Not verified`
9. `## Confidence`
10. `## Insights to record`

If the caller supplies its own reviewer brief or severity scale, for example a
PR gate that launches several sub-reviewers, the agent uses that output format
and keeps the same method.

## Example prompts

- "Use the architecture-reviewer agent on my current branch versus main."
- "Architecture-review the files under `src/modules/billing/`. I added a new repository and a route."
- "Our boundaries check fails on `src/modules/orders/service.ts` and I don't see why. Ask the architecture reviewer."
- "I moved the date helpers from `src/routes/reports/` into `src/shared/`. Have the architecture reviewer check that the layering still holds."

## Dependencies

| Plugin | Version | Why |
|---|---|---|
| `engineering-paved-path` | `^1.0.0` | The agent preloads `backend-onion-architecture` and `frontend-ui-architecture` from it as its rulebook. It also refers to `engineering-paved-path:security`, `:zod` and `:drizzle-orm-patterns` when explaining what's out of scope. |

The dependency installs and enables automatically when you install
`architecture-review`.

## Requirements

- Claude Code with plugin support.
- `git` on `PATH` to resolve the default scope (`git diff main...HEAD`).
- Optional: an architecture checker in the project (dependency-cruiser,
  `eslint-plugin-boundaries` or similar) with its dependencies installed. Without
  one, the review still runs, but import tracing is manual and the report says so.

## Permissions and network

- **Read-only.** The agent cannot write or edit files. `Bash` is used for read
  commands (`cat`, `sed -n`, `grep`, `rg`, `find`, `ls`, `git log/show/blame/diff`)
  and for one exception: running the project's own read-only architecture check.
  Its prompt forbids installs, migrations, mutating git commands, PR creation,
  shell redirects, updating a violations baseline, and editing the checker's config.
- **Network:** none. It has no WebSearch or WebFetch.
- **No secrets:** it will not read, quote or log `.env` files, credential files or
  key material.
- No hooks, no MCP servers.

## Known limitations

- It reviews boundaries only, so it won't find bugs or security issues. Pair it
  with `/code-review` and `/security-review`.
- It records no verdict. Whatever gates your PR has to decide.
- The rulebook assumes an onion-style backend and an index-entry frontend, as
  described in the two `engineering-paved-path` skills. Projects with a
  different architecture get findings against those rules unless their own
  `AGENTS.md` / `CLAUDE.md` documents otherwise.
- A subagent cannot write its report to a file. If you want to keep the report,
  save it yourself.
- Running the architecture check needs installed dependencies. The agent never
  installs them; it reports the gate as not run.

## Evals

The cases in [`evals/`](evals/) use the native `claude plugin eval` format. Each
case seeds a small TypeScript repository with `fixture.sh` (a `main` branch plus a
`feature` branch holding the change under review), then asks Claude to delegate to
the agent:

| Case | What it checks |
|---|---|
| `flags-onion-ring-violations` | A domain file importing a Fastify type and a service constructing its concrete repository are both flagged with `path:line` |
| `flags-cross-module-import` | A service importing another module's repository is flagged, with a port-based fix |
| `clean-refactor-no-findings` | A behaviour-preserving rename produces no findings, and the report still shows what was checked |

The fixtures are built by a scaffold script, so pass `--scaffold`. Granting
read-only git lets the agent compute the diff:

```sh
claude plugin eval plugins/architecture-review --scaffold --allow-tools "Bash(git *)"
```

Each case lists `../../../engineering-paved-path` in `plugins:` so the preloaded
skills resolve during the run.

## Used by

- [`sdd-engineering`](../sdd-engineering/) depends on this plugin (`^1.0.0`). Its
  pipeline calls `architecture-review:architecture-reviewer` after implementation
  when boundaries moved.
