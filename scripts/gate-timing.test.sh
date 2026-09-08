#!/usr/bin/env bash
# gate-timing.test.sh - EXECUTE the gate runner and prove the report carries measured time.
#
# WHY EXECUTE RATHER THAN READ
#   "Run reports carry stage timings" was a rule for three versions (v1.13.0, FW-SPEED-003)
#   and produced not one measured number, because the only thing asked to honour it was a
#   narrator. Reading gate-runner.mjs for the word "duration" would prove the source mentions
#   time; only running it proves the REPORT states it. Every case below was observed failing
#   against the pre-timing runner before this file was committed.
#
#   The runner is driven with --only on a cheap step so this suite stays a couple of seconds:
#   the point is the shape of the report, not the cost of the gate.
#
# Run: bash scripts/gate-timing.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNNER="$ROOT/scripts/gate-runner.mjs"
PASS=0; FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

node -e '1' >/dev/null 2>&1 || { echo "SKIPPED - no node interpreter" >&2; exit 0; }
[ -f "$RUNNER" ] || { echo "SKIPPED - no gate-runner.mjs at $RUNNER" >&2; exit 0; }

# One real run, reused by every assertion. --only G1 keeps it to one cheap step; every other
# step reports BLOCKED "not selected", which is exactly the never-ran case case 4 needs.
#
# --cwd is the framework tree because the SUBJECT must be a real repository: run from an empty
# directory G1 cannot find design/tokens.json and reports FAIL, which would make this suite
# assert on a broken tree instead of a working one. The summary is redirected into $TMP so a
# test run never prepends to the committed ledger; .gate-logs/ is already git-ignored.
OUT="$TMP/out.txt"
node "$RUNNER" --cwd "$ROOT" --only G1 --summary "$TMP/SUMMARY.md" >"$OUT" 2>&1

check() { # <label> <regex>
  if grep -qE "$2" "$OUT"; then echo "  PASS  $1"; PASS=$((PASS+1))
  else echo "  FAIL  $1 (no match for: $2)"; FAIL=$((FAIL+1)); fi
}
refute() { # <label> <regex>
  if grep -qE "$2" "$OUT"; then echo "  FAIL  $1 (matched what it must not: $2)"; FAIL=$((FAIL+1))
  else echo "  PASS  $1"; PASS=$((PASS+1)); fi
}

echo "gate-timing"

# 1. The run states a total. Without this the report says a run was slow and stops there.
check "the report carries a total time" '^Time: .*total'

# 2. The slowest step is NAMED. A total alone sends the reader back to guessing which part.
check "the slowest step is named with its own duration" 'slowest G[0-9]+ .*\([0-9]'

# 3. A step that RAN carries a duration in its own line.
check "an executed step reports its duration" '\*\*G1 .*\*\* - (PASS|FAIL|BLOCKED) \([0-9]+(\.[0-9]+)?(ms|s)\)'

# 4. A step that never spawned reports "-", never 0ms. Zero is a measurement; a step that did
#    not run has none, and printing 0 makes the cheapest run look like the fastest one.
check "a never-spawned step reports a dash, not a duration" '\*\*G2 .*\*\* - BLOCKED \(-\)'
refute "no step that never ran claims 0ms" '\*\*G(2|3|4|9|10|11) .*\*\* - BLOCKED \(0ms\)'

# 5. The timing must not disturb the verdict contract - three values, and this run is BLOCKED
#    because --only left ten classes unverified. A report that got faster and lost its verdict
#    would be a worse gate wearing a stopwatch, so the stopwatch is asserted WITH the verdict.
check "the verdict line still renders" '^## Gate run - [0-9]{4}-[0-9]{2}-[0-9]{2} - VERDICT: (PASS|FAIL|BLOCKED)'
check "--only still yields BLOCKED, never green" 'VERDICT: BLOCKED'
check "the selected step actually passed, so BLOCKED is about coverage" '\*\*G1 .*\*\* - PASS'

echo "  ---- $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
