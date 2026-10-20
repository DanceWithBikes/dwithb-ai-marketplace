# Layers and imports

## Contents
- Why an onion and not layers
- The rings, in detail
- Import matrix
- Anatomy of a module
- A pure engine package: the centre as a package
- The shared contracts package
- Things that look like violations but are not

## Why an onion and not layers

Classic layering stacks UI → business logic → data access, so business logic depends on the data layer and, transitively, on the database library. Apply the Dependency Inversion Principle to that stack - make the data layer depend on an interface the business layer owns - and every arrow flips to point at the middle. That is the onion: the same layers, with the database moved from the bottom to the outside. Ports and Adapters, Clean Architecture and Onion Architecture are the same idea drawn differently; this skill uses the onion vocabulary because the ring picture makes the single rule obvious.

What it buys in practice:

- Services become testable with plain objects. When services take the whole container, every service test needs Postgres in Docker because there is nothing to substitute.
- A core package that takes its LLM, clock or HTTP client as an argument can be tested without network, keys or a database.
- Swapping a provider, a driver or a Fastify major touches the edge only.

## The rings, in detail

**Domain (centre).** The vocabulary and the rules of the product: what a `Repo`, a `PullRequest`, a `ReviewRun` is (the examples in this skill use a code-review product; substitute your own nouns); which state transitions are legal; how a severity rollup is computed; how a repo URL is parsed. Types and pure functions. It is coupled only to itself. If a function here needs the current time, an id or a row, it receives it as an argument.

**Application.** Use cases: one public method per user intention. A use case loads what it needs through ports, asks the domain to decide, and saves the result through ports. It owns the *port interfaces* it depends on. It knows no SQL, no HTTP and no SDK; it does know the order of steps, what is atomic, and which job to enqueue.

**Infrastructure (outer ring, driven side).** Implementations of ports: Drizzle repositories, third-party API / git / LLM adapters, the job runner, an event bus, config and secrets. Free to use any library. Converts between the outside representation (rows, SDK payloads) and domain types, so the conversion never leaks inwards.

**Presentation (outer ring, driving side).** Fastify route plugins. Converts HTTP into a service call and a domain result into a DTO. Owns schemas for `params`, `body`, `querystring` and `response`.

**Composition root.** The one place allowed to know everything, because its only job is to `new` things and hand them to each other: `src/app.ts` → `src/platform/container.ts` → `src/modules/index.ts` → each module's `compose.ts`.

## Import matrix

Rows import columns. ✅ allowed · ❌ forbidden · `T` type-only is still ❌ where marked, because the gate should count `import type`.

| from ↓ / to → | domain | ports | service | repository | adapters | `src/db` + drizzle | fastify | `container.ts` | other module |
|---|---|---|---|---|---|---|---|---|---|
| `domain.ts`, `helpers.ts`, `constants.ts` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `ports.ts` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `service.ts`, use-case files | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `repository.ts`, `repository/**` | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `src/adapters/**` | ✅ (shared) | ✅ (shared) | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `routes.ts` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ (via `app.container`) | ❌ |
| `compose.ts` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `platform/container.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | - | ✅ |

`platform/errors.ts` may be imported from every ring: it is the error vocabulary, see [domain-types-and-errors.md](domain-types-and-errors.md).

## Anatomy of a module

Create only the files the module needs.

```
modules/<name>/
  domain.ts        types + rules (pure)
  helpers.ts       pure functions: parsing, mapping domain → DTO
  constants.ts     literals
  ports.ts         interfaces the use cases depend on
  service.ts       use cases; constructor takes a deps object of ports
  repository.ts    Drizzle; implements the store port; maps row → domain
  compose.ts       buildXService(container): wires ports to implementations
  routes.ts        Fastify plugin; schemas; calls the service
  AGENTS.md        optional: module-specific conventions for agents
```

Dependency direction inside the folder:

```
routes.ts ──► service.ts ──► ports.ts ──► domain.ts ◄── helpers.ts
    │                           ▲
    └──► compose.ts ──► repository.ts (implements a port, returns domain types)
```

## A pure engine package: the centre as a package

Some backends extract the domain and application rings of one feature into a separate package (e.g. `packages/core`, imported as `@app/core`) so the rule is enforced by the package boundary. If yours does:

- Dependencies arrive as **function arguments** (`input.llm`, `onEvent`, `checkCancelled`), never through a container, a constructor singleton or module state.
- No `node:fs`, no `child_process`, no network, no server imports. Context the engine needs is resolved by the server and passed in as plain values.
- Consumers import the package root - the `index.ts` barrel - and nothing deeper. A tsconfig alias may technically permit a deep path such as `@app/core/feature/run.js`; the gate should forbid it.
- Contracts come from the shared contracts package; do not define API types in the engine.
- Logic that needs no I/O and belongs to the feature (scoring, prompt assembly, reducing) goes here rather than into the server module, which stays an I/O shell around the engine.

## The shared contracts package

The Zod contracts and the adapter port interfaces (e.g. a package `@app/shared`) are part of the centre: every ring may import them. Keep them there: they import nothing from the server (the gate should check this), and if the same package is consumed by a browser client, it must stay free of Node-only code.

## Things that look like violations but are not

- `routes.ts` reading `app.container` - the plugin function is the module's entry point and hands the container to `compose.ts`. What a route must not do is *use* `container.db` or an adapter itself.
- `src/modules/_shared/context.ts` importing `FastifyRequest` - it is presentation-ring code shared by routes.
- `src/platform/container.ts` importing module repositories and facades - it is the composition root.
- A repository importing shared contract types - inward import.
- `app.ts` running `select 1` for readiness - composition-root code, no use case involved.
