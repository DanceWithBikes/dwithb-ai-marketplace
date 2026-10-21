#!/usr/bin/env bash
# SDD pipeline benchmark: runs the whole spec -> plan -> implement -> verify pipeline on a fixture
# project with the plugins of one marketplace tree, then measures the session with workflow-retro
# and appends a row (label sdd-pipeline) to docs/retros/ledger.md.
#
#   scripts/pipeline/run.sh <marketplace-tree> [budget-usd] [main-model]
#
# <marketplace-tree> is a checkout of this repository at the version under test (for example a
# worktree of a release tag). Only its four plugins load (--setting-sources project keeps your
# installed plugins out). The run stops at --max-budget-usd. Exit 3 means the API refused for
# money or limits; the partial run is still measured.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
TREE="$(cd "$1" && pwd)"
BUDGET="${2:-6}"
MODEL="${3:-haiku}"
P="$TREE/plugins"
VERSION="$(node -p "require('$P/sdd-engineering/.claude-plugin/plugin.json').version")"
WORK="$(cd "$(mktemp -d "/tmp/sdd-pipeline-$VERSION-XXXX")" && pwd -P)"
(cd "$WORK" && bash "$HERE/fixture.sh")

LOG="$WORK.stream.jsonl"
(cd "$WORK" && claude -p "$(cat "$HERE/prompt.md")" --model "$MODEL" --max-budget-usd "$BUDGET" \
  --setting-sources project --permission-mode acceptEdits \
  --allowedTools "Agent" "Read" "Write" "Edit" "Glob" "Grep" "TodoWrite" "Skill" \
    "Bash(npm test*)" "Bash(npm run *)" "Bash(node *)" "Bash(git status*)" "Bash(git diff*)" "Bash(git log*)" "Bash(ls*)" "Bash(cat *)" "Bash(grep *)" \
  --plugin-dir "$P/sdd-engineering" --plugin-dir "$P/engineering-paved-path" \
  --plugin-dir "$P/research-tools" --plugin-dir "$P/architecture-review" \
  --output-format stream-json --verbose > "$LOG" 2>&1)
STATUS=$?
SESSION="$(node -e 'const L=require("fs").readFileSync(process.argv[1],"utf8").split("\n");for(const l of L){try{const j=JSON.parse(l);if(j.session_id){console.log(j.session_id);break}}catch{}}' "$LOG")"
RESULT="$(node -e 'const L=require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n");for(const l of L.reverse()){try{const j=JSON.parse(l);if(j.type==="result"){console.log(JSON.stringify({cost:j.total_cost_usd,subtype:j.subtype,is_error:j.is_error,result:(j.result||"").slice(0,400)}));break}}catch{}}' "$LOG")"
echo "version=$VERSION work=$WORK session=$SESSION exit=$STATUS result=$RESULT"

MONEY=0
grep -qiE "credit balance|billing|insufficient|quota exceeded|usage limit" "$LOG" && MONEY=1

RETRO="$HERE/../../plugins/sdd-engineering/skills/workflow-retro/scripts"
[ -n "$SESSION" ] || { echo "no session id"; exit 2; }
node "$RETRO/retro.mjs" "$SESSION" --deep --label sdd-pipeline --cwd "$WORK" > "$WORK.retro.json" || exit 2
# 1.0.x has no version-trace hook, so its version comes from the tree under test.
node -e 'const f=process.argv[1];const r=JSON.parse(require("fs").readFileSync(f,"utf8"));r.pluginVersion??=process.argv[2];require("fs").writeFileSync(f,JSON.stringify(r,null,2))' "$WORK.retro.json" "$VERSION"
(cd "$REPO" && node "$RETRO/append-ledger.mjs" "$WORK.retro.json" --ledger docs/retros/ledger.md --action "pipeline benchmark, main model $MODEL, budget \$$BUDGET")
cp "$WORK.retro.json" "$REPO/docs/evidence/pipeline-$VERSION-$(date -u +%Y%m%dT%H%M).retro.json"
[ "$MONEY" = 1 ] && { echo "MONEY_OR_LIMIT_ERROR"; exit 3; }
exit 0
