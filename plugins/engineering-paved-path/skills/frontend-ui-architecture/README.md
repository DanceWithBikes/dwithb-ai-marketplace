# Frontend UI Architecture Skill

**Version:** 1.1.0 · **Updated:** 2026-09-21 · **Scope:** Frontend · **Entry point:** [SKILL.md](SKILL.md)

The version is recorded in `SKILL.md` frontmatter under `metadata.version` (the field the [Agent Skills specification](https://agentskills.io/specification) reserves for it) and mirrored here. Bump both together and add a changelog line below.

## Motivation

Skills like `react-best-practices` (how to write components, state and effects) and a Next.js API skill (how to use Next.js APIs) do not answer the structural questions that come up on almost every frontend task:

- Where should this component live, and when does it become "shared"?
- How should a large component be split?
- Where do constants go? What is a helper and what is a util?
- Where does business logic belong?
- What is allowed to import what? Are `index.ts` files good or bad?
- What belongs in `page.tsx`, and where does `'use client'` go?

This skill covers exactly that - **architecture and code organization** - and deliberately excludes performance and React runtime patterns to avoid duplicating the sibling skills. `react-best-practices` keeps a five-line "Code Organization" section; this skill is the detailed treatment and is consistent with it.

## Layout

| File | Purpose | Loaded |
|---|---|---|
| `SKILL.md` | Principles, placement table, workflows, example mapping | when the skill triggers |
| `references/placement-guide.md` | Constants, helpers vs utils, hooks, business logic, API layer, types, tests, anti-patterns | on demand |
| `references/component-splitting.md` | Signals, workflow, composition, container/presentational today | on demand |
| `references/boundaries-and-imports.md` | Dependency direction, public API, barrel files, lint enforcement | on demand |
| `references/nextjs-app-router.md` | Thin routes, private folders, server-client boundary, data access layer | on demand |

Design choices follow the [skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices): a description stating what and when in the third person, a `SKILL.md` well under 500 lines, references one level deep each with a table of contents, rules explained by their reasons rather than by capitalised imperatives, one default per decision instead of a menu of options, and no time-sensitive statements in the instructions.

## Where sources disagree, and what the skill decided

| Question | Positions | Decision |
|---|---|---|
| Organize by function or by feature? | Josh Comeau: by function, because feature boundaries are hard to draw and drift. Bulletproof React, Feature-Sliced Design, Robin Wieruch: by feature for anything beyond a small app. | Hybrid, matching the Next.js "split by feature or route" strategy: route-specific code is colocated with the route, and only the shared layer is organized by function. The route tree supplies the feature boundaries, which answers Comeau's objection that categorization is hard. |
| Are `index.ts` barrel files good? | TkDodo and Bulletproof React: avoid in application code (module bloat, cycles). Feature-Sliced Design, Robin Wieruch, Josh Comeau: an index is the folder's public API. | Distinguish the kinds. Narrow per-folder entry points with explicit named exports are kept; directory-wide barrels and `export *` are rejected; package entry points are fine. Guard rails: never import your own index, no logic in it, separate server entry. |
| Container / presentational split? | Original pattern (Abramov, 2015) versus its later retraction; patterns.dev: largely superseded by hooks. | Keep the separation of concerns, drop the mandatory wrapper component: hooks own logic, leaf components stay free of data fetching. |
| One custom hook per query? | TkDodo: unnecessary indirection, prefer `queryOptions`. Bulletproof React: fetcher + hook per request. | Project-level choice. The invariant taken from both is that key, fetcher and options live together. If the project mandates one style (e.g. all query hooks in `src/lib/hooks`), that wins. |
| When to extract shared code? | DRY instinct versus AHA / "prefer duplication over the wrong abstraction". | Promote on the second real consumer outside the scope (a move, not a copy); abstract similar-but-different code only on the third occurrence. |
| Full Feature-Sliced Design layers? | FSD prescribes seven layers and renamed `_app` / `_pages` folders under Next.js. | Not adopted as the default: too heavy for most Next.js apps and in conflict with the route-colocation convention. Taken from FSD: the import rule, the public API goals, and the server-client entry point split. |

## Sources

All links were fetched and read on 2026-09-20 unless marked otherwise.

### Official documentation

- [Next.js: Project structure and organization](https://nextjs.org/docs/app/getting-started/project-structure) - Next.js is unopinionated; colocation is safe because only `page`/`route` make a segment public; private `_folders`; route groups; `src/`; the three organization strategies; "choose a strategy and be consistent". *Every convention used by the skill exists in both Next.js 15 and 16.*
- [Next.js: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) - `'use client'` as a module-graph boundary; put it on specific interactive components; interleaving via `children`; providers as deep as possible; wrapping third-party components; `server-only` / `client-only`.
- [Next.js: How to think about data security](https://nextjs.org/docs/app/guides/data-security) - the Data Access Layer (server-only, authorization, minimal DTOs); choose one data-fetching approach; thin Server Actions delegating to the data access layer; audit checklist.
- [React: Thinking in React](https://react.dev/learn/thinking-in-react) - single responsibility for components; component tree mirrors the data model; where state lives.
- [React: Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) - when to extract a hook; the `use` prefix only for functions that call hooks; concrete use-case hooks instead of lifecycle wrappers; hooks share logic, not state.
- [React: Keeping Components Pure](https://react.dev/learn/keeping-components-pure) - components as pure functions; side effects belong in event handlers, effects as a last resort.

### Architecture methodologies and reference projects

- [Bulletproof React: Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) - feature folder anatomy; "only include the ones that are necessary"; no cross-feature imports, compose at the app level; unidirectional `shared → features → app`; `import/no-restricted-paths` zones.
- [Bulletproof React: Components and Styling](https://github.com/alan2207/bulletproof-react/blob/master/docs/components-and-styling.md) - colocation; no nested render functions; limit props; wrap third-party components.
- [Bulletproof React: API Layer](https://github.com/alan2207/bulletproof-react/blob/master/docs/api-layer.md) - a single pre-configured API client; types + fetcher + hook declared together per request.
- [Feature-Sliced Design: Overview](https://feature-sliced.design/docs/get-started/overview) - layers, slices, segments; "modules on one layer can only know about and import from modules from the layers strictly below"; slices on one layer cannot use each other.
- [Feature-Sliced Design: Public API](https://feature-sliced.design/docs/reference/public-api) - the three goals of a public API; why wildcard re-exports hurt; index-file problems (cycles, bundle size in shared collections, dev-server speed).
- [Feature-Sliced Design: Usage with Next.js](https://feature-sliced.design/docs/guides/tech/with-nextjs) - route files re-exporting page components; separate `index.server.ts` so server-only modules do not leak into the client graph.
- [Martin Fowler / Juntao Qiu: Modularizing React Applications with Established UI Patterns](https://martinfowler.com/articles/modularizing-react-apps.html) - React is the view layer; view / hooks / domain model / gateway layering; the step-by-step extraction order.

### Essays

- [Kent C. Dodds: Colocation](https://kentcdodds.com/blog/colocation) - "place code as close to where it's relevant as possible"; things that change together live together; tests colocated, end-to-end tests excepted.
- [Kent C. Dodds: State Colocation](https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster) - the local → lift → context/composition decision path; architecture before memoization.
- [Kent C. Dodds: AHA Programming](https://kentcdodds.com/blog/aha-programming) - avoid hasty abstractions; "prefer duplication over the wrong abstraction" (Sandi Metz); optimize for change first.
- [Josh W. Comeau: Delightful React File/Directory Structure](https://www.joshwcomeau.com/react/file-structure/) - the helpers (project-specific) versus utils (generic) distinction; component folder with an index; the case for organizing by function.
- [Robin Wieruch: React Folder Structure Best Practices](https://www.robinwieruch.de/react-folder-structure/) - structure evolves with app size; index as public API; at most two levels of nesting; only reusable hooks go to the shared folder; the deletion test; promotion to the shared layer.
- [TkDodo: Please Stop Using Barrel Files](https://tkdodo.eu/blog/please-stop-using-barrel-files) - circular imports through barrels; measured module-count reduction in a Next.js app; impure barrels defeat `optimizePackageImports`; barrels are for libraries.
- [TkDodo: The Query Options API](https://tkdodo.eu/blog/the-query-options-api) - keep the query key with the query function; a custom hook per query is optional.
- [patterns.dev: Container/Presentational Pattern](https://www.patterns.dev/react/presentational-container-pattern/) - definition, trade-offs, and hooks as the modern replacement.
- [Dan Abramov: Presentational and Container Components](https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0) - the original pattern and the author's later note that he no longer recommends the strict split. **Not fetched:** Medium returned HTTP 403 to automated access. The claim in the skill is corroborated by the patterns.dev article above; open the link in a browser to read the author's note directly.

### Tooling

- [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries) - declare element types and the allowed dependencies between them.
- [Steiger](https://github.com/feature-sliced/steiger) - architecture linter for Feature-Sliced Design projects.
- `import/no-restricted-paths` and `import/no-cycle` from `eslint-plugin-import` - referenced by Bulletproof React and TkDodo above. The ESLint equivalents.
- [dependency-cruiser: rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md) - forbidden-dependency rules with group matching (`$1` from `from.path` reused in `to.pathNot`), `circular` with `viaOnly` / `dependencyTypesNot` to ignore type-only cycles, and `--ignore-known` baselines. A good fit for projects without ESLint, or that already gate a backend with it: one dev dependency plus one config file covers every boundary rule.

### Skill authoring

- [Agent Skills specification](https://agentskills.io/specification) - frontmatter fields, `metadata.version`, name must match the directory, progressive disclosure, references one level deep.
- [Anthropic: Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) - conciseness, descriptions, reference structure, evaluation-first development.

## Maintaining

- Project conventions belong in the project's own `AGENTS.md` / `CLAUDE.md`; this skill defers to them.
- Add a source here whenever a rule is added or changed, with one line on what was taken from it.

## Changelog

- **1.1.0** (2026-09-21) - Boundaries enforced mechanically: documented a dependency-cruiser boundary gate in the workflows and the boundaries reference; description tested for triggering against near-miss queries.
- **1.0.0** (2026-09-20) - Initial version: five principles, placement table, splitting guidance, boundaries and barrel-file policy, Next.js App Router structure, example mapping.
