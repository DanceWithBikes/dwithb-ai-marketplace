---
name: backend-onion-architecture
description: "Onion Architecture for TypeScript backends (Fastify, Drizzle, Zod): which ring code belongs to, what it may import, ports and adapters, composition root. Use when adding a module, endpoint, service, repository or adapter, deciding where backend code lives, or reviewing backend structure."
metadata:
  version: "1.0.0"
  updated: "2026-09-20"
---

# Onion Architecture (backend)

Decide **which ring backend code lives in** and **which way its imports point**. This skill is about structure and dependencies, not about how to use the libraries. It applies to any TypeScript backend built on Fastify 5 + Drizzle ORM + Postgres + Zod (and to any pure "engine" package that backend depends on) - even if the user never says "architecture".

| Question | Skill |
|---|---|
| Which file does this go in? What may it import? How do I wire it? How do I test it without Docker? | **this skill** |
| Fastify plugins, hooks, schemas, serialization | `engineering-paved-path:fastify-best-practices` |
| Drizzle queries, relations, migrations | `engineering-paved-path:drizzle-orm-patterns` |
| Table design | `engineering-paved-path:postgresql-table-design` |
| Zod schema technique | `engineering-paved-path:zod` |

## The one rule

> All code can depend on rings closer to the centre. Nothing may depend on a ring further out. The database is not the centre - it is external.

Business rules sit in the middle and know nothing about Fastify, Drizzle, Postgres, a GitHub SDK, the filesystem or an LLM SDK. Those are *details*: they change for reasons unrelated to the product (a driver upgrade, a new provider), so they live at the edge and plug into interfaces - **ports** - that the inner rings own. Two things follow, and they are the whole payoff: inner code is testable with plain objects, and an outer detail can be replaced without touching a rule.

The rule should be checked by a machine, not by goodwill: run your project's architecture check (e.g. a dependency-cruiser or `eslint-plugin-boundaries` rule set wired into CI). If the project has none yet, see [references/enforcement.md](references/enforcement.md).

## The rings, mapped onto file roles

Rings map onto file roles inside a vertical-slice feature folder such as `src/modules/<module>/` - there is no need for top-level `domain/`, `application/`, `infrastructure/` folders. The paths below are the reference layout; if the project uses different names, map the roles onto them and keep the dependency direction.

| Ring | Files | May import | Never imports |
|---|---|---|---|
| **Domain** (centre) | `domain.ts` (types, invariants, rules), `helpers.ts` (pure functions), `constants.ts`; the shared contracts package (e.g. `@app/shared`); a pure engine package, if any | itself, `zod`, `src/platform/errors.ts` | everything below |
| **Application** | `service.ts` and other use-case files (`run-executor.ts`); `ports.ts` (interfaces the use cases need) | domain, ports, `platform/errors.ts` | `drizzle-orm`, `src/db/**`, `fastify`, `src/adapters/**`, `platform/container.ts`, `node:fs`, SDKs |
| **Infrastructure** | `repository.ts` / `repository/**` (Drizzle), `src/adapters/**`, `src/db/**`, `src/platform/**` | application + domain, any library | `routes.ts`, other modules |
| **Presentation** | `routes.ts`, `src/modules/_shared/**` | services, DTO schemas, `compose.ts` | repositories, adapters, `drizzle-orm`, `src/db/**` |
| **Composition root** | `src/app.ts`, `src/platform/container.ts`, `src/modules/index.ts`, and each module's `compose.ts` | anything | - |

Infrastructure and presentation are the same outer ring seen from two sides (driven and driving); they do not import each other.

Full import matrix, the reasoning per cell and the rules for a pure engine package: [references/layers-and-imports.md](references/layers-and-imports.md).

## Where does this code go?

Ask in this order and stop at the first yes.

1. Does it mention `req`, `reply`, a status code, a header, SSE framing? → `routes.ts`.
2. Does it build a Drizzle query, mention a table, or map a row? → `repository.ts`.
3. Does it talk to something outside the process (a third-party API, git, an LLM, the filesystem, a clock you need to control)? → a **port** (interface) + an **adapter** in `src/adapters/`.
4. Does it coordinate several of the above to fulfil one user intention ("add a repo", "run a review")? → a method on `service.ts`.
5. Otherwise it is a rule, a calculation, a mapping or a type → `domain.ts` / `helpers.ts`. It must run in plain Node with no imports beyond the domain ring.

| You are adding | Put it in | Notes |
|---|---|---|
| Endpoint | `routes.ts` | `schema: { params, body, response }`, call one service method, return a DTO |
| Business operation | `service.ts` | takes a narrow `deps` object of ports; no SQL, no HTTP |
| SQL of any kind | `repository.ts` (split into `repository/<aggregate>.repo.ts` when it grows) | every query scoped by the tenant key (e.g. `workspaceId`) if the app is multi-tenant; returns domain types, never `$inferSelect` rows |
| Interface a service needs | `ports.ts` in the module; the shared contracts package when several modules or the engine package need it | owned by the consumer, shaped by what the use case needs |
| Call to an external system | `src/adapters/<name>/` implementing the port | + a mock (e.g. `src/adapters/mocks.ts`) + a field in the container's test overrides |
| Domain type | `domain.ts` | plain TS or `z.infer`; for a CRUD module with no behaviour the shared contract type *is* the domain type |
| Row → domain mapping | inside the repository file | the row type never leaves it |
| Domain → DTO mapping | `helpers.ts` (`toXDto`) | pure; imports the contract type, not the repository |
| Error | a class from `src/platform/errors.ts` | pick a *class*, never a number; add a subclass there if none fits |
| Wiring | `compose.ts` (`buildXService(container)`) | the only module file that sees both the `Container` and the concrete repository |
| Something two modules need | a port exposed on the container, or `src/modules/_shared/` | never import another module's folder |
| Pure, I/O-free core logic | the engine package, if the project has one | dependencies arrive as function arguments |

## Rules, with their reasons

1. **Only repositories import `drizzle-orm` and `src/db/**` - including `import type`.** A row type in a service signature couples the use case to the schema just as much as a query does: rename a column and the rule layer stops compiling.
2. **Routes call services and nothing else.** A handler that queries the database cannot be reused by a job, a CLI or a test, and its logic can only be exercised through HTTP.
3. **Services receive ports, not the `Container`.** A constructor that takes the container hides its real dependencies and forces every test to fake the world. Declare `interface XServiceDeps { … }` and let `compose.ts` fill it.
4. **Ports are owned by the consumer.** Declare the narrowest interface the use case needs; TypeScript is structural, so an existing `JobRunner` or repository class satisfies it without an `implements`. A port that mirrors a library's API is not a port.
5. **Adapters are constructed only in the container (`src/platform/container.ts`).** One place decides real versus mock, which is what makes `buildApp({ overrides })` work.
6. **Modules do not import each other.** A feature should be deletable; cross-module needs go through a port on the container.
7. **Parse at the edge, trust inside.** Input is validated once by the route's Zod schema; stored JSON is parsed once in the repository. Inner code does not re-validate.
8. **Responses have a schema.** `response:` makes the DTO the contract and stops a row from leaking through serialization.
9. **Inner rings choose an error class, the edge chooses the status.** No `reply.code()`, no numeric status outside `platform/errors.ts` and the error handler in `app.ts`.
10. **A pure engine package does no I/O and is imported only through its `index.ts`.** Everything it needs is an argument.

The library-specific detail behind these rules:
[references/fastify-presentation.md](references/fastify-presentation.md) ·
[references/drizzle-persistence.md](references/drizzle-persistence.md) ·
[references/ports-and-composition.md](references/ports-and-composition.md) ·
[references/domain-types-and-errors.md](references/domain-types-and-errors.md) ·
[references/testing-by-ring.md](references/testing-by-ring.md)

## Workflow

**Adding a feature - build from the centre outwards.**
1. Read the project's `AGENTS.md` / `CLAUDE.md` (and the module's, if any) and open the cleanest existing module as the live reference.
2. Domain: name the types and write the rules as pure functions. Unit-test them.
3. Ports: write the interfaces the use case needs, in its own vocabulary (`findByFullName`, not `select`).
4. Application: write the service method against the ports. Unit-test it with in-memory fakes - no Docker.
5. Infrastructure: implement the repository / adapter. Cover the repository with an integration test (e.g. `*.it.test.ts` against Testcontainers).
6. Presentation: add the route with `params` / `body` / `response` schemas; it calls one service method.
7. Wiring: extend `compose.ts` (and the container + its test overrides + mocks for a new adapter).
8. Run the project's architecture check, typecheck and unit tests (commands from `package.json` / `AGENTS.md`).

**Touching a file that is already in the baseline of known violations.** Leave the ring cleaner than you found it: move the code you are changing into the right ring, then re-record the baseline so the recorded debt shrinks. Do not refactor the rest of the file unasked. Step-by-step extraction of a fat `routes.ts`, with a worked example: [references/refactoring-playbook.md](references/refactoring-playbook.md).

**Reviewing structure** - check in this order:
1. Does any import point outwards? (The architecture check answers this; read the rule's comment.)
2. Does a Drizzle row type, a `FastifyRequest` or an SDK type appear in a service or domain signature?
3. Does a service take the container, call `new` on an adapter, or read `process.env` / the filesystem?
4. Is there logic in a route handler beyond parse → call → return?
5. Can the new service method be tested without Postgres? If not, a port is missing.

Report findings as: location, the rule it breaks, the concrete move that fixes it.

## The gate

Typical scripts for a dependency-cruiser setup (names are illustrative - use whatever the project defines):

```sh
npm run lint:arch      # fails on NEW violations only (CI runs the same command)
npm run lint:arch:all        # every violation, including the recorded ones
npm run lint:arch:baseline   # re-record after you REMOVED violations
```

A failing check means the import is wrong, not the rule. Fix the code; never add a new violation to the baseline, and never weaken a rule to get green without the user's agreement. How the rules are written, how to add one, and the baseline's one gotcha: [references/enforcement.md](references/enforcement.md).

## Pragmatic limits

Onion Architecture pays off for long-lived code with real behaviour; applied blindly it produces ceremony. These are deliberate:

- **No folder reshuffle.** Rings are file roles inside a feature folder. Vertical slices stay.
- **No DI library.** One hand-written composition root is what matters; a container library is optional plumbing.
- **Zod is allowed in the centre.** It is a pure, I/O-free library and the contracts are the ubiquitous language.
- **No interface for its own sake.** Add a port when a use case crosses the process boundary or needs a fake in a test - not around a pure function.
- **A module with no database access and no rules may be a single `routes.ts`.** The moment it needs one query, it gets a `repository.ts` and a `service.ts`.
- **Health / readiness probes in `app.ts` may touch the db handle directly.** They are composition-root code.

## Adopting on an existing codebase

Most codebases already contain violations: services that take the whole container, Drizzle row types used as the domain model, route handlers that query the database, modules importing each other's constants. Record them in the gate's baseline (known-violations file) when introducing it, and treat them as debt:

- Leave recorded deviations alone unless you are working in that file, and **never use them as precedent** for new code.
- If the project documents its known deviations (in `AGENTS.md`, an ADR or the baseline itself), read that list before copying patterns from an existing module.
- Pick the module that best follows this skill as the reference for new work; if none does, follow the templates in [references/refactoring-playbook.md](references/refactoring-playbook.md).

## Sources

Every rule traces to a source listed with what was taken from it in [README.md](README.md).
