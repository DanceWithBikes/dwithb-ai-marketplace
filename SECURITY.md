# Security Policy

Plugins in this marketplace can run hooks, shell commands and MCP servers on
the machines of the people who install them. We treat that seriously.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's private reporting: **Security → Report a vulnerability** on this
repository. Include the affected plugin and version, what an attacker can do,
and steps to reproduce.

We aim to acknowledge reports within 5 working days and to share a plan or fix
timeline after triage. These are targets, not guarantees. Credit is given in
the CHANGELOG unless you prefer otherwise.

## What counts

- A plugin that executes unexpected code, exfiltrates data, or contacts
  undeclared hosts
- Hooks or MCP servers whose behavior differs from what the plugin README declares
- Committed secrets or tokens
- Vulnerabilities in the catalog website or its build scripts (XSS, unsafe
  markdown rendering, unsafe generated install scripts)

## Rules for plugin authors

- Declare every hook, MCP server, network destination and file write outside
  the project in the plugin README ([guidelines](docs/PLUGIN-GUIDELINES.md#4-hooks-mcp-servers-and-commands-declare-everything)).
- No downloading and executing code at runtime; no obfuscated or minified
  code without its source in the repository.
- No collection of user data without explicit disclosure in the README.
- Pin dependencies and avoid unnecessary ones.
- Never commit secrets; use environment variables and document them.

Plugins that break these rules are removed from the marketplace.

## What the catalog does and does not tell you

The website shows what a plugin **declares** (hooks, MCP servers, flags such as
"runs commands"). This is derived from files in the repository. It is **not**
a security audit or a guarantee of safety. Read a plugin's source and README
before installing it, as with any code you run locally.

## Supported versions

Only the latest version of each plugin in `main` is supported.

## Maintainer setup note

Enable **Settings → Code security → Private vulnerability reporting** on the
repository so the reporting link above works.
