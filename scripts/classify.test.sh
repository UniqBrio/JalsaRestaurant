#!/usr/bin/env bash
# classify.test.sh - EXECUTE the request pre-sorter against real sentences.
#
# WHY EXECUTE RATHER THAN READ
#   The claim is that the obvious requests route deterministically and the ambiguous ones are
#   REFUSED. Reading the source proves the rules are written; only running it proves that
#   "improve X" does not quietly become a CHANGE - which is the failure that matters, because a
#   confident wrong route costs an entire track while the whole feature saves seconds.
#
# Run: bash scripts/classify.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLS="$ROOT/scripts/classify.mjs"
PASS=0; FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

node -e '1' >/dev/null 2>&1 || { echo "SKIPPED - no node interpreter" >&2; exit 0; }
[ -f "$CLS" ] || { echo "SKIPPED - no classify.mjs at $CLS" >&2; exit 0; }

OUT="$TMP/out.txt"
# --cwd points at a directory WITH a source tree unless a case says otherwise, so NEW/NEW-APP
# is decided by the repository rather than by whichever directory the suite happens to run in.
mkdir -p "$TMP/withcode/src" "$TMP/bare"

cls() { node "$CLS" "$1" --cwd "${2:-$TMP/withcode}" > "$OUT" 2>&1; echo $?; }

expect() { # <label> <expected-class> <request> [cwd]
  local code; code="$(cls "$3" "${4:-}")"
  if head -1 "$OUT" | grep -qE "^$2\b"; then echo "  PASS  $1"; PASS=$((PASS+1))
  else echo "  FAIL  $1 - got: $(head -1 "$OUT")"; FAIL=$((FAIL+1)); fi
}
expect_exit() { # <label> <expected-exit> <request> [cwd]
  local code; code="$(cls "$3" "${4:-}")"
  if [ "$code" -eq "$2" ]; then echo "  PASS  $1 (exit $code)"; PASS=$((PASS+1))
  else echo "  FAIL  $1 (expected $2, got $code)"; FAIL=$((FAIL+1)); fi
}

echo "classify"

# --- the classes it should get right -------------------------------------------------------
expect "a broken thing is a BUG"                  BUG       "the export gives wrong totals since last week"
expect "a crash is a BUG"                         BUG       "the app crashes when I open the report"
expect "a preference is a CHANGE"                 CHANGE    "export should also offer CSV"
expect "an addition to a working thing is CHANGE" CHANGE    "we should also show the phone number on the card"
expect "structure-only is a REFACTOR"             REFACTOR  "same behaviour, just split up the giant component"
expect "a named process failure is FRAMEWORK"     FRAMEWORK "the gate never caught this defect"
expect "an open question is BRAINSTORM"           BRAINSTORM "what should happen when two people edit at once"

# --- the distinction that is a REPOSITORY fact, not a sentence fact -------------------------
# NEW vs NEW-APP turns on whether a codebase exists to receive the work. It is answered by
# looking, never by reading, so the same sentence must classify differently in two directories.
expect "a new capability in an existing codebase is NEW" NEW "we need a new customer portal from scratch" "$TMP/withcode"
expect "the SAME words with no source tree is NEW-APP"   NEW-APP "we need a new customer portal from scratch" "$TMP/bare"

# --- a LIST goes to triage before anything else looks at it --------------------------------
printf '' > /dev/null
expect "several numbered items are TRIAGE" TRIAGE "$(printf '1. the totals are wrong\n2. add a CSV export\n3. rename the tab')"

# --- THE HONESTY CASES. Refusing is the feature, not a gap. ---------------------------------
expect      "an improve-shaped request is refused"      UNSURE "improve the dashboard"
expect_exit "and it exits 3, never 0"                3         "improve the dashboard"
expect      "broken AND preferred at once is refused"   UNSURE "the totals are wrong and it should also offer CSV"
expect      "an unrecognisable request is refused"      UNSURE "thing"

# A wrong confident route costs an entire track: a BUG filed as a CHANGE skips root cause,
# which is the entire value of Track C. So the refusals must NEVER be silently routed.
cls "improve the dashboard" >/dev/null
if grep -q 'Ask exactly one question' "$OUT"; then echo "  PASS  the refusal says what to do next"; PASS=$((PASS+1))
else echo "  FAIL  the refusal does not prescribe the one question"; FAIL=$((FAIL+1)); fi

# --- it must show its working, or it is a guess with a label -------------------------------
cls "the export gives wrong totals since last week" >/dev/null
if grep -q 'Signals:' "$OUT"; then echo "  PASS  the classification shows which signals fired"; PASS=$((PASS+1))
else echo "  FAIL  no signals reported - an unauditable classification"; FAIL=$((FAIL+1)); fi

# --- determinism, the entire claim ----------------------------------------------------------
node "$CLS" "the export gives wrong totals" --cwd "$TMP/withcode" --json > "$TMP/a.json" 2>&1
node "$CLS" "the export gives wrong totals" --cwd "$TMP/withcode" --json > "$TMP/b.json" 2>&1
if diff -q "$TMP/a.json" "$TMP/b.json" >/dev/null 2>&1; then
  echo "  PASS  the same request classifies identically twice"; PASS=$((PASS+1))
else echo "  FAIL  two runs of the same request disagreed"; FAIL=$((FAIL+1)); fi

# --- usage ----------------------------------------------------------------------------------
node "$CLS" > "$OUT" 2>&1
if [ $? -eq 2 ]; then echo "  PASS  an empty request is refused (exit 2)"; PASS=$((PASS+1))
else echo "  FAIL  an empty request was not refused"; FAIL=$((FAIL+1)); fi

echo "  ---- $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
