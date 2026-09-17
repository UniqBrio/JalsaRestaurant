#!/usr/bin/env bash
# guard-reachability.test.sh - EXECUTE the commit guard against scratch repositories.
#
# WHY THIS EXISTS AND WHY IT MUST EXECUTE, NOT SCAN
#   A source scan cannot tell a live guard from a commented-out one, and it certainly cannot
#   tell that guard 3 became unreachable because guard 2 started exiting on success. Only
#   running the hook proves each guard can still fire. This is the test for the tests.
#
# Run: bash scripts/hooks/guard-reachability.test.sh
set -uo pipefail
GUARD="$(cd "$(dirname "$0")" && pwd)/pre-commit-guard.sh"
PASS=0; FAIL=0

scratch() {
  local d; d="$(mktemp -d)"
  ( cd "$d"
    git init -q .
    git config user.email t@t.t; git config user.name t
    mkdir -p src scripts
    printf '# Test summary\n\n---\n\n' > TEST_SUMMARY.md
    git add -A >/dev/null; git commit -qm init >/dev/null )
  echo "$d"
}

expect() { # <label> <expected-exit> <dir> <commit message>
  local label="$1" want="$2" dir="$3" msg="$4"
  ( cd "$dir"; printf '%s' "$msg" > .git/COMMIT_EDITMSG; bash "$GUARD" .git/COMMIT_EDITMSG >/dev/null 2>&1 )
  local got=$?
  if [ "$got" -eq "$want" ]; then echo "  PASS  $label (exit $got)"; PASS=$((PASS+1))
  else echo "  FAIL  $label (expected $want, got $got)"; FAIL=$((FAIL+1)); fi
}

echo "G1 test-case guard"
d=$(scratch); ( cd "$d"; echo "export const x=1" > src/a.ts; git add -A >/dev/null )
expect "blocks app code with no cases"        2 "$d" "feat: add x"

# Isolating G1: every DOWNSTREAM guard's precondition is satisfied, so a pass here can only
# come from the escape token. Without this, a green result would prove nothing about G1.
d=$(scratch); ( cd "$d"; echo "export const x=1" > src/a.ts
  printf 'Gate run\n' >> TEST_SUMMARY.md; echo "notes" > docs.md; git add -A >/dev/null )
expect "escape token releases it"             0 "$d" "feat: add x

CASES-NA: pure type export, no behaviour"

echo "G3 fail-first guard"
d=$(scratch); ( cd "$d"; mkdir -p tests; echo "test('x',()=>{})" > tests/a.spec.ts
  printf '+Gate run\n' >> TEST_SUMMARY.md; git add -A >/dev/null )
expect "blocks a new spec with no red evidence" 2 "$d" "test: add spec"
d=$(scratch); ( cd "$d"; mkdir -p tests; echo "test('x',()=>{})" > tests/a.spec.ts
  printf 'FAIL-FIRST: tests/a.spec.ts - failed with \"expected 1 got 0\"\n' >> TEST_SUMMARY.md
  git add -A >/dev/null )
expect "passes with FAIL-FIRST evidence"       0 "$d" "test: add spec"

echo "G1 widening - a PROCESS change is a behaviour change"
d=$(scratch); ( cd "$d"; mkdir -p scripts/hooks; echo "echo hi" > scripts/hooks/g.sh
  printf 'Gate run\n' >> TEST_SUMMARY.md; echo notes > docs.md; git add -A >/dev/null )
expect "blocks a guard edit with no cases"     2 "$d" "chore: tweak a guard"

echo "G6 case-loss guard"
d=$(scratch)
( cd "$d"; mkdir -p tests/cases
  printf '| APP-INV-001 | a |\n| APP-INV-002 | b |\n| APP-INV-003 | c |\n' > tests/cases/registry.md
  git add -A >/dev/null; git commit -qm "cases" >/dev/null
  # A registry regenerated from a stale checkout: 002 silently disappears.
  printf '| APP-INV-001 | a |\n| APP-INV-003 | c |\n' > tests/cases/registry.md
  printf 'Gate run\n' >> TEST_SUMMARY.md; echo notes > docs.md; git add -A >/dev/null )
expect "blocks a silently deleted case ID"     2 "$d" "chore: regenerate registry"
d=$(scratch)
( cd "$d"; mkdir -p tests/cases
  printf '| APP-INV-001 | a |\n| APP-INV-002 | b |\n' > tests/cases/registry.md
  git add -A >/dev/null; git commit -qm "cases" >/dev/null
  printf '| APP-INV-001 | a |\n' > tests/cases/registry.md
  printf 'Gate run\n' >> TEST_SUMMARY.md; echo notes > docs.md; git add -A >/dev/null )
expect "a DECLARED retirement is allowed"      0 "$d" "chore: retire

REGISTRY-RETIRE: APP-INV-002 - the feature was removed"

echo "G7 type ratchet - fails OPEN and AUDIBLY when it cannot run"
d=$(scratch); ( cd "$d"; mkdir -p src; echo "export const a: number = 1" > src/a.ts
  mkdir -p tests; echo "test('a',()=>{})" > tests/a.spec.ts
  printf 'Gate run\nFAIL-FIRST: tests/a.spec.ts - exit 1, "expected 1 got 0"\n' >> TEST_SUMMARY.md
  echo notes > docs.md; git add -A >/dev/null )
expect "skips (no deps) rather than blocking"  0 "$d" "feat: a"

echo "G5 docs guard - reachable only if G1..G4 all RETURN rather than exit"
d=$(scratch); ( cd "$d"; echo "export const y=1" > src/b.ts; mkdir -p tests
  echo "test('y',()=>{})" > tests/b.spec.ts
  printf 'Gate run\nFAIL-FIRST: tests/b.spec.ts - exit 1, "expected 1 got 0"\n' >> TEST_SUMMARY.md
  git add -A >/dev/null )
expect "the LAST guard still fires"            2 "$d" "feat: y"
d=$(scratch); ( cd "$d"; echo "export const z=1" > src/c.ts; mkdir -p tests docs
  echo "test('z',()=>{})" > tests/c.spec.ts; echo "# module z" > docs/z.md
  printf 'Gate run\nFAIL-FIRST: tests/c.spec.ts - exit 1, "expected 1 got 0"\n' >> TEST_SUMMARY.md
  git add -A >/dev/null )
expect "a real doc satisfies it"               0 "$d" "feat: z"

echo "G8 micro-scope guard - the lane's claim is checked against the diff"
# Every OTHER guard is released by its own token, so a result here can only come from G8.
MICRO_TOKENS="CASES-NA: isolating G8
LEDGER-NA: isolating G8
DOCS-NA: isolating G8"

d=$(scratch); ( cd "$d"; echo "export const a=1" > src/a.ts; echo "export const b=1" > src/b.ts
  echo "export const c=1" > src/c.ts; git add -A >/dev/null )
expect "blocks a 3-file micro claim"           2 "$d" "fix: label

SCALE: micro
$MICRO_TOKENS"

d=$(scratch); ( cd "$d"; echo "export const a=1" > src/a.ts; echo "export const b=1" > src/b.ts
  mkdir -p tests; echo "test('a',()=>{})" > tests/a.spec.ts; echo notes > docs.md
  git add -A >/dev/null )
expect "2 source files + test + doc passes"    0 "$d" "fix: label

SCALE: micro
FAILFIRST-NA: isolating G8
$MICRO_TOKENS"

d=$(scratch); ( cd "$d"; mkdir -p supabase/migrations; echo "export const a=1" > src/a.ts
  echo "create table x();" > supabase/migrations/001_x.sql; git add -A >/dev/null )
expect "blocks a schema change"                2 "$d" "fix: column

SCALE: micro
$MICRO_TOKENS"

d=$(scratch); ( cd "$d"; mkdir -p src/components; echo "export const C=()=>null" > src/components/New.tsx
  git add -A >/dev/null )
expect "blocks a NEW component"                2 "$d" "feat: card

SCALE: micro
$MICRO_TOKENS"

d=$(scratch); ( cd "$d"; echo "export const a=1" > src/a.ts; echo '{"name":"x"}' > package.json
  git add -A >/dev/null )
expect "blocks a dependency change"            2 "$d" "chore: dep

SCALE: micro
$MICRO_TOKENS"

d=$(scratch); ( cd "$d"; echo "export const a=1" > src/a.ts; echo "export const b=1" > src/b.ts
  echo "export const c=1" > src/c.ts; git add -A >/dev/null )
expect "escape token releases it"              0 "$d" "refactor: rename

SCALE: micro
MICRO-NA: mechanical rename across three call sites
$MICRO_TOKENS"

# A run that does NOT claim micro must be untouched by G8 - the guard is opt-in by claim.
d=$(scratch); ( cd "$d"; echo "export const a=1" > src/a.ts; echo "export const b=1" > src/b.ts
  echo "export const c=1" > src/c.ts; git add -A >/dev/null )
expect "silent when micro is not claimed"      0 "$d" "feat: three files

$MICRO_TOKENS"

echo "G3 fail-first must NAME the failure, not merely claim one"
# Every OTHER guard is released by its own token, so an exit here can only come from G3.
FF_TOKENS="CASES-NA: isolating G3
LEDGER-NA: isolating G3
DOCS-NA: isolating G3
RUNLOG-NA: isolating G3"

ff_case() { # <label> <expected-exit> <the FAIL-FIRST line>
  local d; d=$(scratch)
  ( cd "$d"; mkdir -p tests
    echo "export const q=1" > src/q.ts
    echo "test('q',()=>{})" > tests/q.spec.ts
    printf 'Gate run\n%s\n' "$3" >> TEST_SUMMARY.md
    git add -A >/dev/null )
  expect "$1" "$2" "$d" "feat: q

$FF_TOKENS"
}

# The phrase that has been passing since G3 existed - and that the fixtures actually used.
ff_case "'red first' no longer satisfies it"          2 "FAIL-FIRST: tests/q.spec.ts - red first"
ff_case "a bare 'failed' does not satisfy it"         2 "FAIL-FIRST: tests/q.spec.ts - failed"
# An exit code distinguishes one failure from another - that is the whole point.
ff_case "an exit code satisfies it"                   0 "FAIL-FIRST: tests/q.spec.ts - exit 0, not 2 (guard unwired)"
# So does the real message, quoted. Quoting is always available, so the rule is satisfiable.
ff_case "a quoted message satisfies it"               0 "FAIL-FIRST: tests/q.spec.ts - \"expected 1200, received 0\""
ff_case "a count satisfies it"                        0 "FAIL-FIRST: tests/q.spec.ts - matched 0 files, reported clean"
# The honest negative records a REASON, not a failure, so it is exempt from the signal test.
ff_case "NOT OBSERVED FAILING is exempt"              0 "NOT OBSERVED FAILING: tests/q.spec.ts - new surface, no prior behaviour"
# Absent evidence is still the original block, not the new one.
ff_case "no evidence at all still blocks"             2 "Gate run"

echo "G9 run-log guard - a shipped run must leave a row that says what it cost"
# Every OTHER guard is released by its own token, so a result here can only come from G9.
RUNLOG_TOKENS="CASES-NA: isolating G9
LEDGER-NA: isolating G9
DOCS-NA: isolating G9
FAILFIRST-NA: isolating G9"

# The log exists and the run left no row - the case this guard was written for, after a real
# app shipped three runs in a morning against a log whose newest row was three days old.
d=$(scratch); ( cd "$d"; mkdir -p docs/registers
  printf '| ID | Action |\n|---|---|\n| R-001 | an older run |\n' > docs/registers/RUN_LOG.md
  git add -A >/dev/null; git commit -qm "log exists" >/dev/null
  echo "export const t=1" > src/t.ts; git add -A >/dev/null )
expect "code changed, no run-log row -> BLOCKED" 2 "$d" "feat: t

$RUNLOG_TOKENS"

# ...and a row satisfies it. A guard nothing can satisfy gets uninstalled, not obeyed.
d=$(scratch); ( cd "$d"; mkdir -p docs/registers
  printf '| ID | Action |\n|---|---|\n| R-001 | an older run |\n' > docs/registers/RUN_LOG.md
  git add -A >/dev/null; git commit -qm "log exists" >/dev/null
  echo "export const u=1" > src/u.ts
  printf '| R-002 | the run that shipped u | CHANGE | micro | - | - | 4m | - | PASS | PASS | - |\n' >> docs/registers/RUN_LOG.md
  git add -A >/dev/null )
expect "a new R- row satisfies it"              0 "$d" "feat: u

$RUNLOG_TOKENS"

# Rule 3: no log is not a violation. It fails OPEN, and says so on stderr.
d=$(scratch); ( cd "$d"; echo "export const v=1" > src/v.ts; git add -A >/dev/null )
expect "no RUN_LOG.md -> fails open, not blocked" 0 "$d" "feat: v

$RUNLOG_TOKENS"

# Rule 2: one token, one guard.
d=$(scratch); ( cd "$d"; mkdir -p docs/registers
  printf '| ID | Action |\n|---|---|\n| R-001 | an older run |\n' > docs/registers/RUN_LOG.md
  git add -A >/dev/null; git commit -qm "log exists" >/dev/null
  echo "export const w=1" > src/w.ts; git add -A >/dev/null )
expect "RUNLOG-NA excuses G9 and nothing else"  0 "$d" "feat: w

RUNLOG-NA: isolating G9
$RUNLOG_TOKENS"

echo
echo "$PASS passed, $FAIL failed."
[ "$FAIL" -eq 0 ] || exit 1
