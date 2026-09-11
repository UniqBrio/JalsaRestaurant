#!/usr/bin/env bash
# ratchet.test.sh - EXECUTE the ratchet engine and prove it speaks the gate's three values.
#
# WHY THIS SUITE EXISTS
#   The engine returned 0 for "no baseline". Its own message said "this gate is INERT and is
#   telling you so" - but it told stderr, and the thing that DECIDES reads the exit code. So
#   the gate runner, which has three verdicts precisely so that "did not run" is never
#   confused with "passed", recorded every baseline-less ratchet as PASS. Observed: an app with
#   no service worker and no PWA baseline - G12 PASS. Green by omission, at the one layer the
#   framework built to prevent it, in every ratchet, in any app missing a baseline.
#
#   The fix is one constant. This suite exists so the constant cannot drift back, and so the
#   consumers of that exit code (par.mjs, the gate) are proven to read it as BLOCKED and never
#   as FAIL - because a BLOCKED reported as FAIL says "your code is broken" when the truth is
#   "nothing checked it", and that is a gate people learn to ignore.
#
# Run: bash scripts/ratchet.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
. "$ROOT/scripts/lib/shpath.sh"   # jsurl: a path crossing into JS source is data, not argv
PASS=0; FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
node -e '1' >/dev/null 2>&1 || { echo "SKIPPED - no node interpreter" >&2; exit 0; }
[ -f "$ROOT/scripts/lib/ratchet.mjs" ] || { echo "SKIPPED - no ratchet.mjs" >&2; exit 0; }

ok()  { if [ "$1" -eq "$2" ]; then echo "  PASS  $3 (exit $1)"; PASS=$((PASS+1)); else echo "  FAIL  $3 (expected $2, got $1)"; FAIL=$((FAIL+1)); fi; }

# A tiny driver around the real engine. Signatures and baseline path come from the arguments,
# so each case below is one call with one thing varied.
cat > "$TMP/drive.mjs" <<JS
import { evaluateRatchet } from '$(jsurl "$ROOT/scripts/lib/ratchet.mjs")';
const [sigs, baseline, parsed] = process.argv.slice(2);
process.exit(evaluateRatchet({
  name: 'PROBE', signatures: sigs ? sigs.split(',') : [], baselineFile: baseline,
  regenerateCmd: 'n/a', remediation: 'n/a', parsedSomething: parsed !== 'nothing',
}));
JS
drive() { node "$TMP/drive.mjs" "$@" >"$TMP/out" 2>&1; }

echo "ratchet"

# 1. THE ONE THIS SUITE EXISTS FOR. No baseline -> the check did not run -> BLOCKED (3).
#    Not 0: that is the PASS nobody earned. Not 2: nothing is known to be broken.
drive "a|1" "$TMP/absent.txt"; ok $? 3 "no baseline is BLOCKED, neither pass nor fail"
grep -q "no baseline at" "$TMP/out" \
  && { echo "  PASS  ...and still says 'no baseline at', which upgrade.mjs probes for"; PASS=$((PASS+1)); } \
  || { echo "  FAIL  the 'no baseline at' phrase is gone - upgrade.mjs can no longer auto-baseline"; FAIL=$((FAIL+1)); }

# 2. A detector that parsed nothing is BLOCKED too - the same third value. A scan that matched
#    no files looks exactly like a clean tree, and rule 3's corollary says it "reports BLOCKED,
#    never success". It printed BLOCKED and exited 2, so the gate rendered it FAIL: "your code
#    is broken" about a tree nothing looked at. Message and exit code are now the same word.
printf '' > "$TMP/empty.txt"; drive "" "$TMP/empty.txt" nothing; ok $? 3 "parsing nothing is BLOCKED, and not called a failure of the code"

# 3. The two-sided contract is unchanged - this suite must not become a place it can loosen.
printf 'a|1\n' > "$TMP/base.txt"
drive "a|1" "$TMP/base.txt";      ok $? 0 "a known violation, none new, passes"
drive "a|1,b|2" "$TMP/base.txt";  ok $? 2 "a NEW violation blocks"
drive "" "$TMP/base.txt";         ok $? 2 "a fixed-but-still-listed violation ALSO blocks"

# 4. par.mjs - the runner behind audit:all and CI - must report exit 3 as BLOCKED, not FAIL,
#    and must exit 3 itself when nothing failed but something could not run.
node "$ROOT/scripts/par.mjs" "blocked=exit 3" "fine=exit 0" >"$TMP/par" 2>&1; code=$?
ok $code 3 "par exits 3 when a task is BLOCKED and none FAILED"
grep -qE '^=== BLKD +blocked' "$TMP/par" \
  && { echo "  PASS  par labels the task BLKD, not FAIL"; PASS=$((PASS+1)); } \
  || { echo "  FAIL  par did not label the blocked task BLKD"; sed -n '1,4p' "$TMP/par" | sed 's/^/        /'; FAIL=$((FAIL+1)); }
node "$ROOT/scripts/par.mjs" "blocked=exit 3" "broken=exit 1" >/dev/null 2>&1; ok $? 1 "a FAIL still outranks a BLOCKED in par"

echo "  ---- $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
