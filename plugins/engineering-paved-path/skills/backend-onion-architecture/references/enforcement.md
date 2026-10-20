# Enforcement: the architecture gate

Conventions that are only written down erode; a codebase can have its layering documented in `AGENTS.md` and still grow modules that query the database from route handlers. The dependency rule should therefore be checked mechanically - by dependency-cruiser, `eslint-plugin-boundaries`, or an equivalent - locally and in CI.

Everything below is illustrative: rule names, script names and paths are a reference setup. Use whatever the project already defines (look in `package.json`, `AGENTS.md` / `CLAUDE.md`, and the CI workflow).

## Contents
- Commands
- What the gate checks
- Reading a failure
- The baseline
- Adding or changing a rule
- What the gate cannot see
- dependency-cruiser or ESLint

## Commands

A typical dependency-cruiser setup exposes three scripts:

```sh
npm run lint:arch      # new violations only - this is what CI runs
npm run lint:arch:all        # everything, including recorded debt
npm run lint:arch:baseline   # re-record the known-violations file
```

```jsonc
// package.json (example)
"scripts": {
  "lint:arch": "depcruise src --config .dependency-cruiser.cjs --ignore-known",
  "lint:arch:all": "depcruise src --config .dependency-cruiser.cjs",
  "lint:arch:baseline": "depcruise-baseline src --config .dependency-cruiser.cjs" // 18.3+: depcruise --baseline
}
```

- Config: `.dependency-cruiser.cjs` (`.cjs` if the package is ESM).
- CI: run `lint:arch` in the same job as typecheck, triggered on the backend's paths.
- Point the cruise at the tsconfig (`options.tsConfig`) so `paths` aliases resolve; then a shared contracts package or an engine package reached through an alias is covered from the backend run. Their dependencies must be installed for imports to resolve.

## What the gate checks

An example rule set for the layout in `SKILL.md`:

| Rule | Meaning |
|---|---|
| `routes-only-talk-to-services` | `routes.ts` never imports a repository or `src/adapters/**` |
| `only-repositories-touch-the-database` | inside a module only `repository.ts` / `repository/**` import `drizzle-orm`, `postgres`, `src/db/**` |
| `only-routes-know-fastify` | Fastify packages only in `routes.ts`, `src/modules/_shared/**`, `src/modules/index.ts` |
| `modules-depend-on-ports-not-adapters` | no module file imports `src/adapters/**` |
| `services-take-ports-not-the-container` | only `routes.ts` / `compose.ts` import `src/platform/container.ts` |
| `application-has-no-direct-io` | no `fs`, `child_process`, `net`, `http(s)` or I/O SDKs in module code outside repositories |
| `domain-files-are-pure` | `domain.ts`, `ports.ts`, `helpers.ts`, `constants.ts` import no outer ring and no sibling `routes` / `service` / `repository` |
| `no-cross-module-imports` | `src/modules/A/**` never imports `src/modules/B/**` (`_shared` excepted) |
| `adapters-do-not-know-modules`, `platform-does-not-know-modules` | infrastructure does not import features (`container.ts` excepted) |
| `shared-contracts-are-self-contained` | the shared contracts package imports nothing from the backend |
| `engine-only-through-its-index` | no deep imports past the engine package's `index.ts` |
| `engine-has-no-io` | the engine imports no I/O builtins, no server code, no persistence or HTTP library |

Two of them as dependency-cruiser entries:

```js
// .dependency-cruiser.cjs (excerpt, illustrative)
forbidden: [
  {
    name: 'only-repositories-touch-the-database',
    comment: 'Drizzle, postgres and src/db/** are infrastructure. Inside a module only repository.ts / repository/** may import them; expose what the use case needs through a port.',
    severity: 'error',
    from: { path: '^src/modules/[^/]+/', pathNot: '/repository(\\.ts$|/)' },
    to: { path: '(^src/db/|node_modules/(drizzle-orm|postgres)/)' },
  },
  {
    name: 'no-cross-module-imports',
    comment: 'A feature must be deletable. Go through a port on the container or src/modules/_shared/.',
    severity: 'error',
    from: { path: '^src/modules/([^/]+)/' },
    to: { path: '^src/modules/', pathNot: ['^src/modules/$1/', '^src/modules/_shared/'] },
  },
],
options: { tsPreCompilationDeps: true, tsConfig: { fileName: 'tsconfig.json' } },
```

`tsPreCompilationDeps: true` makes `import type` count. That is deliberate: a row type in a service signature is a real coupling even though it compiles to nothing.

## Reading a failure

```
error only-repositories-touch-the-database: src/modules/pulls/service.ts → src/db/schema.ts
  Drizzle, postgres and src/db/** … are infrastructure. Inside a module only repository.ts …
```

`from → to` is the offending import; the paragraph under it is the rule's `comment` explaining the move. The fix is always one of: move the code to the ring that is allowed to make that import, or invert the dependency with a port. It is never "add an exception for my file".

## The baseline

When the gate is introduced on an existing codebase, a known-violations file (e.g. `.dependency-cruiser-known-violations.json`) records the violations that already exist. `--ignore-known` downgrades exactly those `rule + from + to` triples, so:

- a **new** wrong-way import fails immediately, even in a file that already has recorded ones;
- removing a violation makes its baseline entry stale but harmless - re-record the baseline in the same change so the file only ever shrinks;
- **never regenerate the baseline to make a new violation pass.** Before committing a regenerated baseline, check `git diff --stat` on it: the change should be deletions only.

Reviewing a baseline change works differently depending on whether the file is tracked yet. Once it is, `git diff` is the check. On the branch that *introduces* the gate the file is untracked, so a diff shows nothing - verify by content instead: count the entries (`jq length`), and make sure no entry names a file the branch itself added or changed.

One gotcha: with pnpm, entries that point at an npm package store the resolved path, version included (`node_modules/.pnpm/drizzle-orm@<version>_…`). Upgrading that package will surface recorded imports of it as "new". That is the moment to either fix them or re-record; do not loosen the rule.

In dependency-cruiser 17 the baseline is written by the `depcruise-baseline` binary; from 18.3 the same thing is `depcruise --baseline`. Update the script when upgrading.

## Adding or changing a rule

1. Add a `forbidden` entry: a `name` that reads as a sentence, a `comment` that says what to do instead, `from` / `to` as **regular expressions** (not globs) over paths relative to the cruise root. `$1` in `to` refers to a capture group in `from`.
2. Run the "all violations" check and read every hit. False positives mean the pattern is wrong - fix the pattern rather than baselining noise.
3. Prove the rule bites: add a throwaway file with the forbidden import, watch the check fail, delete it.
4. Re-record the baseline if the rule legitimately captures existing debt, and document that debt where the project keeps its known deviations.

Rules encode decisions the team made; changing one is an architectural decision and needs the user's agreement, not a drive-by edit.

## What the gate cannot see

It sees imports, not behaviour. Review still has to catch:

- a service that reaches the database *through* `deps` typed as `Db`;
- `new SomeAdapter()` on a class obtained without a static import, or `process.env` reads;
- business logic in a handler that needs no forbidden import;
- a port shaped like the library behind it;
- a row travelling outwards under a structurally identical hand-written type.

The review checklist in `SKILL.md` covers these.

## dependency-cruiser or ESLint

dependency-cruiser resolves tsconfig `paths`, supports `allowed`/`forbidden` rules with capture groups (needed for "no cross-module imports"), and has a first-class baseline for adopting rules on a codebase with existing debt - a good fit when the project has no ESLint setup. If the project already lints with ESLint, `eslint-plugin-boundaries` (or `no-restricted-imports` for simple cases) gives the same rules with in-editor feedback, and can run alongside dependency-cruiser.

Do not confuse the gate with any runtime use of dependency-cruiser as a library inside the product; the gate is the repository's own lint.
