// PreToolUse hook for the sdd-engineering plugin, declared in hooks/hooks.json for
// Write|Edit|MultiEdit|NotebookEdit. A plugin hook fires for every write in the session,
// so the first thing it does is check who is writing: unless the active agent is
// spec-creator (`agent_type` equal to `spec-creator` or ending in `:spec-creator`), it
// exits 0 with no output and the write proceeds untouched.
//
// For spec-creator it keeps every write inside an existing specs directory and inside a
// spec that is still a draft. The specs directory comes from the plugin's userConfig
// (`specs_dir`, exported as CLAUDE_PLUGIN_OPTION_SPECS_DIR), default `docs/specs`:
//   - the target is `<any>/<specs_dir>/<kebab-name>.md`, never README.md, never under
//     node_modules/ or .git/, and its directory already exists;
//   - an existing spec that is not a draft (approved, implemented, legacy) may be
//     changed with Edit only — a whole-file Write over it is denied;
//   - after every write the file carries a `Spec ID: SPEC-NN` line and exactly
//     `Status: draft` — a changed spec goes back to draft for re-approval, and
//     promoting it to approved/implemented is a human decision.
// Anything it cannot verify for spec-creator is denied (fail closed).
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";

const FORBIDDEN_PREFIXES = ["node_modules/", ".git/"];
const DRAFT = /^Status: draft[ \t]*$/m;
const NON_DRAFT = /^Status: (?!draft[ \t]*$).*$/m;
const SPEC_ID = /^Spec ID: SPEC-\d{2,}[ \t]*$/m;

const isSpecCreator = (agentType) =>
  typeof agentType === "string" && (agentType === "spec-creator" || agentType.endsWith(":spec-creator"));

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `spec-creator write guard: ${reason}`,
      },
    }),
  );
}

// "./docs/specs/" -> "docs/specs"; null when the value could escape the project.
function normalizeSpecsDir(value) {
  const dir = String(value ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+$/, "");
  if (!dir || isAbsolute(dir) || dir.split("/").some((part) => part === ".." || part === "")) return null;
  return dir;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function applyEdits(current, edits) {
  let next = current;
  for (const { old_string: oldStr = "", new_string: newStr = "", replace_all: all } of edits) {
    if (!next.includes(oldStr)) return null;
    next = all ? next.split(oldStr).join(newStr) : next.replace(oldStr, () => newStr);
  }
  return next;
}

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(raw || "{}");
  } catch {
    // Without readable input we cannot tell who is writing; this hook only guards
    // spec-creator, so it must not block the rest of the session.
    return;
  }
  if (!isSpecCreator(input.agent_type)) return;

  const tool = input.tool_name ?? "";
  if (!/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(tool)) return;
  if (tool === "NotebookEdit") return deny("notebooks are not specs.");

  const specsDir = normalizeSpecsDir(process.env.CLAUDE_PLUGIN_OPTION_SPECS_DIR || "docs/specs");
  if (!specsDir)
    return deny(`the configured specs_dir "${process.env.CLAUDE_PLUGIN_OPTION_SPECS_DIR}" is not a relative path inside the project.`);
  const specPath = new RegExp(`^(?:[A-Za-z0-9._@-]+/)*${escapeRe(specsDir)}/[a-z0-9][a-z0-9-]*\\.md$`);

  const ti = input.tool_input ?? {};
  const filePath = ti.file_path;
  if (typeof filePath !== "string" || !filePath) return deny("no file_path.");

  let root;
  try {
    root = realpathSync(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  } catch {
    return deny("cannot resolve the project root.");
  }
  const abs = isAbsolute(filePath) ? filePath : resolve(input.cwd || root, filePath);
  let dir;
  try {
    dir = realpathSync(dirname(abs));
  } catch {
    // A fresh project has no specs directory yet: the first spec may create the
    // root-level one (Write creates parent dirs). Module-level dirs must exist.
    let base = dirname(abs);
    while (!existsSync(base) && dirname(base) !== base) base = dirname(base);
    const fresh = relative(root, resolve(realpathSync(base), relative(base, abs))).split(sep).join("/");
    if (!new RegExp(`^${escapeRe(specsDir)}/[a-z0-9][a-z0-9-]*\\.md$`).test(fresh))
      return deny(`${dirname(abs)} does not exist — specs go into ${specsDir}/ at the project root or an existing <module>/${specsDir}/ directory only.`);
    dir = resolve(root, dirname(fresh));
  }
  const rel = relative(root, resolve(dir, basename(abs))).split(sep).join("/");

  if (rel.startsWith("..") || isAbsolute(rel)) return deny(`${filePath} is outside the project.`);
  if (FORBIDDEN_PREFIXES.some((p) => rel.startsWith(p) || rel.includes(`/${p}`)))
    return deny(`${rel} is under a forbidden tree (${FORBIDDEN_PREFIXES.join(", ")}).`);
  if (!specPath.test(rel) || basename(rel) === "README.md")
    return deny(`${rel} is not a spec file. Allowed: <any>/${specsDir}/<kebab-case-feature>.md, never README.md.`);

  const exists = existsSync(abs);
  let current = "";
  if (exists) {
    try {
      current = readFileSync(abs, "utf8");
    } catch {
      return deny(`cannot read ${rel}.`);
    }
    if (!DRAFT.test(current) && tool === "Write")
      return deny(`${rel} is not a draft — change an approved, implemented or legacy spec with Edit, never overwrite it.`);
  } else if (tool !== "Write") {
    return deny(`${rel} does not exist; create it with Write.`);
  }

  let next;
  if (tool === "Write") next = ti.content ?? "";
  else {
    const edits = tool === "MultiEdit" ? ti.edits ?? [] : [ti];
    next = applyEdits(current, edits);
    if (next === null) return; // the tool itself will fail on a non-matching old_string
  }

  if (!DRAFT.test(next) || NON_DRAFT.test(next))
    return deny(`${rel} must say exactly "Status: draft" after the write — only a human approves a spec or marks it implemented.`);
  if (!SPEC_ID.test(next))
    return deny(`${rel} must carry a "Spec ID: SPEC-NN" line after the write — adopting a legacy spec adds it in the same edit as the status.`);
});
