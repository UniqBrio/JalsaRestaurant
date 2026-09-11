#!/usr/bin/env bash
# fanout-check.test.sh - EXECUTE the fan-out validator against real plans.
#
# WHY EXECUTE RATHER THAN READ
#   The whole value of this validator is that it BLOCKS a plan that would lose a file. A test
#   that only reads the source proves the code exists, not that the block fires. Each case
#   below was observed producing its exit code before this file was committed.
#
# Run: bash scripts/fanout-check.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECK="$ROOT/scripts/fanout-check.mjs"
PASS=0; FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

expect() { # <label> <expected-exit> <json>
  local label="$1" want="$2" json="$3"
  printf '%s' "$json" > "$TMP/plan.json"
  node "$CHECK" "$TMP/plan.json" >/dev/null 2>&1
  local got=$?
  if [ "$got" -eq "$want" ]; then echo "  PASS  $label (exit $got)"; PASS=$((PASS+1))
  else echo "  FAIL  $label (expected $want, got $got)"; FAIL=$((FAIL+1)); fi
}

echo "fanout-check"

expect "a clean three-task plan passes" 0 '{"tasks":[
 {"id":"schema","files":["supabase/migrations/002_x.sql"],"contract":["table x(id,name)"],"acceptance":"applies twice"},
 {"id":"api","files":["src/lib/x-client.ts"],"reads":["src/lib/api-client.ts"],"contract":["fetchX(t:string)"],"acceptance":"unit spec"},
 {"id":"ui","files":["src/components/XList.tsx"],"contract":["none"],"acceptance":"render spec"}]}'

expect "BLOCKS two writers of one file" 2 '{"tasks":[
 {"id":"a","files":["src/x.ts"],"contract":["a()"],"acceptance":"spec"},
 {"id":"b","files":["src/x.ts"],"contract":["b()"],"acceptance":"spec"},
 {"id":"c","files":["src/y.ts"],"contract":["c()"],"acceptance":"spec"}]}'

expect "BLOCKS a read of another task's write" 2 '{"tasks":[
 {"id":"a","files":["src/x.ts"],"contract":["a()"],"acceptance":"spec"},
 {"id":"b","files":["src/y.ts"],"reads":["src/x.ts"],"contract":["b()"],"acceptance":"spec"},
 {"id":"c","files":["src/z.ts"],"contract":["c()"],"acceptance":"spec"}]}'

expect "BLOCKS a task with no contract" 2 '{"tasks":[
 {"id":"a","files":["src/x.ts"],"acceptance":"spec"},
 {"id":"b","files":["src/y.ts"],"contract":["b()"],"acceptance":"spec"},
 {"id":"c","files":["src/z.ts"],"contract":["c()"],"acceptance":"spec"}]}'

expect "BLOCKS a task with no acceptance" 2 '{"tasks":[
 {"id":"a","files":["src/x.ts"],"contract":["a()"]},
 {"id":"b","files":["src/y.ts"],"contract":["b()"],"acceptance":"spec"},
 {"id":"c","files":["src/z.ts"],"contract":["c()"],"acceptance":"spec"}]}'

expect "BLOCKS a task that owns nothing" 2 '{"tasks":[
 {"id":"a","files":[],"contract":["a()"],"acceptance":"spec"},
 {"id":"b","files":["src/y.ts"],"contract":["b()"],"acceptance":"spec"}]}'

expect "BLOCKS duplicate task ids" 2 '{"tasks":[
 {"id":"a","files":["src/x.ts"],"contract":["a()"],"acceptance":"spec"},
 {"id":"a","files":["src/y.ts"],"contract":["a2()"],"acceptance":"spec"},
 {"id":"c","files":["src/z.ts"],"contract":["c()"],"acceptance":"spec"}]}'

# A detector that parsed nothing must never report success.
expect "BLOCKS an empty plan" 2 '{"tasks":[]}'
expect "BLOCKS unparseable JSON" 2 'not json at all'

# Two tasks are legal but warned about - the warning must not become a block.
expect "warns on a two-task plan, does not block" 0 '{"tasks":[
 {"id":"a","files":["src/x.ts"],"contract":["a()"],"acceptance":"spec"},
 {"id":"b","files":["src/y.ts"],"contract":["b()"],"acceptance":"spec"}]}'

# Path shape must not defeat collision detection.
expect "BLOCKS a collision written two different ways" 2 '{"tasks":[
 {"id":"a","files":["src/x.ts"],"contract":["a()"],"acceptance":"spec"},
 {"id":"b","files":["./src/x.ts"],"contract":["b()"],"acceptance":"spec"},
 {"id":"c","files":["src/z.ts"],"contract":["c()"],"acceptance":"spec"}]}'

echo
echo "$PASS passed, $FAIL failed."
[ "$FAIL" -eq 0 ] || exit 1
