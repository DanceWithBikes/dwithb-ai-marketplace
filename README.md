# DWithB AI Marketplace

A Claude Code plugin marketplace by DWithB.

## Install

Add the marketplace once, then install plugins by name:

```bash
claude plugin marketplace add DanceWithBikes/dwithb-ai-marketplace
claude plugin install <plugin>@dwithb-ai-marketplace
```

Or from inside a Claude Code session: `/plugin marketplace add DanceWithBikes/dwithb-ai-marketplace`.
Restart Claude Code after installing so the plugin loads.

### Updates

Auto-update is off by default. To enable it: `/plugin` → **Marketplaces** → `dwithb-ai-marketplace` → **Enable auto-update**.
Or update manually: `claude plugin update <plugin>@dwithb-ai-marketplace`.

Private repository? Claude Code uses your own git credentials. Without a GitHub SSH key, set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`.

## Plugins

| Plugin | What it gives you | Depends on |
|---|---|---|
| [`sdd-engineering`](plugins/sdd-engineering/README.md) | Spec-Driven Development pipeline: `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier` agents and the `workflow-retro` skill | all three below |
| [`engineering-paved-path`](plugins/engineering-paved-path/README.md) | React, Fastify, architecture, testing, security, Zod, Drizzle and PostgreSQL skills | — |
| [`research-tools`](plugins/research-tools/README.md) | Read-only `researcher` agent | — |
| [`architecture-review`](plugins/architecture-review/README.md) | Read-only `architecture-reviewer` agent | `engineering-paved-path` |

Installing a plugin installs its dependencies automatically. For the full SDD set:

```bash
claude plugin install sdd-engineering@dwithb-ai-marketplace
```

```
engineering-paved-path ◀── architecture-review ◀──┐
        ▲                                         │
        └──────────────────────────────── sdd-engineering
research-tools ◀──────────────────────────────────┘
```

## Contributing a plugin

1. Create `plugins/<name>/` with `.claude-plugin/plugin.json` and components (`skills/<skill>/SKILL.md`, `agents/`, `hooks/hooks.json`, `.mcp.json`) at the plugin root.
2. Add an entry to `.claude-plugin/marketplace.json`:
   `{ "name": "<name>", "source": "./plugins/<name>", "description": "..." }`.
   The entry `name` must equal the `name` in `plugin.json`, and plugin names are permanent.
3. Versioning: either bump `version` in `plugin.json` on every release, or omit it everywhere. Never set it in both `plugin.json` and the marketplace entry.
4. Reference bundled files with `${CLAUDE_PLUGIN_ROOT}`; keep scripts in `scripts/` (not a top-level `bin/`); don't use Git LFS.
5. Run `claude plugin validate --strict .` and test with `claude plugin marketplace add .`.
6. Add a README to the plugin and a CHANGELOG entry.

Details: [Plugin Guidelines](docs/PLUGIN-GUIDELINES.md) · Security: [SECURITY.md](SECURITY.md)
