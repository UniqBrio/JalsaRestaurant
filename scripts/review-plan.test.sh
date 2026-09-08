#!/usr/bin/env bash
# review-plan.test.sh - EXECUTE the review selector against real diffs in scratch repositories.
#
# WHY EXECUTE RATHER THAN READ
#   The whole claim of this script is that the SAME diff always selects the SAME reviewers.
#   Reading the source proves the rules are written down - which was already true of the table
#   it replaces. Only running it against a built diff proves the selection is actually
#   determined by the change. Each case below was observed before this file was committed.
#
# Run: bash scripts/review-plan.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLAN="$ROOT/scripts/review-plan.mjs"
PASS=0; FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

node -e '1' >/dev/null 2>&1 || { echo "SKIPPED - no node interpreter" >&2; exit 0; }
command -v git >/dev/null 2>&1 || { echo "SKIPPED - no git" >&2; exit 0; }
[ -f "$PLAN" ] || { echo "SKIPPED - no review-plan.mjs at $PLAN" >&2; exit 0; }

OUT="$TMP/out.txt"

# A scratch repository per case, so one case's staged files can never leak into the next.
new_repo() {
  rm -rf "$TMP/repo"; mkdir -p "$TMP/repo"
  git -C "$TMP/repo" init -q 2>/dev/null
  git -C "$TMP/repo" config user.email t@t; git -C "$TMP/repo" config user.name t
  mkdir -p "$TMP/repo/src/components" "$TMP/repo/migrations"
  echo "seed" > "$TMP/repo/README.md"
  git -C "$TMP/repo" add -A >/dev/null 2>&1
  git -C "$TMP/repo" commit -qm seed >/dev/null 2>&1
}
stage() { git -C "$TMP/repo" add -A >/dev/null 2>&1; }
plan()  { ( cd "$TMP/repo" && node "$PLAN" "$@" ) > "$OUT" 2>&1; }

check()  { if grep -qE "$2" "$OUT"; then echo "  PASS  $1"; PASS=$((PASS+1));
           else echo "  FAIL  $1 (no match: $2)"; FAIL=$((FAIL+1)); fi; }
refute() { if grep -qE "$2" "$OUT"; then echo "  FAIL  $1 (matched what it must not: $2)"; FAIL=$((FAIL+1));
           else echo "  PASS  $1"; PASS=$((PASS+1)); fi; }
ok()     { if [ "$1" -eq "$2" ]; then echo "  PASS  $3 (exit $1)"; PASS=$((PASS+1));
           else echo "  FAIL  $3 (expected $2, got $1)"; FAIL=$((FAIL+1)); fi; }

echo "review-plan"

# 1. A one-file change with no exported symbol is micro, and spawns no code reviewer: at this
#    size the inline review is the proportionate one.
new_repo
echo "const a = 1;" > "$TMP/repo/src/a.ts"; stage
plan
check  "one internal file is micro" 'SCALE: micro'
refute "micro with no exported symbol spawns no code-reviewer" '^  - code-reviewer'
check  "the smoke verifier is still selected - it is never optional" 'preview-smoke-verifier'

# 2. THE MICRO EXCEPTION. An exported symbol is the moment two files become twenty, and it is
#    exactly what an inline reviewer who just wrote the code sees worst.
new_repo
echo "export const a = 1;" > "$TMP/repo/src/a.ts"; stage
plan
check "micro + an exported symbol DOES spawn the code reviewer" '^  - code-reviewer'

# 3. Three source files exceeds the micro limit.
new_repo
for f in a b c; do echo "const $f = 1;" > "$TMP/repo/src/$f.ts"; done; stage
plan
check "three source files promote to scoped" 'SCALE: scoped'
check "the reason names the count, not just the verdict" '3 source files'

# 4. A schema change disqualifies micro however small, and pulls in the parity pass.
new_repo
echo "alter table x add column y int;" > "$TMP/repo/migrations/001.sql"; stage
plan
check "one migration is not micro" 'SCALE: scoped'
check "a schema change selects the parity checker" 'parity-gate-checker'

# 5. Close-out artifacts are not the change. Counting tests and docs would push every honest
#    small run over its own limit.
new_repo
echo "const a = 1;" > "$TMP/repo/src/a.ts"
echo "test" > "$TMP/repo/src/a.spec.ts"
echo "# doc" > "$TMP/repo/NOTES.md"
mkdir -p "$TMP/repo/tests"; echo "t" > "$TMP/repo/tests/x.txt"; stage
plan
check "tests and docs do not count toward the source limit" 'SCALE: micro'

# 6. A visible string selects the copy pass. Deliberately over-inclusive: a needless copy
#    review costs one agent; a missed one ships a silently reworded shipped string.
new_repo
printf 'export const T = () => <p>Save your changes</p>;\n' > "$TMP/repo/src/components/T.tsx"; stage
plan
check "JSX text selects the copy gate" 'copy-gate-reviewer'

# 6b. The other shape: copy passed as a quoted prop, which carries no JSX text at all.
new_repo
printf 'export const B = () => <button label="Save your changes" />;\n' > "$TMP/repo/src/components/B.tsx"; stage
plan
check "a quoted phrase also selects the copy gate" 'copy-gate-reviewer'

# 6c. Code with no user-facing words must NOT drag in the copy pass on every run, or the pass
#     becomes noise and stops being read.
new_repo
printf 'export const C = () => <div className={styles.x} />;\n' > "$TMP/repo/src/components/C.tsx"; stage
plan
refute "markup with no prose does not select the copy gate" 'copy-gate-reviewer'

# 7. Roles and policies select the permission pass - and never at micro, which the entry test
#    already forbids for permission changes.
new_repo
echo "export const canAccess = (role) => role === 'admin';" > "$TMP/repo/src/permissions.ts"
echo "const x = 1;" > "$TMP/repo/src/b.ts"
echo "const y = 1;" > "$TMP/repo/src/c.ts"; stage
plan
check "roles select the permission reviewer" 'permission-reviewer'

# 8. Full scale spawns the second, fresh reviewer. Self-review has a blind spot that no amount
#    of re-checking removes: a reviewer who accepted a premise keeps accepting it.
new_repo
for f in a b c d e f g; do echo "const $f = 1;" > "$TMP/repo/src/$f.ts"; done; stage
plan
check "seven source files are full scale" 'SCALE: full-scale'
check "full scale spawns the fresh-context reviewer" 'fresh-context-reviewer'
check "full scale spawns the planner" 'implementation-planner'

# 9. A hotspot is a judgement about history, not a fact in the diff - so it is DECLARED, and
#    declaring it escalates.
new_repo
echo "const a = 1;" > "$TMP/repo/src/a.ts"; stage
plan --hotspot
check "a declared hotspot escalates to full scale" 'SCALE: full-scale'

# 10. THE HONESTY CASE. No diff means nothing was decided. A plan of "no reviewers needed" and
#     a plan that could not be computed must never look alike.
new_repo
plan
ok $? 3 "an empty diff is BLOCKED, not an empty plan"
check "it says why rather than printing a bare plan" 'BLOCKED'

# 11. Determinism is the entire claim: the same diff, twice, selects the same set.
new_repo
echo "export const a = 1;" > "$TMP/repo/src/a.ts"
printf 'export const T = () => <p>Save your changes</p>;\n' > "$TMP/repo/src/components/T.tsx"; stage
plan --json; cp "$OUT" "$TMP/first.json"
plan --json; cp "$OUT" "$TMP/second.json"
if diff -q "$TMP/first.json" "$TMP/second.json" >/dev/null 2>&1; then
  echo "  PASS  the same diff produces a byte-identical plan"; PASS=$((PASS+1))
else echo "  FAIL  two runs of the same diff disagreed"; FAIL=$((FAIL+1)); fi

echo "  ---- $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
