# Spec: Marketplace UI Catalog (GitHub Pages)

Status: Draft v2 · Scope: MVP + Phase 2 (incl. basket, compare, wizard) · Date: 2026-10-20

## 1. Goal

A static website on GitHub Pages that lets people discover everything in this
marketplace — plugins, skills, agents, hooks, MCP servers — by free-text search,
see each artifact as a card, and copy the commands to install it.

Non-goals: user accounts, ratings/comments, analytics/tracking, server-side
anything, hosting plugin code (plugins are still installed through
`claude plugin ...` from the repo).

## 2. Decisions

| Topic | Decision |
|---|---|
| Hosting | GitHub Pages, public repo, deployed by GitHub Actions |
| Framework | Astro (static output) + Preact island for search/interactive UI |
| Search | Client-side, MiniSearch over a prebuilt `catalog.json` |
| UI language | English default, switchable to Ukrainian; choice persisted |
| State | URL query string + `localStorage` only |
| Analytics | None (explicitly out of scope for now; no third-party scripts) |
| Site URL | Not fixed yet; `site` and `base` come from config/env, never hardcoded |
| Release scope | MVP + Phase 2, including basket, compare and task wizard (see §9) |

## 3. Architecture

```
plugins/**, .claude-plugin/marketplace.json, CHANGELOG.md
        │  (build-time)
        ▼
  indexer script (Node, scripts/build-catalog.mjs)
        │  writes
        ▼
  site/public/catalog.json   ← also published as a static API
        │
        ▼
  Astro build → static HTML per artifact page + Preact search island
        │
        ▼
  GitHub Pages
```

Proposed layout (new, outside `plugins/`):

```
site/                 Astro project
  src/pages/          index, plugins/[name], skills/[plugin]/[skill], agents/..., changelog
  src/components/     SearchBox, ResultCard, Filters, InstallCommand, LangSwitch, ThemeSwitch,
                      Basket, CompareTray, CompareTable, Wizard
  src/i18n/           en.json, uk.json
  public/             catalog.json (generated), favicon, og defaults
scripts/
  build-catalog.mjs   indexer
  catalog.schema.json JSON Schema for catalog.json
  synonyms.json       search synonym map (EN + UK)
docs/specs/           specs (this file)
```

`site/` and `scripts/` must not be treated as plugins; `plugins/` stays the only
plugin root and `claude plugin validate` is unaffected.

## 4. Catalog indexer

Input (all optional except marketplace.json):

- `.claude-plugin/marketplace.json` → marketplace metadata, plugin list
- `plugins/<name>/.claude-plugin/plugin.json` → name, description, version, author, keywords
- `plugins/<name>/skills/<skill>/SKILL.md` → frontmatter (`name`, `description`) + body
- `plugins/<name>/agents/*.md` → frontmatter + body
- `plugins/<name>/hooks/hooks.json` → events, matchers, command summaries
- `plugins/<name>/.mcp.json` → server names, transport, command/url
- `plugins/<name>/README.md`, root `CHANGELOG.md`
- Git metadata (last commit date per plugin); optional GitHub API (stars) with
  `GITHUB_TOKEN` in CI only

Output `catalog.json` (validated against `scripts/catalog.schema.json`):

```jsonc
{
  "generatedAt": "ISO-8601",
  "marketplace": { "name": "...", "repo": "owner/repo", "description": "..." },
  "plugins": [{
    "id": "plugin-name", "name": "...", "description": "...", "version": "1.0.0",
    "keywords": [], "author": "...", "updatedAt": "ISO-8601",
    "install": { "marketplaceAdd": "claude plugin marketplace add owner/repo",
                 "install": "claude plugin install plugin-name@dwithb-ai-marketplace" },
    "trust": { "hooks": [{"event":"PreToolUse","summary":"..."}],
               "mcpServers": [{"name":"...","transport":"stdio|http"}],
               "runsCommands": true, "usesNetwork": false }
  }],
  "artifacts": [{
    "id": "plugin/skill/foo", "type": "skill|agent|hook|mcp|plugin",
    "plugin": "plugin-name", "name": "...", "description": "...",
    "tags": [], "path": "plugins/...", "body": "plain text for indexing",
    "url": "/skills/plugin-name/foo/"
  }]
}
```

Metadata requirements for plugin authors (required fields, description style,
keywords, declared hooks/MCP) are defined in
[PLUGIN-GUIDELINES.md](../PLUGIN-GUIDELINES.md); the indexer enforces its
"required" fields. The trust panel's wording follows [SECURITY.md](../../SECURITY.md).

Rules:

- Malformed frontmatter or missing required field (`name`, `description`) fails
  the build with a clear file path and message — no silent skips.
- `body` is stripped of markdown/code fences and truncated (e.g. 5 000 chars)
  to keep the index small.
- Tags = plugin keywords + frontmatter tags + derived terms; deterministic order
  so output is stable between runs.
- Empty marketplace (`plugins: []`) must produce a valid empty catalog and a
  site that shows an empty state, not a build failure.

## 5. Search

- Library: MiniSearch, index built in the browser from `catalog.json` on first
  load (or prebuilt and serialized at build time if load time > 150 ms on the
  reference set — decide during implementation).
- Fields and boosts: `name` ×5, `description` ×3, `tags` ×3, `plugin` ×2, `body` ×1.
- Query processing: lowercase, strip punctuation, drop stop words (EN + UK),
  light stemming for EN and UK, synonym expansion from `synonyms.json`,
  fuzzy (edit distance ≤ 1–2 by term length), prefix match on the last token.
- Natural-language input like "I need a skill for reviewing pull requests" must
  work through stop-word removal; no LLM or network involved.
- Results are updated as the user types (debounced ~100 ms).
- Match highlighting in name/description.
- Empty result: message, suggestions (popular tags, "clear filters"), link to
  "Suggest an artifact" (§7.9).

## 6. MVP features

1. **Home/search page**: search box, result grid of cards, result count.
2. **Cards**: type badge, name, description (clamped), owning plugin, tags,
   "Copy install" button, link to detail page.
3. **Filters**: type, plugin, tag, "has hooks", "has MCP". Sort: relevance,
   recently updated, name A–Z.
4. **URL state**: `?q=&type=&plugin=&tag=&sort=` — shareable, back/forward works.
5. **Copy install**: one click copies the two-command snippet; success feedback;
   fallback when Clipboard API is unavailable.
6. **Keyboard**: `/` focuses search, `Esc` clears/blur, arrows move between
   results, `Enter` opens.
7. **States**: loading skeleton, empty catalog, no results, catalog load error
   with retry.
8. **i18n**: EN default, UK available; `LangSwitch` in header; persisted in
   `localStorage`; falls back to EN for missing keys. Artifact content
   (SKILL.md etc.) is shown as authored and is not translated.
9. **Configurable URL**: Astro `site` and `base` read from env (`SITE_URL`,
   `BASE_PATH`); in CI they are derived from `actions/configure-pages` output,
   locally default to `http://localhost:4321/`. Switching to a custom domain
   later must need only a config change.
10. **Deploy**: GitHub Actions builds the catalog and site and publishes to Pages.

## 7. Phase 2 features

1. **Artifact pages**: static page per plugin/skill/agent with rendered
   markdown, file list with links to GitHub source, install snippet, related
   artifacts (same plugin / shared tags). Unique `<title>`, description, and
   Open Graph tags per page (generated OG image optional).
2. **Trust panel** on plugin pages: hooks (event + command summary), MCP
   servers (transport, command/URL), flags "runs commands" / "uses network",
   and the validation status of the last CI run. Derived only from files in the
   repo; wording must say "declared", not "verified safe".
3. **What's new**: `/changelog` page rendered from `CHANGELOG.md` plus Atom feed
   `/feed.xml`.
4. **Favorites & recently viewed**: `localStorage`, shown on home page; export
   and clear controls.
5. **Theme**: light/dark/system, persisted, no flash on load.
6. **404 page** with search box.
7. **Last-updated and stars** (from build-time Git/GitHub data) on cards and pages.
8. **Static API**: `/catalog.json` documented in the README (stable schema,
   `schemaVersion` field, additive changes only within a major version).
9. **Feedback links**: "Suggest an artifact" and "Report a problem" open a
   prefilled GitHub issue (new `.github/ISSUE_TEMPLATE/*`).

10. **Install basket**: "Add to basket" on plugin cards/pages (skills and
    agents add their owning plugin). Basket drawer lists plugins, allows
    remove/clear, and generates one install script (`marketplace add` once +
    one `plugin install` per plugin) with copy and download-as-`.sh` buttons.
    Persisted in `localStorage`; shareable via URL (`?basket=a,b,c`) that
    pre-fills the basket on open. Unknown plugin ids in the URL are ignored
    with a notice.
11. **Compare**: select 2–3 plugins (checkbox on card → `CompareTray`) →
    `/compare?ids=a,b` table: description, version, contents counts
    (skills/agents/hooks/MCP), trust flags, keywords, last updated, install
    command. Differences highlighted. Fewer than 2 or more than 3 ids shows
    guidance instead of a table. Mobile: horizontally scrollable table with
    sticky first column.
12. **Task wizard** ("Help me choose"): 3–5 questions rendered from a static
    `wizard.json` (e.g. goal category, artifact type, "okay with hooks/MCP?").
    Each answer adds weighted tags/filters; the result is a ranked list
    produced by the same search engine plus tag boosts, with a "why this
    matched" line per card. Answers are encoded in the URL for sharing; skip
    and back are always available; results link into the main search with
    filters pre-applied. `wizard.json` is validated at build time against the
    tags that exist in the catalog (unknown tag = build warning).

## 8. Non-functional requirements

- **Performance**: Lighthouse performance ≥ 90 and accessibility ≥ 95 on the
  home page (mobile profile); initial JS ≤ 60 KB gzipped excluding the catalog;
  search result update < 50 ms for ≤ 500 artifacts.
- **Accessibility**: WCAG 2.1 AA, full keyboard operation, visible focus,
  labelled controls, live region announcing result count, contrast checked in
  both themes.
- **SEO/sharing**: pre-rendered HTML for every artifact page, sitemap, canonical
  URLs, OG tags.
- **Browsers**: last 2 versions of Chrome, Firefox, Safari, Edge; no IE.
- **Privacy**: no analytics, no cookies, no third-party requests; search text
  never leaves the browser. Only `localStorage` for language, theme, favorites,
  recents and basket.
- **Base path**: site is served from `/<repo>/`; Astro `base` and all links must
  respect it (no hardcoded absolute `/` paths).
- **Security**: markdown rendered with HTML sanitization; external links
  `rel="noopener noreferrer"`; no secrets in client bundle (GitHub token used
  only in CI at build time).

## 9. Delivery plan

**MVP**
1. Fixture plugins under `scripts/fixtures/` (skills, agent, hooks, MCP, one
   malformed case) for indexer tests — kept out of `plugins/`.
2. Indexer + schema + unit tests.
3. Astro skeleton, i18n, theme-agnostic layout, base-path handling.
4. Search island, cards, filters, URL state, keyboard, states.
5. Copy install, configurable `site`/`base`.
6. CI: extend `.github/workflows/validate.yml` flow — keep the existing
   `claude plugin validate` job; add `build-site` job (catalog + Astro build +
   tests) and a `deploy` job on `main` that needs both; use
   `actions/configure-pages`, `upload-pages-artifact`, `deploy-pages`.
7. Repo setting: Pages source = "GitHub Actions".

**Phase 2**: items in §7. Order: artifact pages (1) → trust panel (2) →
theme (5) → favorites/recents (4) → basket (10) → compare (11) → wizard (12)
→ changelog/feed (3) → remaining (6–9). Artifact pages come first because
basket, compare and the trust panel hook into them.

## 10. Testing & verification

- **Indexer**: unit tests on fixtures (frontmatter parsing, trust extraction,
  deterministic output, failure messages); output validated by JSON Schema.
- **Search**: table-driven tests of queries → expected top results
  (EN and UK phrasing, typos, synonyms, stop-word-heavy sentences).
- **E2E (Playwright)**: search → cards → filter → URL restore → copy install →
  language switch → keyboard flow; basket (add, share URL, generated script
  content); compare (2 and 3 plugins, invalid ids); wizard (full path, skip,
  URL restore); run against `astro preview` with a non-root base path.
- **Wizard**: unit tests that each question set resolves to non-empty results
  on fixtures and that unknown tags in `wizard.json` are reported.
- **Quality gates in CI**: build, tests, Lighthouse CI thresholds from §8,
  link check on built output.
- **Manual**: deploy from a branch to Pages (or preview artifact), check on
  mobile viewport and with an empty catalog.

## 11. Risks & open items

- **Empty marketplace today**: until real plugins exist, fixtures drive
  development; the live site will show the empty state.
- **Ukrainian stemming quality** in a browser-only setup is limited; fall back
  to prefix + fuzzy matching and keep the synonym map as the main lever.
- **Index size** grows with `body`; revisit truncation or prebuilt index if the
  catalog exceeds ~1 MB.
- **Trust panel wording** must not imply a security audit.
- **Existing workflow note**: `validate.yml` switches to `--strict` once the
  first plugin is added; site CI must not depend on that change.
- Open: exact Pages URL (or custom domain) is unknown; handled by env-driven
  config (§6.9), so it blocks nothing.
- **Generated install script** (basket) runs shell commands on the user's
  machine: keep it to plain `claude plugin ...` lines, show it before download,
  never embed anything beyond ids from the catalog.
- **Wizard quality** depends on good tags; with few plugins results will be
  thin — the design should degrade to "no strong match, try search".
- Open: whether `site/` should be its own npm workspace or a plain subfolder
  with its own `package.json` (default: plain subfolder).
