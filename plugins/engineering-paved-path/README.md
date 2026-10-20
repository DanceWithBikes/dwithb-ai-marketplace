# engineering-paved-path

Opinionated, reusable engineering standards for TypeScript stacks - React, Next.js App Router structure, Fastify, Drizzle ORM, PostgreSQL, Zod - packaged as Claude Code skills.

A **paved path** is the well-lit default way to build something: not the only way, but the one that is documented, reviewed and known to work. This plugin gives Claude that default. When you ask it to add an endpoint, split a component, write a test or design a table, it follows the same placement rules, layering, validation and security practices every time, instead of improvising per prompt.

The plugin contains only skills. It has no agents, hooks, MCP servers or commands of its own, and it is the shared rulebook for other plugins in this marketplace (see [Used by](#used-by)).

## What's included

| Skill | Invoke as | Scope | Triggers when you… |
|---|---|---|---|
| `backend-onion-architecture` | `engineering-paved-path:backend-onion-architecture` | Backend | add a module, endpoint, service, repository or adapter; decide where backend code lives; make a service testable without a database; review backend structure. Ring map, ports and adapters, composition root, import rules and an example dependency-cruiser gate. |
| `fastify-best-practices` | `engineering-paved-path:fastify-best-practices` | Backend | build, configure or debug a Fastify app: routes, plugins, hooks, JSON Schema validation, errors, auth, CORS, logging, WebSockets, deployment. |
| `drizzle-orm-patterns` | `engineering-paved-path:drizzle-orm-patterns` | Backend | define Drizzle schemas, write type-safe queries, relations, transactions, or Drizzle Kit migrations. |
| `postgresql-table-design` | `engineering-paved-path:postgresql-table-design` | Backend | design or review a PostgreSQL schema: data types, indexes, constraints, partitioning, performance patterns. |
| `react-best-practices` | `engineering-paved-path:react-best-practices` | Frontend | write, review or refactor React components, hooks and state; hunt for anti-patterns (effects, memoization, keys, data fetching). |
| `frontend-ui-architecture` | `engineering-paved-path:frontend-ui-architecture` | Frontend | create, move or split frontend files; decide where components, hooks, constants, helpers and API calls live; set import boundaries and `index.ts` entry points; place the server-client boundary in Next.js App Router. |
| `react-testing-library` | `engineering-paved-path:react-testing-library` | Frontend | write, review or set up React component and hook tests with Vitest, RTL queries, `userEvent` and MSW; favours a few user-flow tests over many tiny ones. |
| `zod` | `engineering-paved-path:zod` | Full-stack | define Zod schemas, use `safeParse` / `z.infer`, refinements and transforms, or validate untrusted input. 43 rules by impact. |
| `typescript-expert` | `engineering-paved-path:typescript-expert` | Full-stack | fix type errors, design complex or generic types, tune `tsconfig` or type-check speed, migrate JS→TS or CJS→ESM, work in a monorepo. |
| `security` | `engineering-paved-path:security` | Full-stack | review code for vulnerabilities or implement auth, input handling, file uploads, secrets or API endpoints. Based on OWASP Top 10:2025, with unsafe/safe code pairs and checklists. |

The two architecture skills are about **structure** (where code goes, what may import what); the library skills are about **using a library well**. They cross-reference each other, so the pair "Onion Architecture + Fastify + Drizzle + Zod" or "frontend architecture + React + RTL" covers a task end to end.

## Install

```sh
claude plugin marketplace add DanceWithBikes/dwithb-ai-marketplace
claude plugin install engineering-paved-path@dwithb-ai-marketplace
```

Or, inside Claude Code: `/plugin marketplace add DanceWithBikes/dwithb-ai-marketplace`, then `/plugin install engineering-paved-path@dwithb-ai-marketplace`.

## How to use

**Automatic.** Each skill has a description stating what it covers and when to use it. Claude loads a skill on its own when your request matches - you do not have to name it. "Add a `DELETE /projects/:id` endpoint" loads the backend architecture and Fastify skills; "this component is 600 lines, split it" loads the frontend architecture and React skills.

**Explicit.** Run a skill as a slash command when you want to force it:

```
/engineering-paved-path:backend-onion-architecture review the structure of src/modules/billing
/engineering-paved-path:security audit the auth middleware
```

**From agents in other plugins.** A subagent can preload skills through its frontmatter, always with the plugin namespace:

```yaml
---
name: my-reviewer
description: ...
skills:
  - engineering-paved-path:backend-onion-architecture
  - engineering-paved-path:frontend-ui-architecture
---
```

**Your project's conventions win.** The skills are defaults. They tell Claude to read your `AGENTS.md` / `CLAUDE.md`, look at neighbouring code, and use your own scripts for typecheck, tests and architecture checks. Paths in the skills (`src/modules/<module>/…`, `src/app/**/_components/…`) are reference layouts that Claude maps onto your repository.

## Example prompts

- "Add an endpoint that archives a project. Put each piece in the right ring and make the service testable without Postgres."
- "Review `src/modules/orders` for layering problems: route handlers that touch the DB, services that take the container, row types that leak."
- "Set up dependency-cruiser rules that enforce the onion dependency rule, with a baseline for existing violations."
- "Where should this `formatPrice` helper and the `STATUS_LABELS` map live? They're used by two routes."
- "Split `ProjectDetailsPage.tsx` into a thin page and well-scoped components."
- "Write RTL tests for the sign-up form: happy path, validation errors, server error."
- "Design the Postgres tables for invoices and line items, then the Drizzle schema."
- "Why does this generic lose its inference? Fix the types without `as`."
- "Check this file upload handler against OWASP Top 10."

## Used by

These plugins declare `engineering-paved-path` as a dependency; installing them installs this plugin too.

| Plugin | What it uses |
|---|---|
| [`architecture-review`](../architecture-review/) | Its `architecture-reviewer` agent preloads `backend-onion-architecture` and `frontend-ui-architecture` as its rulebook. |
| [`sdd-engineering`](../sdd-engineering/) | The planner and implementer agents load the skills that match the files they touch. |

## Requirements

- Claude Code with plugin support.
- No accounts, API keys or environment variables.
- The skills target TypeScript / JavaScript projects. Commands they suggest (`npx tsc`, `npm test`, dependency-cruiser, Drizzle Kit) run only if your project has those tools.
- `typescript-expert`'s optional diagnostic script needs `python3` and a Node toolchain (`npx tsc`).

## Permissions, network and side effects

- **No hooks, no MCP servers, no network access.** Nothing runs at install or on events.
- Skills are instructions; they do not execute anything by themselves. Any command Claude runs while following them goes through your normal permission prompts.
- **Bundled script:** `skills/typescript-expert/scripts/ts_diagnostic.py`. Run on demand from the project root (`python3 "${CLAUDE_SKILL_DIR}/scripts/ts_diagnostic.py"`), it prints a read-only health report: TypeScript and Node versions, strict flags in `tsconfig.json`, tooling and monorepo detection from `package.json` / workspace files, counts of `: any` and `as` in `src/`, a `tsc --noEmit` type check and `tsc --extendedDiagnostics` timings. It writes no files and makes no network calls of its own (`npx` may download `tsc` if TypeScript is not installed locally).
- `drizzle-orm-patterns` declares `allowed-tools: Read, Write, Edit, Bash, Grep, Glob` in its frontmatter (from upstream).

## Known limitations

- **No Next.js API skill.** `frontend-ui-architecture` covers App Router *structure* (thin pages, `_components`, server-client boundary), not Next.js APIs such as metadata, route handlers, caching or image/font. For those, install Vercel's skill: `npx skills add vercel/next.js`.
- The architecture skills are opinionated about one stack (Fastify + Drizzle + Zod on the backend, React + Next.js App Router on the frontend). The principles carry over to other frameworks, but the examples do not.
- `security` examples use React, Express, MongoDB and JWT; the principles apply to any web stack.
- Skill triggering is probabilistic. If a skill does not load when you expect it, call it explicitly with `/engineering-paved-path:<skill>`.

## Credits & licenses

The plugin is published under the marketplace's MIT license. Five skills are vendored from MIT-licensed upstream repositories; each keeps the upstream `LICENSE` file in its directory and is changed only minimally (frontmatter description, references to skills not shipped here).

| Skill | Upstream | License | Author |
|---|---|---|---|
| `fastify-best-practices` | [mcollina/skills](https://github.com/mcollina/skills) | MIT | Matteo Collina |
| `drizzle-orm-patterns` | [giuseppe-trisciuoglio/developer-kit](https://github.com/giuseppe-trisciuoglio/developer-kit) | MIT | Giuseppe Trisciuoglio |
| `postgresql-table-design` | [wshobson/agents](https://github.com/wshobson/agents) | MIT | Seth Hobson |
| `typescript-expert` | [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) | MIT | sickn33 and contributors |
| `zod` | [pproenca/dot-skills](https://github.com/pproenca/dot-skills) | MIT | pproenca |

The remaining skills (`backend-onion-architecture`, `frontend-ui-architecture`, `react-best-practices`, `react-testing-library`, `security`) were written for this marketplace and are MIT-licensed with it. Where a skill documents its sources, they are in its `README.md` or `references.md`.
