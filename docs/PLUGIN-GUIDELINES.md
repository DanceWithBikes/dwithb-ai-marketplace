# Plugin Guidelines

Rules for adding or changing a plugin in this marketplace. The short checklist
is in the [README](../README.md#contributing-a-plugin); this document is the
detail. The catalog website ([spec](specs/ui-catalog.md)) is built from the
files described here, so following these rules is what makes a plugin
findable.

## 1. Layout

```
plugins/<name>/
  .claude-plugin/plugin.json
  README.md
  skills/<skill>/SKILL.md
  agents/<agent>.md
  hooks/hooks.json
  .mcp.json
  scripts/                # helper scripts, referenced via ${CLAUDE_PLUGIN_ROOT}
```

- Only the pieces you need; all components live at the plugin root, not inside
  `.claude-plugin/`.
- `<name>` is lowercase kebab-case, permanent, and identical in the directory
  name, `plugin.json`, and the entry in `.claude-plugin/marketplace.json`.
- Use `${CLAUDE_PLUGIN_ROOT}` for bundled files. No absolute or user-specific paths.
- Scripts go in `scripts/`, not a top-level `bin/`. No Git LFS.

## 2. Metadata required for the catalog

The catalog indexer fails the build on missing required fields.

**`plugin.json`**

| Field | Required | Notes |
|---|---|---|
| `name` | yes | must equal directory and marketplace entry |
| `description` | yes | one or two sentences: what it does and for whom |
| `version` | see §5 | set here or nowhere; never in both places |
| `author` | recommended | name, optionally url |
| `keywords` | recommended | 3–8 lowercase terms people would search for |

**`SKILL.md` / agent frontmatter**

| Field | Required | Notes |
|---|---|---|
| `name` | yes | kebab-case, unique within the plugin |
| `description` | yes | see §3 |

## 3. Writing descriptions that can be found

Search is keyword-based over name, description, keywords and body. Write for
the words a user would type ("review a pull request", "generate changelog").

- Start with what it does, then **when to use it**: "Use when …".
- Name the concrete task, input and output; avoid vague words ("helpful", "powerful").
- Mention synonyms people use for the same thing once, naturally.
- Keep it under ~300 characters; details belong in the body.
- English is the baseline. Ukrainian text is allowed in addition, not instead.

Good: `Reviews a pull request diff for bugs and missing tests. Use when the user asks to review, check, or audit a PR.`
Bad: `A helpful tool for code.`

## 4. Hooks, MCP servers and commands (declare everything)

The catalog shows a plugin's *declared* hooks and MCP servers on its page.

- Every hook and MCP server must be in the plugin's files, never fetched or
  created at runtime.
- Document in the plugin README, per hook: event, what it runs, why.
  Per MCP server: transport, command or URL, what data it can access.
- Network access, file writes outside the project, and shell execution must
  be stated in the README. See [SECURITY.md](../SECURITY.md) for what is not allowed.

## 5. Versioning and changes

- Either set `version` in `plugin.json` and bump it on **every** release, or
  omit it everywhere. Never set it in both `plugin.json` and the marketplace entry.
- Use semantic versioning: breaking change = major, new capability = minor, fix = patch.
- Every user-visible change gets a line in the root [CHANGELOG](../CHANGELOG.md).
- Plugin names are permanent. Renaming means a new plugin and deprecating the old one.

## 6. Plugin README

Each plugin has a `README.md` with: purpose, what is included (skills, agents,
hooks, MCP), example prompts, requirements (tools, env vars, accounts),
declared permissions/network use (§4), and known limitations.

## 7. Before opening a PR

1. `claude plugin validate --strict .` passes.
2. `claude plugin marketplace add .` works locally and the plugin installs.
3. Descriptions follow §3; `keywords` set; plugin README present.
4. Marketplace entry added; CHANGELOG updated.
5. No secrets, tokens, personal paths, or unexplained binaries committed.
