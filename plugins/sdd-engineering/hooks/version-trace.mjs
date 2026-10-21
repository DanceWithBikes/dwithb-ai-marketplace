// SessionStart hook for the sdd-engineering plugin, declared in hooks/hooks.json. It
// records which plugin version is active, so a run can be traced back to a release:
//   - appends one JSON line {ts, event, session_id, source, plugin, version, root} to
//     <data dir>/trace.jsonl, where <data dir> is CLAUDE_PLUGIN_DATA (the plugin's
//     persistent data directory) or ~/.claude/sdd-engineering when that is unset;
//   - returns `additionalContext: "sdd-engineering vX.Y.Z active"`, so the version also
//     lands in the session transcript, where workflow-retro reads it.
// Telemetry must never break a session: every failure exits 0 with no output.
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    let input = {};
    try {
      input = JSON.parse(raw || "{}");
    } catch {
      // A missing session id still leaves the version worth recording.
    }
    const root = process.env.CLAUDE_PLUGIN_ROOT;
    if (!root) return;
    const manifest = JSON.parse(readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8"));
    const record = {
      ts: new Date().toISOString(),
      event: "plugin_active",
      session_id: input.session_id ?? null,
      source: input.source ?? null,
      plugin: manifest.name,
      version: manifest.version,
      root,
    };

    const dataDir = process.env.CLAUDE_PLUGIN_DATA || join(homedir(), ".claude", "sdd-engineering");
    try {
      mkdirSync(dataDir, { recursive: true });
      appendFileSync(join(dataDir, "trace.jsonl"), `${JSON.stringify(record)}\n`);
    } catch {
      // A read-only data dir must not hide the version from the transcript.
    }

    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: `${manifest.name} v${manifest.version} active`,
        },
      }),
    );
  } catch {
    // Never block or pollute a session because of telemetry.
  }
});
