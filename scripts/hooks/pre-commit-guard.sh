#!/usr/bin/env bash
# pre-commit-guard - mechanical enforcement of the close-out obligations.
#
# WHY A HOOK AND NOT A CHECKLIST ITEM
#   A checklist is read when someone remembers to read it. A hook runs in EVERY session,
#   including the ad-hoc five-minute fix that never opened the workflow file. That is exactly
#   the session where obligations get skipped, so that is exactly where enforcement belongs.
#
# THE STRUCTURAL RULE THAT KEEPS GUARDS ALIVE
#   Every guard is a FUNCTION that RETURNS. Only main() exits. If a guard exits on its own
#   success path, every guard below it becomes unreachable - and unreachable guards look
#   identical to passing ones for as long as nobody checks. This has happened; the rule is
#   the fix, and scripts/hooks/guard-reachability.test.sh is the rung that proves it.
#
# ESCAPE TOKENS
#   Each guard has its OWN token, written into the commit message with a justification, and
#   it excuses ONLY that guard. There is deliberately no global bypass: one token buying a
#   pass on everything is the same as no guards at all. Every use is auditable in git history.
#
# FAIL OPEN, LOUDLY
#   Missing tool, missing baseline, missing dependency -> print SKIPPED on stderr and return 0.
#   Never block for a tooling gap; never go quietly dead either. A dead guard must be AUDIBLE.
#
# INSTALL
#   ln -sf ../../scripts/hooks/pre-commit-guard.sh .git/hooks/pre-commit
#   (or add it as a PreToolUse / pre-push hook in your agent or CI configuration)

set -uo pipefail
cd "$(git rev-parse --show-toplevel)" 2>/dev/null || exit 0

# Where the framework's own tools live. In the framework repo and a standalone app that is
# here; in a workspace-mode app the process half is LINKED, and .framework-link.json says from
# where. Without this, guard G4 quietly SKIPs in every workspace app ("theme-build.mjs absent")
# - audible once, invisible forever after.
FW="."
if [ -f .framework-link.json ]; then
  linked="$(sed -n 's/.*"framework"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' .framework-link.json | head -1)"
  [ -n "$linked" ] && [ -f "$linked/scripts/theme-build.mjs" ] && FW="$linked"
fi

MSG_FILE="${1:-.git/COMMIT_EDITMSG}"

# Two modes, one CHANGE. At commit time the change is the staged index. At push time nothing
# is staged - the change is the commit range being pushed. Reading only the index at push time
# finds an empty diff and exits before any guard runs, which silently disables every guard in
# exactly the mode the adapter went to the trouble of wiring up.
if [ -n "${PRE_PUSH_RANGE:-}" ]; then
  CHANGED="$(git diff --name-only "$PRE_PUSH_RANGE" 2>/dev/null)"
else
  CHANGED="$(git diff --cached --name-only)"
fi
[ -z "$CHANGED" ] && exit 0

# A guard must read the same CHANGE in both modes, not the same STRING. Escape tokens live in
# the commit message: present in the file at commit time, and only in the LOG at push time.
# Reading just the file silently voids every token on a push, which is the mode people use.
escape_text() {
  [ -f "$MSG_FILE" ] && cat "$MSG_FILE"
  if [ -n "${PRE_PUSH_RANGE:-}" ]; then git log --format=%B "$PRE_PUSH_RANGE" 2>/dev/null; fi
}
staged_diff()  {
  if [ -n "${PRE_PUSH_RANGE:-}" ]; then git diff -U0 "$PRE_PUSH_RANGE" -- "$1" 2>/dev/null
  else git diff --cached -U0 -- "$1" 2>/dev/null; fi
}
has_token()    { escape_text | grep -q "$1"; }
code_changed() { echo "$CHANGED" | grep -qE '^(starter/)?(src|app|components|lib|api|supabase)/'; }

# A change to a gate, a guard, an audit or a runbook ALTERS BEHAVIOUR - a guard fires or stays
# silent, a gate step runs or does not - and behaviour is testable. Scoping the case obligation
# to application code exempts the process from its own rule BY CONSTRUCTION, which is how every
# process change legitimately reaches for the escape token and ships uncovered.
framework_changed() { echo "$CHANGED" | grep -qE '^(scripts/|workflows/|checklists/|docs/registers/|AGENTS\.md|CLAUDE\.md)'; }

# --- G1: a behaviour change carries test cases -------------------------------------------
guard_test_cases() {
  has_token 'CASES-NA:' && { echo "[G1] escaped via CASES-NA" >&2; return 0; }
  code_changed || framework_changed || return 0
  echo "$CHANGED" | grep -qE '(\.spec\.|\.test\.|tests/cases/)' && return 0
  {
    echo "BLOCKED [G1] Code changed with no test case added or updated."
    echo "  A behaviour change is testable by definition - and a change to a gate, guard or audit"
    echo "  IS a behaviour change. Add or update a case, then commit."
    echo "  Genuine exception: put 'CASES-NA: <reason>' in the commit message."
  } >&2
  return 2
}

# --- G2: a gate was actually run ----------------------------------------------------------
guard_gate_ledger() {
  has_token 'LEDGER-NA:' && { echo "[G2] escaped via LEDGER-NA" >&2; return 0; }
  code_changed || return 0
  [ -f TEST_SUMMARY.md ] || { echo "[G2] SKIPPED - no TEST_SUMMARY.md yet" >&2; return 0; }
  staged_diff TEST_SUMMARY.md | grep -q '^+.*Gate run' && return 0
  {
    echo "BLOCKED [G2] Application code changed without a new gate run in TEST_SUMMARY.md."
    echo "  Run: npm run gate   then stage TEST_SUMMARY.md."
    echo "  BLOCKED is a verdict you may commit. Silence is not."
    echo "  Genuine exception: 'LEDGER-NA: <reason>'."
  } >&2
  return 2
}

# --- G3: a new test was observed failing --------------------------------------------------
guard_fail_first() {
  has_token 'FAILFIRST-NA:' && { echo "[G3] escaped via FAILFIRST-NA" >&2; return 0; }
  local added
  if [ -n "${PRE_PUSH_RANGE:-}" ]; then
    added="$(git diff --name-only --diff-filter=A "$PRE_PUSH_RANGE" 2>/dev/null | grep -E '\.(spec|test)\.[tj]sx?$' || true)"
  else
    added="$(git diff --cached --name-only --diff-filter=A | grep -E '\.(spec|test)\.[tj]sx?$' || true)"
  fi
  [ -z "$added" ] && return 0
  staged_diff TEST_SUMMARY.md | grep -qE '^\+(FAIL-FIRST:|NOT OBSERVED FAILING:)' && return 0
  {
    echo "BLOCKED [G3] New test file(s) added with no fail-first evidence:"
    echo "$added" | sed 's/^/    /'
    echo "  A test never observed failing is not evidence that it CAN fail. It may be asserting"
    echo "  the same misunderstanding the code encodes."
    echo "  Run it against the pre-fix tree (or inject the defect and revert) and add to TEST_SUMMARY.md:"
    echo "      FAIL-FIRST: <spec> - <the failure it produced>"
    echo "  If that state cannot be reconstructed, record the honest negative instead:"
    echo "      NOT OBSERVED FAILING: <spec> - <why>"
    echo "  Genuine exception: 'FAILFIRST-NA: <reason>'."
  } >&2
  return 2
}

# --- G4: theme artifacts are regenerated, not hand-edited ---------------------------------
guard_theme_sync() {
  has_token 'THEME-NA:' && { echo "[G4] escaped via THEME-NA" >&2; return 0; }
  echo "$CHANGED" | grep -qE '(design/tokens\.json|tokens\.generated\.)' || return 0
  command -v node >/dev/null 2>&1 || { echo "[G4] SKIPPED - node not on PATH" >&2; return 0; }
  [ -f "$FW/scripts/theme-build.mjs" ] || { echo "[G4] SKIPPED - theme-build.mjs absent" >&2; return 0; }
  if ! node "$FW/scripts/theme-build.mjs" --check >/dev/null 2>&1; then
    {
      echo "BLOCKED [G4] Generated theme files do not match design/tokens.json."
      echo "  Run: npm run theme:build && npm run theme:contrast"
      echo "  then stage the regenerated files. Genuine exception: 'THEME-NA: <reason>'."
    } >&2
    return 2
  fi
  return 0
}

# --- G5: documentation follows behaviour, in the same commit -------------------------------
guard_docs_touched() {
  has_token 'DOCS-NA:' && { echo "[G5] escaped via DOCS-NA" >&2; return 0; }
  code_changed || return 0
  # TEST_SUMMARY.md is a gate ARTIFACT, not documentation. Counting it would make this guard
  # vacuous: every commit that ran the gate would satisfy it for free. Excluded deliberately.
  echo "$CHANGED" | grep -E '\.md$' | grep -qv '^TEST_SUMMARY\.md$' && return 0
  {
    echo "BLOCKED [G5] Application code changed with no documentation touched."
    echo "  Update the module doc, a register entry, or the changelog in THIS commit."
    echo "  Documentation written 'later' describes a system nobody remembers."
    echo "  Genuine exception: 'DOCS-NA: <reason>' - correct for a pure internal refactor."
  } >&2
  return 2
}

# --- G6: test cases are never silently LOST -----------------------------------------------
guard_case_loss() {
  has_token 'REGISTRY-RETIRE:' && { echo "[G6] retirement declared via REGISTRY-RETIRE" >&2; return 0; }
  local reg
  reg="$(echo "$CHANGED" | grep -E 'tests/cases/.*\.(md|csv|tsv)$' | head -1)"
  [ -z "$reg" ] && return 0
  command -v git >/dev/null 2>&1 || { echo "[G6] SKIPPED - git unavailable" >&2; return 0; }

  local ids_before ids_after lost
  # Commit mode compares HEAD to the index; push mode compares the range base to its HEAD.
  if [ -n "${PRE_PUSH_RANGE:-}" ]; then
    ids_before="$(git show "${PRE_PUSH_RANGE%%..*}:$reg" 2>/dev/null | grep -oE '\b[A-Z]{2,6}-[A-Z]{2,6}-[0-9]{1,5}\b' | sort -u)"
    [ -z "$ids_before" ] && return 0
    ids_after="$(git show "HEAD:$reg" 2>/dev/null | grep -oE '\b[A-Z]{2,6}-[A-Z]{2,6}-[0-9]{1,5}\b' | sort -u)"
  else
    ids_before="$(git show "HEAD:$reg" 2>/dev/null | grep -oE '\b[A-Z]{2,6}-[A-Z]{2,6}-[0-9]{1,5}\b' | sort -u)"
    [ -z "$ids_before" ] && return 0
    ids_after="$(git show ":$reg" 2>/dev/null | grep -oE '\b[A-Z]{2,6}-[A-Z]{2,6}-[0-9]{1,5}\b' | sort -u)"
  fi
  lost="$(comm -23 <(echo "$ids_before") <(echo "$ids_after") 2>/dev/null)"
  [ -z "$lost" ] && return 0
  {
    echo "BLOCKED [G6] Test case IDs present in the previous registry are missing from this one:"
    echo "$lost" | sed 's/^/    /'
    echo "  The usual cause is a registry regenerated from a STALE checkout, which silently"
    echo "  deletes rows other people merged in the meantime. The fix is to re-read the CURRENT"
    echo "  registry and re-apply your additions to it - never to force the commit through."
    echo "  A genuine retirement (the FEATURE was removed) is declared, and IDs are never reused:"
    echo "      REGISTRY-RETIRE: <IDs> - <reason>"
  } >&2
  return 2
}

# --- G7: the type backlog may only SHRINK -------------------------------------------------
guard_type_ratchet() {
  has_token 'TYPES-NA:' && { echo "[G7] escaped via TYPES-NA" >&2; return 0; }
  echo "$CHANGED" | grep -qE '\.(ts|tsx)$' || return 0

  local dir=starter
  [ -f tsconfig.json ] && dir=.
  [ -d "$dir/node_modules" ] || { echo "[G7] SKIPPED - dependencies absent, cannot type-check" >&2; return 0; }
  local baseline="$dir/.baselines/tsc-baseline.txt"
  [ -f "$baseline" ] || { echo "[G7] SKIPPED - no baseline at $baseline. Create: bash $FW/scripts/hooks/tsc-baseline.sh" >&2; return 0; }
  # A bare `npx tsc` with no local TypeScript FETCHES an unrelated registry package of that
  # name and runs it. Absent tool means SKIP, loudly - never an install, never a block.
  [ -x "$dir/node_modules/.bin/tsc" ] || { echo "[G7] SKIPPED - no local tsc in $dir/node_modules. Install typescript, then re-run." >&2; return 0; }

  local tmp; tmp="$(mktemp -d)" || { echo "[G7] SKIPPED - no temp dir" >&2; return 0; }
  # Signature excludes line/column ON PURPOSE: inserting a line above a known error is not a
  # new error, and a ratchet that says otherwise gets switched off within a day.
  ( cd "$dir" && npx tsc --noEmit 2>&1 || true ) \
    | sed -nE 's/^(.+)\([0-9]+,[0-9]+\): error (TS[0-9]+).*/\1|\2/p' | sort -u > "$tmp/now"
  grep -v '^#' "$baseline" | grep -v '^$' | sort -u > "$tmp/base"

  local added removed
  added="$(comm -13 "$tmp/base" "$tmp/now")"
  removed="$(comm -23 "$tmp/base" "$tmp/now")"
  rm -rf "$tmp"

  if [ -n "$added" ]; then
    { echo "BLOCKED [G7] New type error signature(s):"; echo "$added" | sed 's/^/    /'
      echo "  The deploy build strips types WITHOUT checking them, so a real compile error"
      echo "  otherwise rides a green build to production. Escape: 'TYPES-NA: <reason>'."; } >&2
    return 2
  fi
  if [ -n "$removed" ]; then
    { echo "BLOCKED [G7] Type errors FIXED but still listed in the baseline:"; echo "$removed" | sed 's/^/    /'
      echo "  A ratchet must shrink when it is paid down, or a regression can hide inside it."
      echo "  Fix: bash $FW/scripts/hooks/tsc-baseline.sh   then stage the baseline."; } >&2
    return 2
  fi
  return 0
}

main() {
  guard_test_cases  || return $?
  guard_case_loss   || return $?
  guard_type_ratchet|| return $?
  guard_gate_ledger || return $?
  guard_fail_first  || return $?
  guard_theme_sync  || return $?
  guard_docs_touched|| return $?
  return 0
}

main
exit $?
