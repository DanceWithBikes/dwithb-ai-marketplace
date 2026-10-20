---
type: llm
weight: 2
---

The reply is an architecture review of a change to `src/modules/orders/domain.ts` and `src/modules/orders/service.ts`.

PASS if all of the following hold:
- It reports, as a finding, that `src/modules/orders/domain.ts` imports `FastifyReply` from `fastify`, and explains that the domain (innermost ring) must not depend on the web framework / presentation ring.
- It reports, as a separate finding, that `OrdersService` in `src/modules/orders/service.ts` constructs `new PgOrderRepository()` (or imports the concrete repository) instead of using the `OrdersRepositoryPort` it receives through `deps`, i.e. a service depending on infrastructure / bypassing the port and composition root.
- Each of those two findings names the rule it breaks, cites a `path:line` location, and proposes a concrete fix (e.g. drop the Fastify parameter from the domain function; use `this.deps.orders` and leave construction to `compose.ts`).

FAIL if any of the following hold:
- Either violation is missing, or is mentioned only as a suspicion without being reported as a finding.
- The reply declares its own PASS, BLOCKED, approved or "ready to merge" verdict.
- It adds findings about security, performance, naming, style or test coverage as if they were architecture violations.
