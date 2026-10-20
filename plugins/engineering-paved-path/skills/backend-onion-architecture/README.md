# Backend Onion Architecture Skill

**Version:** 1.0.0 · **Updated:** 2026-09-20 · **Scope:** Backend · **Entry point:** [SKILL.md](SKILL.md)

The version is recorded in `SKILL.md` frontmatter under `metadata.version` and mirrored here.

## Motivation

Library skills such as `fastify-best-practices`, `drizzle-orm-patterns`, `postgresql-table-design` and `zod` each explain how to use one library well. None answers the structural questions that decide whether a backend stays maintainable:

- Which file does this code belong in, and what is it allowed to import?
- Where do Drizzle queries, row types and transactions stop?
- What does a service depend on, and how is it wired?
- How can a use case be tested without Postgres in Docker?
- How do two modules collaborate without importing each other?

A typical failure mode: the layering `routes → service → repository` is documented, yet route handlers query the database, every service takes the whole DI container, and Drizzle row types act as the domain model. Documentation alone does not hold, so the skill is meant to be paired with a mechanical gate (dependency-cruiser or `eslint-plugin-boundaries`) run locally and in CI.

The skill deliberately maps Onion Architecture onto file roles inside vertical-slice module folders instead of introducing `domain/`, `application/`, `infrastructure/` folders. The dependency rule is what matters; the folder names are not.

## Layout

| File | Purpose | Loaded |
|---|---|---|
| `SKILL.md` | The rule, ring map, placement procedure, ten rules with reasons, workflows, gate, limits, adopting on existing code | when the skill triggers |
| `references/layers-and-imports.md` | Ring definitions, import matrix, module anatomy, a pure engine package, the shared contracts package | on demand |
| `references/fastify-presentation.md` | Thin handlers, schemas as the boundary, response schemas, plugins, decorators | on demand |
| `references/drizzle-persistence.md` | Repositories as port implementations, rows stay inside, tenancy, read models, unit of work | on demand |
| `references/ports-and-composition.md` | Port ownership, deps objects, `compose.ts`, adding an adapter, the container, cross-module collaboration | on demand |
| `references/domain-types-and-errors.md` | `domain.ts`, Zod in the centre, parse-don't-validate, mappers, error classes versus statuses | on demand |
| `references/testing-by-ring.md` | Test style per ring, in-memory fakes, fakes versus mocks | on demand |
| `references/enforcement.md` | The gate: commands, example rule table, baseline, adding a rule, blind spots | on demand |
| `references/refactoring-playbook.md` | Extracting a fat `routes.ts` (worked example), removing the container, new module template, debt order | on demand |

## Where sources disagree, and what the skill decided

| Question | Positions | Decision |
|---|---|---|
| Separate layer folders or file roles inside a feature? | Most Node.js write-ups (Jansen, Bazaglia, the Melzar boilerplate) use top-level `domain/ app/ infra/ api/`. Graça organizes by component first, layers inside. | File roles inside a vertical-slice module folder. Seemann's argument that layers, onions and ports-and-adapters are one idea means the rule, not the folder tree, carries the value; a reshuffle costs a lot and enforces nothing the gate does not already enforce. |
| DI container library? | Jansen and Bazaglia use InversifyJS; `@fastify/awilix` is the Fastify-native option. Seemann: a container is optional, a single Composition Root is not. | A hand-written `Container` plus a per-module `compose.ts`. Request-scoped lifetimes are rarely needed, and container overrides provide the test seam. |
| Where is a transaction opened? | The Sentry article opens it in the controller and threads an optional `tx` through use cases and repositories. | The use case decides atomicity through a `UnitOfWork` port; `tx` never leaves the infrastructure ring. Threading `tx` inwards leaks a persistence handle into two inner rings. |
| May the centre depend on a validation library? | Purist readings of the dependency rule say the domain has zero dependencies (Stemmler's table). | Zod is allowed: it is pure, I/O-free, and shared contracts are written in it. The rule targets volatile details and I/O, not every npm package. |
| Separate domain type and DTO for every entity? | Jansen and Bazaglia always map entity ↔ data model. Palermo notes the architecture is "not appropriate for small websites". | Three shapes where there is behaviour; for a CRUD module the shared contract type doubles as the domain type. The row never travels outwards in either case. |
| HTTP status on domain errors? | Clean-architecture sources keep transport out of errors entirely. Many codebases bake `statusCode` into a base `AppError`. | Target: status table in the error handler. Interim rule that needs no migration: inner rings pick an error *class*, never a number. |
| Ports for everything? | Interface-per-class is common in the .NET-derived literature. | A port only where the call leaves the process or a test needs a substitute. TypeScript's structural typing makes narrow consumer-owned ports cheap, so no `I`-prefixed mirror interfaces. |
| dependency-cruiser or ESLint boundaries? | Both are credible; `eslint-plugin-boundaries` gives in-editor feedback. | Either. dependency-cruiser resolves tsconfig `paths` and has a first-class baseline for existing debt, which suits a project without ESLint; `eslint-plugin-boundaries` fits a project that already lints. |

## Sources

Fetched and read on 2026-09-20 unless marked otherwise.

### Onion Architecture and its relatives

- [Jeffrey Palermo: The Onion Architecture, part 1](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/) - the original statement: all coupling is toward the centre; "the database is not the center, it is external"; repository interfaces in the ring around the domain model, implementations at the edge; suited to long-lived applications with complex behaviour, not small sites. The rest of the series: [onion-architecture tag](https://jeffreypalermo.com/tag/onion-architecture/) *(index page seen in search results, parts 2-4 not read)*.
- [Mark Seemann: Layers, Onions, Ports, Adapters: it's all the same](https://blog.ploeh.dk/2013/12/03/layers-onions-ports-adapters-its-all-the-same/) - applying the Dependency Inversion Principle to a layered design *produces* the onion; flatten the hierarchy and you have ports and adapters. Basis for "the rule matters, not the folder names".
- [Mark Seemann: Composition Root](https://blog.ploeh.dk/2011/07/28/CompositionRoot/) - one place, as close to the entry point as possible, assembles the object graph; a DI container is optional and may be referenced only there. Basis for the container / `compose.ts` rules.
- [Herberto Graça: DDD, Hexagonal, Onion, Clean, CQRS… How I put it all together](https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/) - driving versus driven adapters; ports belong to the core and are shaped by its needs, not by the tool's API; application services orchestrate, domain services hold rules; components collaborate without direct dependencies. Companion piece: [Onion Architecture](https://medium.com/the-software-architecture-chronicles/onion-architecture-79529d127f85) *(found in search, not fetched)*.
- [Alexis King: Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/) - parse at the boundary into types that carry the proof; avoid validation scattered through the program.

### Onion / Clean Architecture in Node.js and TypeScript

- [Khalil Stemmler: Clean Node.js Architecture](https://khalilstemmler.com/articles/enterprise-typescript-nodejs/clean-nodejs-architecture/) - policy versus detail; the dependency rule; ports as interfaces and adapters as implementations; test the domain with mocks that implement the contract; relax for short-lived scripts.
- [Remo H. Jansen: Implementing SOLID and the onion architecture in Node.js with TypeScript and InversifyJS](https://dev.to/remojansen/implementing-the-onion-architecture-in-nodejs-with-typescript-and-inversifyjs-10ad) - ring contents for a Node service; repository interfaces inside, data mappers in infrastructure translating weakly-typed results into domain entities.
- [André Bazaglia: Clean architecture with TypeScript: DDD, Onion](https://bazaglia.com/clean-architecture-with-typescript-ddd-onion/) - repository interface in the domain, implementation in infrastructure, in-memory persistence for tests.
- [Melzar/onion-architecture-boilerplate](https://github.com/Melzar/onion-architecture-boilerplate) - reference folder layout for Node + TypeScript *(found in search, not fetched; cited as a counter-example for the folder decision)*.

### Fastify

- [Fastify: The hitchhiker's guide to plugins](https://fastify.dev/docs/latest/Guides/Plugins-Guide/) - `register` creates an encapsulated context; decorators flow to children, not siblings; `fastify-plugin` removes encapsulation and is for infrastructure plugins.
- [Fastify: Decorators](https://fastify.dev/docs/latest/Reference/Decorators/) - decorator scoping and the `dependencies` option; reference-typed request decorators are rejected. Basis for "one decorator, for the container".
- [Fastify: Type Providers](https://fastify.dev/docs/latest/Reference/Type-Providers/) *(found in search, not fetched)* - provider typing is per encapsulated context, hence `appBase.withTypeProvider<ZodTypeProvider>()` in every module.
- [fastify-type-provider-zod](https://github.com/turkerdev/fastify-type-provider-zod) - `response: { <status>: schema }`, `isResponseSerializationError`; check which major pairs with your Zod version. The serializer emits the *parsed* value, so Zod's default object behaviour strips unknown keys (verified in the package source, not only the README).
- [@fastify/awilix](https://github.com/fastify/fastify-awilix) - app and request scopes, lifetimes, disposal. Considered and not adopted as the default.

### Drizzle

- [Drizzle ORM: Transactions](https://orm.drizzle.team/docs/transactions) - `db.transaction`, `tx.rollback()` works by throwing, nested transactions are savepoints, Postgres isolation options.
- [Sentry: Atomic Repositories in Clean Architecture and TypeScript](https://blog.sentry.io/atomic-repositories-in-clean-architecture-and-typescript/) - Drizzle-specific; an application-ring `ITransactionManagerService` hiding the driver's `tx`; mapping driver errors to domain errors. The skill takes the abstraction and rejects opening the transaction in the controller.
- [Repository Pattern in Nest.js with Drizzle ORM](https://medium.com/@vimulatus/repository-pattern-in-nest-js-with-drizzle-orm-e848aa75ecae) *(found in search, not fetched)*.

### Enforcement

- [dependency-cruiser: rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md) - `forbidden` / `allowed`, regex paths, `pathNot`, capture-group references, `tsConfig`.
- [dependency-cruiser: CLI](https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md) - `--ignore-known`, the known-violations file, `depcruise-baseline` (17.x) versus `--baseline` (18.3+), `err-long`.
- [Atomic Object: Dependency Cruiser - Restrict Imports in JavaScript](https://spin.atomicobject.com/dependency-cruiser-imports/) - forbidden rules as guardrails around known risks.
- [Avoid Cross Module Dependencies with Dependency Cruiser](https://dev.to/jacobandrewsky/avoid-cross-module-dependencies-with-dependency-cruiser-3b0b) *(found in search, not fetched)*.
- [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries) - element types and allow/disallow policies, flat config. The alternative for projects that already use ESLint.

## Maintaining

- A change to a rule lands together in the project's gate config, the example rule table in `references/enforcement.md`, and the rules in `SKILL.md`.
- Add a source here whenever a rule is added or changed, with one line on what was taken from it.

## Changelog

- **1.0.0** (2026-09-20) - Initial version: ring map onto module files, placement procedure, ten rules, Fastify / Drizzle / ports / types-and-errors / testing references, architecture gate with baseline, refactoring playbook.
