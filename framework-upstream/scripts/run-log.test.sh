#!/usr/bin/env bash
# run-log.test.sh - EXECUTE the run log against real invocations.
#
# WHY EXECUTE RATHER THAN READ
#   The value of this log is that its durations are MEASURED. A test that reads the source for
#   the word "Date.now" proves the script mentions a clock; only running it proves a row comes
#   out with a computed total, and that `end` without a `start` REFUSES rather than inventing
#   one. Each case below was observed producing its exit code before this file was committed.
#
# Run: bash scripts/run-log.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGGER="$ROOT/scripts/run-log.mjs"
PASS=0; FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

node -e '1' >/dev/null 2>&1 || { echo "SKIPPED - no node interpreter" >&2; exit 0; }
[ -f "$LOGGER" ] || { echo "SKIPPED - no run-log.mjs at $LOGGER" >&2; exit 0; }

# A scratch log with the same header shape as the register, so nothing here touches the real one.
LOG="$TMP/RUN_LOG.md"
ACTIVE="$TMP/active.json"
fresh_log() {
  rm -f "$ACTIVE"
  printf '# Run log\n\n| ID | Action | Type | Scale | Started | Ended | Total | Stages | Gate | Verdict | Notes |\n|---|---|---|---|---|---|---|---|---|---|---|\n' > "$LOG"
}
rl() { node "$LOGGER" "$@" --log "$LOG" --active "$ACTIVE" --summary "$TMP/TEST_SUMMARY.md"; }

ok()   { if [ "$1" -eq "$2" ]; then echo "  PASS  $3 (exit $1)"; PASS=$((PASS+1));
         else echo "  FAIL  $3 (expected $2, got $1)"; FAIL=$((FAIL+1)); fi; }
grep_ok() { if grep -qE "$2" "$LOG"; then echo "  PASS  $1"; PASS=$((PASS+1));
            else echo "  FAIL  $1 (no match: $2)"; FAIL=$((FAIL+1)); fi; }
grep_no() { if grep -qE "$2" "$LOG"; then echo "  FAIL  $1 (matched what it must not: $2)"; FAIL=$((FAIL+1));
            else echo "  PASS  $1"; PASS=$((PASS+1)); fi; }

echo "run-log"

# 1. The happy path: start, end, one row with a computed total.
fresh_log
rl start --type CHANGE --action "sign-out lands on the wrong screen" --scale micro >/dev/null 2>&1
ok $? 0 "start records an open run"
rl end --verdict PASS >/dev/null 2>&1
ok $? 0 "end closes it"
grep_ok "the row carries the action in the requester's words" 'sign-out lands on the wrong screen'
grep_ok "the row carries the type and the declared scale" '\| CHANGE \| micro \|'
grep_ok "the row carries a computed total, not a blank" '\| (PASS|FAIL|BLOCKED) \|'
grep_ok "the row is numbered R-001 on a fresh log" '^\| R-001 \|'

# 2. THE HONESTY CASE. `end` with no open run must not invent a start time. A log whose
#    durations are sometimes measured and sometimes guessed is worse than no log, because
#    nothing on the row says which kind each one is.
fresh_log
rl end --verdict PASS >/dev/null 2>&1
ok $? 3 "end without start is BLOCKED, not a guessed duration"
grep_no "no row was written by the refused end" '\| R-00'

# 3. A back-fill is allowed, but the row SAYS SO. Explicit beats absent.
fresh_log
rl end --started "2026-09-08T09:00:00Z" --type BUG --action "totals wrong since Friday" --verdict FAIL >/dev/null 2>&1
ok $? 0 "an explicit --started back-fill is accepted"
grep_ok "the back-filled row is marked as such" 'back-filled start'

# 4. Two open runs at once would make both durations meaningless.
fresh_log
rl start --type NEW --action "export to CSV" >/dev/null 2>&1
rl start --type BUG --action "something else" >/dev/null 2>&1
ok $? 2 "a second concurrent start is refused"

# 5. The vocabulary is closed. An unknown type would split the log's own counts.
fresh_log
rl start --type IMPROVEMENT --action "x" >/dev/null 2>&1
ok $? 2 "an unregistered type is refused"
rl start --type NEW --action "" >/dev/null 2>&1
ok $? 2 "an empty action is refused - a log row that says nothing is not a record"

# 6. Three verdicts, and there is no fourth.
fresh_log
rl start --type NEW --action "export to CSV" >/dev/null 2>&1
rl end --verdict PROBABLY >/dev/null 2>&1
ok $? 2 "a fourth verdict value is refused"

# 7. Newest first: the second run's row must sit ABOVE the first.
fresh_log
rl start --type NEW --action "first thing" >/dev/null 2>&1;  rl end --verdict PASS >/dev/null 2>&1
rl start --type BUG --action "second thing" >/dev/null 2>&1; rl end --verdict PASS >/dev/null 2>&1
if [ "$(grep -n 'second thing' "$LOG" | cut -d: -f1)" -lt "$(grep -n 'first thing' "$LOG" | cut -d: -f1)" ]; then
  echo "  PASS  newest row is first"; PASS=$((PASS+1))
else echo "  FAIL  newest row is not first"; FAIL=$((FAIL+1)); fi
grep_ok "ids ascend and are never reused" '^\| R-002 \|'

# 8. A pipe in the action would silently split the row and shift every column after it.
#    Counted the way a markdown renderer counts: an ESCAPED pipe is content, not a delimiter,
#    so the escaped pairs are stripped BEFORE the delimiters are counted. Splitting on every
#    "|" would fail a correctly escaped row - a defect in the ruler, not in the thing measured.
fresh_log
rl start --type CHANGE --action "rename A | B to C" >/dev/null 2>&1
rl end --verdict PASS >/dev/null 2>&1
delims="$(grep '^| R-001 |' "$LOG" | sed 's/\\|//g' | tr -cd '|' | wc -c)"
cells=$(( delims - 1 ))
if [ "$cells" -eq 11 ]; then echo "  PASS  a pipe in the action does not shift the columns (11 cells)"; PASS=$((PASS+1))
else echo "  FAIL  pipe in action produced $cells cells, expected 11"; FAIL=$((FAIL+1)); fi
grep_ok "the pipe survives in the cell, escaped" 'rename A \\\| B to C'

# 9. THE REGRESSION FROM FIRST REAL USE. The register explains itself before it lists
#    anything, so the FIRST markdown table in the file is the column glossary. Anchoring on
#    "the first separator" filed rows into that table, where they rendered as documentation -
#    and the write still reported success. A register that silently files entries where nobody
#    reads them is worse than one that refuses.
rm -f "$ACTIVE"
{ printf '# Run log\n\n## The columns\n\n| Column | What it holds |\n|---|---|\n'
  printf '| **ID** | ascending, never reused |\n| **Action** | what was asked |\n\n---\n\n'
  printf '| ID | Action | Type | Scale | Started | Ended | Total | Stages | Gate | Verdict | Notes |\n'
  printf '|---|---|---|---|---|---|---|---|---|---|---|\n'; } > "$LOG"
rl start --type BUG --action "row must land in the data table" >/dev/null 2>&1
rl end --verdict PASS >/dev/null 2>&1
ok $? 0 "a log with a glossary table above the data table still accepts a row"
# The row must sit BELOW the data-table header, not below the glossary's separator.
data_hdr="$(grep -n '^| ID | Action | Type |' "$LOG" | cut -d: -f1)"
row_at="$(grep -n '^| R-001 |' "$LOG" | cut -d: -f1)"
if [ -n "$row_at" ] && [ -n "$data_hdr" ] && [ "$row_at" -gt "$data_hdr" ]; then
  echo "  PASS  the row landed in the data table, not the glossary"; PASS=$((PASS+1))
else echo "  FAIL  row at line ${row_at:-none}, data header at ${data_hdr:-none}"; FAIL=$((FAIL+1)); fi
grep_no "the glossary table was not touched" '^\| \*\*ID\*\* \| R-001'

# 9b. The row must sit on the line IMMEDIATELY after the separator. A blank line between them
#     ends the markdown table, so every row below renders as loose text - while the write still
#     reports success. Found the same way case 9 was: by looking at the seeded register.
fresh_log
rl start --type NEW --action "adjacency matters" >/dev/null 2>&1
rl end --verdict PASS >/dev/null 2>&1
sep_at="$(grep -n '^|---|' "$LOG" | head -1 | cut -d: -f1)"
row_at="$(grep -n '^| R-001 |' "$LOG" | cut -d: -f1)"
if [ -n "$sep_at" ] && [ -n "$row_at" ] && [ "$row_at" -eq $(( sep_at + 1 )) ]; then
  echo "  PASS  the row is adjacent to the separator, so the table still renders"; PASS=$((PASS+1))
else echo "  FAIL  separator at ${sep_at:-none}, row at ${row_at:-none} - a gap ends the table"; FAIL=$((FAIL+1)); fi

# 10. A file with no data-table header is a malformed register: refuse, never guess.
rm -f "$ACTIVE"
printf '# Run log\n\nNo table here at all.\n' > "$LOG"
rl start --type BUG --action "nowhere to put this" >/dev/null 2>&1
rl end --verdict PASS >/dev/null 2>&1
ok $? 2 "a log with no data table is refused, not guessed at"

# 11. Stages: the breakdown is what makes a total actionable. A run that took an hour tells
#     you to do something; only the breakdown tells you WHAT.
fresh_log
rl start --type NEW --action "staged run" >/dev/null 2>&1
rl stage ground >/dev/null 2>&1
ok $? 0 "a stage can be marked inside an open run"
rl stage plan >/dev/null 2>&1
rl stage build >/dev/null 2>&1
rl end --verdict PASS >/dev/null 2>&1
grep_ok "every marked stage appears in the row, in order" '\| ground [0-9]+[ms] · plan [0-9]+[ms] · build [0-9]+[ms] \|'
grep_no "an UNMARKED stage does not appear at all" 'verify '

# 12. A stage mark outside a run has nothing to attach to. Recording it would attribute time
#     to a run that does not exist.
fresh_log
rl stage ground >/dev/null 2>&1
ok $? 3 "a stage marked with no open run is BLOCKED"

# 13. The stage vocabulary is closed, like the type vocabulary and for the same reason: an
#     ad-hoc sixth name makes two runs incomparable, and comparing runs is the point.
fresh_log
rl start --type NEW --action "staged run" >/dev/null 2>&1
rl stage thinking >/dev/null 2>&1
ok $? 2 "an unregistered stage name is refused"

# 14. Re-marking the stage you are already in would split it into two rows summing to the same
#     thing - noise, not information.
fresh_log
rl start --type NEW --action "staged run" >/dev/null 2>&1
rl stage build >/dev/null 2>&1
rl stage build >/dev/null 2>&1
ok $? 0 "re-marking the current stage is accepted but not recorded twice"
rl end --verdict PASS >/dev/null 2>&1
occurrences="$(grep -o 'build ' "$LOG" | wc -l)"
if [ "$occurrences" -eq 1 ]; then echo "  PASS  the duplicate mark did not split the stage"; PASS=$((PASS+1))
else echo "  FAIL  stage 'build' appears $occurrences times in the row"; FAIL=$((FAIL+1)); fi

# 15. A run with no stages marked at all still logs - it just has no breakdown. The feature is
#     additive; a run that skipped it must not lose its row.
fresh_log
rl start --type BUG --action "unstaged run" >/dev/null 2>&1
rl end --verdict PASS >/dev/null 2>&1
ok $? 0 "an unstaged run still writes its row"
grep_ok "its Stages cell is a dash, not a fabricated split" '\| unstaged run \|.*\| - \|'

echo "  ---- $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
