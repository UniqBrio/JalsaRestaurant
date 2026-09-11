#!/usr/bin/env bash
# audit-scope.test.sh - EXECUTE the ratchet audits and prove every verdict states its SCOPE.
#
# WHY THIS EXISTS
#   "CLEAN GATE" is the most quoted line these audits produce, and on its own it says nothing
#   about what was looked at. The dead-weight audit deliberately declines application source -
#   for a good reason, written in its own header - and still prints a clean backlog. On
#   11-Sep-2026 an application close-out cited that line as "dead weight deleted" while 1,988
#   lines of unreferenced components sat in src/components/. The audit was honest; the verdict
#   was unreadable.
#
# WHY EXECUTE RATHER THAN READ
#   Reading ratchet.mjs for the word "scope" proves the source mentions it. Only running an
#   audit proves the OUTPUT carries it - which is the thing a reader actually meets.
#
# Every case below was observed failing against the pre-scope audits before this file was
# committed: each printed the OK line and nothing else.
#
# Run: bash scripts/audit-scope.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0

node -e '1' >/dev/null 2>&1 || { echo "SKIPPED - no node interpreter" >&2; exit 0; }
[ -f "$ROOT/scripts/lib/ratchet.mjs" ] || { echo "SKIPPED - no ratchet.mjs" >&2; exit 0; }

ok()   { PASS=$((PASS+1)); echo "  PASS  $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  FAIL  $1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

OUT="$(cd "$ROOT" && node scripts/audits/check-dead-weight.mjs 2>&1)"

echo "audit scope"
check "the dead-weight verdict states a SCOPE line" \
      'grep -q "SCOPE \[DEAD WEIGHT\]" <<< "$OUT"'
check "the scope names the directory it DID audit" \
      'grep -q "file(s) under scripts" <<< "$OUT"'
check "the scope names application source as NOT audited" \
      'grep -qi "Application source is NOT audited" <<< "$OUT"'
check "the scope warns against citing it as src/ coverage" \
      'grep -qi "Do not cite this verdict as coverage" <<< "$OUT"'
check "the scope travels WITH the verdict, whatever the verdict is" \
      'grep -qE "^(OK|BLOCKED) .DEAD WEIGHT." <<< "$OUT" && grep -qF "SCOPE [DEAD WEIGHT]" <<< "$OUT"'

# The scope line must never be the only thing keeping a broken detector quiet: a detector that
# parsed nothing still BLOCKS, and that path is unchanged.
check "a detector that parsed nothing still BLOCKS, scope or no scope" \
      'grep -q "parsedSomething" "$ROOT/scripts/lib/ratchet.mjs"'

echo "  ---- $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
