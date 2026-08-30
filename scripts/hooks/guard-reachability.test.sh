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
  printf 'Gate run\nFAIL-FIRST: tests/a.spec.ts - red first\n' >> TEST_SUMMARY.md
  echo notes > docs.md; git add -A >/dev/null )
expect "skips (no deps) rather than blocking"  0 "$d" "feat: a"

echo "G5 docs guard - reachable only if G1..G4 all RETURN rather than exit"
d=$(scratch); ( cd "$d"; echo "export const y=1" > src/b.ts; mkdir -p tests
  echo "test('y',()=>{})" > tests/b.spec.ts
  printf 'Gate run\nFAIL-FIRST: tests/b.spec.ts - red first\n' >> TEST_SUMMARY.md
  git add -A >/dev/null )
expect "the LAST guard still fires"            2 "$d" "feat: y"
d=$(scratch); ( cd "$d"; echo "export const z=1" > src/c.ts; mkdir -p tests docs
  echo "test('z',()=>{})" > tests/c.spec.ts; echo "# module z" > docs/z.md
  printf 'Gate run\nFAIL-FIRST: tests/c.spec.ts - red first\n' >> TEST_SUMMARY.md
  git add -A >/dev/null )
expect "a real doc satisfies it"               0 "$d" "feat: z"

echo
echo "$PASS passed, $FAIL failed."
[ "$FAIL" -eq 0 ] || exit 1
