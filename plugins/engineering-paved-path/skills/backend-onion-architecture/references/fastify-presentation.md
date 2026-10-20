# Fastify: the presentation ring

How to use Fastify so that it stays at the edge. For Fastify's own APIs see `engineering-paved-path:fastify-best-practices`; this file is only about where the boundary runs.

## Contents
- A route handler has three lines
- Schemas are the boundary
- Response schemas
- Plugins are module boundaries
- Decorators: one, for the container
- What never appears in a handler
- Long-running work and SSE
- Considered and not adopted

## A route handler has three lines

Resolve the request context, call one service method, return the result. Anything else is a sign that logic is in the wrong ring.

```ts
// modules/repos/routes.ts
export default async function reposRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = buildRepoService(app.container);          // compose.ts

  app.post(
    '/repos',
    { schema: { body: RepoInput, response: { 200: Repo, 201: Repo } } },
    async (req, reply) => {
      const { workspaceId, userId } = await getContext(app.container, req);
      const { repo, created } = await service.add(workspaceId, userId, req.body.url);
      reply.status(created ? 201 : 200);
      return toRepoDto(repo);
    },
  );
}
```

Choosing `201` versus `200` is presentation: the service reports `created`, the route translates it. Choosing *whether the repo may be added* is not presentation.

A useful test: could this use case be triggered from a background job or a CLI tomorrow without copy-pasting? If the logic is in the handler, no.

## Schemas are the boundary

- Input is validated by the route's `schema` through `fastify-type-provider-zod`. `req.body`, `req.params` and `req.query` are then typed and trusted; do not call `Schema.parse(req.body)` in a handler, and do not re-validate in the service.
- Contract schemas come from the shared contracts package; a schema used by one route may be declared next to it. Common params (e.g. a uuid `IdParams`) live in `src/modules/_shared/schemas.ts`.
- Request context such as `workspaceId` comes only from one helper (e.g. `getContext(container, req)`). It is passed to the service as an argument - the service never sees `req`.
- The service signature uses domain vocabulary, not the request shape: `service.add(workspaceId, userId, url)`, not `service.add(req.body)`. When the input is large, pass a plain object typed in `domain.ts`.

## Response schemas

Add `response: { <status>: Schema }` to every new route.

- It makes the DTO the explicit contract. Without it the only thing standing between a Drizzle row and the client is the handler's TypeScript return type, which is erased at runtime.
- Zod object schemas strip unknown keys during serialization, so a column added to a table cannot leak into the API by accident.
- A mismatch raises a response-serialization error, which the error handler in `app.ts` should turn into a logged generic 500 - the bug is visible in tests instead of in the client.

If existing routes lack `response:` schemas, add one when you touch a route.

## Plugins are module boundaries

Each module is one Fastify plugin registered from `src/modules/index.ts`. `register` creates an encapsulated context: hooks and decorators added inside a module do not leak into siblings. Use that - a per-module `preHandler` or rate limit belongs inside the module's plugin, not in `app.ts`.

Do not wrap a feature module in `fastify-plugin`: that removes the encapsulation and is meant for infrastructure plugins that must decorate the root.

Static registration (one import + one entry in `src/modules/index.ts`) is a reasonable default; `@fastify/autoload` relies on dynamic import of `.ts`, which is not portable across tsx, bundlers and vitest.

## Decorators: one, for the container

`app.decorate('container', container)` in `app.ts` is the single decorator that carries dependencies. Do not add `app.decorate('repoService', …)` or `decorateRequest` for services:

- Decorators are a global, stringly-named registry; every new one needs a module augmentation and is invisible to the gate.
- The module entry point already has the container and a typed `buildXService` - a second channel for the same thing invites drift.

## What never appears in a handler

| In a handler | Move it to |
|---|---|
| `container.db…`, `drizzle-orm`, `db/schema` | `repository.ts` |
| `container.github()`, `container.git`, `container.llm()` (any adapter) | the service, through a port |
| `if` / loops implementing a product rule | `domain.ts` / `service.ts` |
| row → DTO mapping written inline | `helpers.ts` (`toXDto`) |
| `reply.code(404)` / `throw new AppError(…, 400)` for a business condition | the service throws an error *class*; `app.ts` maps it |
| `try / catch` that swallows an adapter failure to pick a fallback | the service - the fallback is a business decision |

The one `throw` that is legitimate in a route is for a condition only HTTP knows about (a malformed header that no schema can express).

## Long-running work and SSE

A handler never runs long work. The use case enqueues a job through its job-queue port and returns; the job handler is registered by the service (e.g. `registerCloneJobHandler`) and calls back into the same service. Streaming is split the same way: the route owns SSE framing (e.g. a `fastify-sse-v2` generator); the service owns *what* events exist and publishes them through a bus port.

## Considered and not adopted

- **`@fastify/awilix` / a DI container library.** It offers request-scoped lifetimes and disposal hooks. Most services need neither: when every dependency is an app-lifetime singleton, a hand-written `Container` + test overrides already gives a typed composition root and a test seam. A DI library is optional plumbing around a composition root, not a substitute for having one.
- **`fastify-decorators` / controller classes.** Adds a second programming model on top of plugins for no gain in isolation.
- **A generic `Controller` layer between route and service.** With schema-validated input the route *is* the controller; an extra hop would only forward arguments.
