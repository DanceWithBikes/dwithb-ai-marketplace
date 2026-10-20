#!/usr/bin/env node
// Builds site/public/catalog.json from the marketplace on disk (docs/specs/ui-catalog.md §4).
// No dependencies. Fails loudly on a missing manifest field or broken frontmatter.
//
//   node scripts/build-catalog.mjs [--out site/public/catalog.json]

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.indexOf("--out");
const OUT = resolve(ROOT, outArg > -1 ? process.argv[outArg + 1] : "site/public/catalog.json");
const BODY_LIMIT = 5000;

// Extra search terms per skill, so "frontend" or "database" finds the right skill.
const DERIVED = {
  "react-best-practices": ["react", "frontend", "hooks"],
  "react-testing-library": ["react", "testing", "frontend"],
  "frontend-ui-architecture": ["frontend", "architecture", "react", "nextjs"],
  "backend-onion-architecture": ["backend", "architecture"],
  "fastify-best-practices": ["backend", "fastify", "api"],
  "drizzle-orm-patterns": ["backend", "database", "orm"],
  "postgresql-table-design": ["backend", "database", "postgresql"],
  "zod": ["validation", "typescript"],
  "typescript-expert": ["typescript"],
  "security": ["security", "review"],
  "spec-creator": ["spec", "planning"],
  "implementation-planner": ["planning", "spec"],
  "implementer": ["implementation"],
  "plan-verifier": ["review", "verification"],
  "architecture-reviewer": ["review", "architecture"],
  "researcher": ["research"],
  "workflow-retro": ["retro", "metrics"],
};

const errors = [];
const fail = (file, msg) => errors.push(`${relative(ROOT, file)}: ${msg}`);
const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    fail(file, `invalid JSON (${e.message})`);
    return null;
  }
};

// Top-level `key: value` pairs and simple `key:` + `  - item` lists. Enough for our
// frontmatter; nested maps (metadata) are skipped.
function frontmatter(file) {
  const text = readFileSync(file, "utf8");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) {
    fail(file, "missing YAML frontmatter");
    return { data: {}, body: text };
  }
  const data = {};
  let listKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) {
      data[listKey].push(unquote(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    listKey = null;
    const [, key, raw] = kv;
    if (raw === "") {
      data[key] = [];
      listKey = key;
    } else if (/^[>|]/.test(raw)) {
      fail(file, `frontmatter "${key}" uses a block scalar; use a single-line value`);
    } else {
      data[key] = unquote(raw);
    }
  }
  return { data, body: m[2] };
}

function unquote(v) {
  v = v.trim();
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

function plainText(md) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, BODY_LIMIT);
}

// Derived terms + name words + only those plugin keywords the artifact itself mentions,
// so a plugin-wide keyword ("retro") does not tag every agent in the plugin.
function tagsFor(name, keywords, text = "") {
  const words = name.split("-").filter((w) => w.length > 2 && !["best", "practices", "patterns", "expert", "creator"].includes(w));
  const hay = `${name} ${text}`.toLowerCase();
  const relevant = keywords.filter((k) => hay.includes(k));
  return [...new Set([...(DERIVED[name] ?? []), ...relevant, ...words].map((t) => t.toLowerCase()))].sort();
}

// "## [1.0.0] - 2026-10-20" + "### Added" + "- item" → [{ version, date, sections: [{ title, items }] }]
function releases(file) {
  if (!existsSync(file)) return [];
  const out = [];
  let rel = null, sec = null;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const h2 = line.match(/^##\s+\[?([^\]\s]+)\]?(?:\s+-\s+(\S+))?/);
    if (h2) { rel = { version: h2[1], date: h2[2] ?? null, sections: [] }; out.push(rel); sec = null; continue; }
    const h3 = line.match(/^###\s+(.+)/);
    if (h3 && rel) { sec = { title: h3[1].trim(), items: [] }; rel.sections.push(sec); continue; }
    const li = line.match(/^\s*[-*]\s+(.+)/);
    if (li && rel) {
      if (!sec) { sec = { title: "", items: [] }; rel.sections.push(sec); }
      sec.items.push(li[1].trim());
    }
  }
  return out;
}

const tags = (() => {
  try {
    return new Set(execFileSync("git", ["tag", "-l"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean));
  } catch {
    return new Set();
  }
})();

function lastCommit(path) {
  try {
    return execFileSync("git", ["log", "-1", "--format=%cs", "--", path], { cwd: ROOT, encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

function requireFields(file, data, fields) {
  for (const f of fields) if (typeof data?.[f] !== "string" || !data[f].trim()) fail(file, `missing required field "${f}"`);
}

const mpFile = join(ROOT, ".claude-plugin/marketplace.json");
const mp = readJson(mpFile) ?? { plugins: [] };
requireFields(mpFile, mp, ["name"]);
const repo = (() => {
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], { cwd: ROOT, encoding: "utf8" }).trim();
    return url.match(/github\.com[:/](.+?)(?:\.git)?$/)?.[1] ?? "DanceWithBikes/dwithb-ai-marketplace";
  } catch {
    return "DanceWithBikes/dwithb-ai-marketplace";
  }
})();

const plugins = [];
const artifacts = [];

for (const entry of mp.plugins ?? []) {
  const dir = resolve(ROOT, entry.source);
  const manifestFile = join(dir, ".claude-plugin/plugin.json");
  const manifest = existsSync(manifestFile) ? readJson(manifestFile) : null;
  if (!manifest) {
    fail(manifestFile, "missing plugin.json");
    continue;
  }
  requireFields(manifestFile, manifest, ["name", "description"]);
  if (manifest.name !== entry.name) fail(manifestFile, `name "${manifest.name}" differs from marketplace entry "${entry.name}"`);
  const id = manifest.name;
  const keywords = (manifest.keywords ?? []).map((k) => k.toLowerCase());
  const pluginPath = relative(ROOT, dir);
  const found = { skill: [], agent: [], hook: [], mcp: [] };

  const skillsDir = join(dir, "skills");
  for (const name of existsSync(skillsDir) ? readdirSync(skillsDir).sort() : []) {
    const file = join(skillsDir, name, "SKILL.md");
    if (!existsSync(file)) continue;
    const { data, body } = frontmatter(file);
    requireFields(file, data, ["name", "description"]);
    found.skill.push({ name: data.name ?? name, description: data.description ?? "", file, body, scripts: existsSync(join(skillsDir, name, "scripts")), meta: { allowedTools: data["allowed-tools"] || undefined, bundledScripts: existsSync(join(skillsDir, name, "scripts")) || undefined } });
  }

  const agentsDir = join(dir, "agents");
  for (const f of existsSync(agentsDir) ? readdirSync(agentsDir).filter((f) => f.endsWith(".md")).sort() : []) {
    const file = join(agentsDir, f);
    const { data, body } = frontmatter(file);
    requireFields(file, data, ["name", "description"]);
    const tools = String(data.tools ?? "").split(",").map((t) => t.trim()).filter(Boolean);
    found.agent.push({ name: data.name ?? f.replace(/\.md$/, ""), description: data.description ?? "", file, body, tools, meta: { model: data.model || undefined, tools, disallowedTools: data.disallowedTools ? String(data.disallowedTools).split(",").map((t) => t.trim()) : undefined, skills: Array.isArray(data.skills) && data.skills.length ? data.skills : undefined } });
  }

  const hooksFile = join(dir, "hooks/hooks.json");
  const hookSummaries = [];
  if (existsSync(hooksFile)) {
    const hooks = readJson(hooksFile)?.hooks ?? {};
    for (const [event, groups] of Object.entries(hooks)) {
      for (const g of groups) {
        for (const h of g.hooks ?? []) {
          const script = String(h.command ?? "").match(/([\w.-]+\.(?:mjs|js|sh|py))/)?.[1] ?? h.type;
          const summary = `${event}${g.matcher ? ` on ${g.matcher}` : ""}: ${script}`;
          hookSummaries.push({ event, summary });
          found.hook.push({ name: script.replace(/\.\w+$/, ""), description: `${event} hook${g.matcher ? ` on ${g.matcher.split("|").join(", ")}` : ""} that runs ${script}.`, file: hooksFile, body: "", meta: { event, matcher: g.matcher || undefined } });
        }
      }
    }
  }

  const mcpFile = join(dir, ".mcp.json");
  const mcpServers = [];
  if (existsSync(mcpFile)) {
    for (const [name, cfg] of Object.entries(readJson(mcpFile)?.mcpServers ?? {})) {
      const transport = cfg.url ? cfg.type ?? "http" : "stdio";
      mcpServers.push({ name, transport });
      found.mcp.push({ name, description: `MCP server (${transport}).`, file: mcpFile, body: "", meta: { transport } });
    }
  }

  const usesNetwork = mcpServers.some((s) => s.transport !== "stdio") || found.agent.some((a) => a.tools.some((t) => /^Web(Search|Fetch)$/.test(t)));
  const runsCommands = found.hook.length > 0 || found.mcp.length > 0 || found.skill.some((s) => s.scripts) || found.agent.some((a) => a.tools.includes("Bash"));

  plugins.push({
    id,
    name: manifest.displayName ?? id,
    description: manifest.description ?? "",
    version: manifest.version ?? "unversioned",
    author: manifest.author?.name ?? mp.owner?.name ?? "",
    keywords,
    dependencies: (manifest.dependencies ?? []).map((d) => (typeof d === "string" ? d : `${d.name}${d.version ? ` ${d.version}` : ""}`)),
    updatedAt: lastCommit(pluginPath) ?? new Date().toISOString().slice(0, 10),
    counts: { skills: found.skill.length, agents: found.agent.length, hooks: found.hook.length, mcp: found.mcp.length },
    install: {
      marketplaceAdd: `claude plugin marketplace add ${repo}`,
      install: `claude plugin install ${id}@${mp.name}`,
    },
    trust: { hooks: hookSummaries, mcpServers, runsCommands, usesNetwork },
    path: pluginPath,
    tag: tags.has(`${id}--v${manifest.version}`) ? `${id}--v${manifest.version}` : null,
    releases: releases(join(dir, "CHANGELOG.md")),
  });

  artifacts.push({
    id: `${id}/plugin/${id}`,
    type: "plugin",
    plugin: id,
    name: id,
    description: manifest.description ?? "",
    tags: [...new Set([...keywords, ...Object.entries(found).filter(([, l]) => l.length).map(([t]) => `${t}s`)])].sort(),
    path: relative(ROOT, manifestFile),
    meta: {},
    body: plainText(existsSync(join(dir, "README.md")) ? readFileSync(join(dir, "README.md"), "utf8") : ""),
  });

  for (const [type, list] of Object.entries(found)) {
    for (const a of list) {
      artifacts.push({
        id: `${id}/${type}/${a.name}`,
        type,
        plugin: id,
        name: a.name,
        description: a.description,
        tags: tagsFor(a.name, keywords, a.description),
        path: relative(ROOT, a.file),
        meta: a.meta ?? {},
        body: plainText(a.body),
      });
    }
  }
}

if (errors.length) {
  console.error(`build-catalog: ${errors.length} problem(s):\n  ${errors.join("\n  ")}`);
  process.exit(1);
}

const catalog = {
  schemaVersion: 1,
  // Latest plugin change, not wall-clock time, so unchanged input gives identical output.
  generatedAt: plugins.map((p) => p.updatedAt).sort().at(-1) ?? null,
  marketplace: { name: mp.name, repo, description: mp.description ?? "" },
  plugins,
  artifacts,
};
writeFileSync(OUT, JSON.stringify(catalog, null, 2) + "\n");
console.log(`build-catalog: ${plugins.length} plugins, ${artifacts.length} artifacts → ${relative(ROOT, OUT)}`);
