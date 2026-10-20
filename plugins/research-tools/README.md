# research-tools

A read-only research subagent for Claude Code. It answers two kinds of questions
and backs every claim with a quote, a `path:line` anchor or a URL:

- **Repository research** — how something works in *your* repository: where a
  behaviour lives, which module owns it, what a convention is, when and why
  something changed.
- **External research** — what the world says: library and API docs, release
  notes, changelogs, RFCs, issues, security advisories, comparisons of approaches,
  scoped to the versions your project actually pins.

Use it when answering would mean sweeping many files, git history or several web
sources and you only want the conclusion, with evidence you can verify. It
investigates and reports; it never changes anything.

## What's included

| Component | Name | Model | Tools | Writes files |
|---|---|---|---|---|
| Agent | `research-tools:researcher` | `sonnet` | Read, Grep, Glob, Bash, WebSearch, WebFetch, TodoWrite | No (read-only) |

No skills, hooks, MCP servers or commands.

The agent has no `Write`, `Edit` or `Skill` tool. Withholding `Skill` is
deliberate: it keeps the researcher doing its own searching instead of delegating
to another research workflow.

## Install

```sh
claude plugin marketplace add DanceWithBikes/dwithb-ai-marketplace
claude plugin install research-tools@dwithb-ai-marketplace
```

## How to invoke

- Ask Claude in plain language: *"Use the researcher agent to find out where
  rate limiting is applied to the public API."*
- `@`-mention the agent in your prompt (`@research-tools:researcher …`).
- Let another agent delegate to it. The `sdd-engineering` plugin's
  implementation planner and plan verifier hand questions they can't settle from
  the repository to `research-tools:researcher`.

## Inputs it expects

A **concrete question**: a named symbol, file, error message, version, URL, or a
yes/no that a search can settle. If the request is a topic rather than a question
("research caching"), the scope is unbounded, the decision criteria are missing, or
it is unclear whether the answer should come from the repo or from the web, the
agent first replies with up to three clarifying questions, each with a default
it will use if you say "go ahead". It may also stop mid-research with a partial
answer and one batched question when it finds the brief and the code disagree.

For repository questions it starts from the project's own map: the root and
nearest `AGENTS.md` / `CLAUDE.md`, `README.md`, the package manifests, and any
specs or notes under `docs/`. For external questions it first reads the real
version constraint from your manifest and lockfile, then researches that version.

## The report it returns

Always in English, with literal headings.

**Repository research** — `# Repo research: <question>`

1. `## Answer`: 2–5 sentences, direct answer first
2. `## Findings`: one `###` per claim, each with **Evidence** (`path:line` and the smallest quote) and **Reading**
3. `## Where it lives (map)`: table of Concern, Path, Role
4. `## History`: commits, only when "why" or "when" was asked
5. `## Not found / not verified`: what could not be settled, what was tried, and every assumption made
6. `## Confidence`: High, Medium or Low, and what would raise it

**External research** — `# External research: <question>`

1. `## Answer`: scoped to your pinned version
2. `## Version context`: your version, the latest release, and the range the answer is valid for
3. `## Findings`: each with **Source** (with date), **Says** (quote), **Reading**, **Corroborated by**
4. `## Options compared`: only when the question is a choice
5. `## Conflicting or outdated sources`
6. `## Not found / not verified`
7. `## Confidence`
8. `## Sources`: numbered list with type and access date

**Mixed questions** ("does our code do what the docs recommend?") produce both
reports plus a `## Gap analysis` table: Recommendation (external), Our code (repo),
Verdict, Evidence.

## Example prompts

- "Use the researcher agent: where is the session cookie set, and which middleware reads it?"
- "Ask the researcher why we pinned `undici` to 6.x. Check git history and the upstream changelog."
- "Researcher: does our Zod usage follow the v3 recommendations for discriminated unions? Give me a gap analysis."
- "Use the researcher to compare BullMQ and pg-boss for our job queue, judged on Postgres-only deployment and maintenance activity."

## Dependencies

None.

## Requirements

- Claude Code with plugin support.
- `git` on `PATH` for history questions (`git log`, `git show`, `git blame`).
- Web access for external research (WebSearch / WebFetch must be allowed in your
  environment).

## Permissions and network

- **Read-only.** The agent cannot write or edit files. `Bash` is used only for
  read commands (`cat`, `sed -n`, `grep`, `rg`, `find`, `ls`, `git log/show/blame/diff`,
  package-manager listing such as `npm ls`). Its prompt forbids installs, migrations,
  `docker compose`, mutating git commands, PR creation and shell redirects.
- **Network:** uses `WebSearch` and `WebFetch` to read public web pages for
  external research. It sends search queries and fetches URLs; it does not
  post data anywhere.
- **No secrets:** it will not read, quote or fetch `.env` files, credential files
  or key material.
- No hooks, no MCP servers.

## Known limitations

- It answers questions; it does not review code (use `/code-review` or
  `/security-review`) and does not plan implementations.
- A subagent cannot write its report to a file. If you want to keep the report,
  save it yourself.
- Read-only by design: anything that needs a migration, an authenticated
  endpoint or a secret value is reported as a wall in "Not found", not worked around.
- External findings are only as current as what is published. The agent records
  source dates, but it can't confirm undocumented behaviour.

## Used by

- [`sdd-engineering`](../sdd-engineering/) depends on this plugin (`^1.0.0`). Its
  planner and verifier send open questions to `research-tools:researcher`.
