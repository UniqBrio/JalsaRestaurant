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
#
# THE THIRD MODE, AND IT WAS A REAL BYPASS (RC-019). An adapter that inspects the INDEX before
# running the command sees an empty index whenever staging happens inside that same command:
#     git add -A && git commit -F msg
# The index is empty when the guard runs, CHANGED is empty, and every guard below is skipped in
# silence - on precisely the one-liner people actually type. GUARD_WORKTREE says "this command
# stages its own changes, so the CHANGE is the working tree, not the index".
if [ -n "${PRE_PUSH_RANGE:-}" ]; then
  CHANGED="$(git diff --name-only "$PRE_PUSH_RANGE" 2>/dev/null)"
elif [ -n "${GUARD_WORKTREE:-}" ]; then
  CHANGED="$(printf '%s\n%s\n' \
    "$(git diff HEAD --name-only 2>/dev/null)" \
    "$(git ls-files --others --exclude-standard 2>/dev/null)" | grep -v '^$' | sort -u)"
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
  elif [ -n "${GUARD_WORKTREE:-}" ]; then
    # Tracked changes against HEAD, plus an untracked file rendered as all-added - otherwise a
    # brand-new TEST_SUMMARY or spec is invisible to the very guards that look for new content.
    git diff -U0 HEAD -- "$1" 2>/dev/null
    if git ls-files --others --exclude-standard -- "$1" 2>/dev/null | grep -q .; then
      sed 's/^/+/' "$1" 2>/dev/null
    fi
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
  elif [ -n "${GUARD_WORKTREE:-}" ]; then
    # A brand-new spec is UNTRACKED when the command stages its own work, so --diff-filter=A
    # against the index finds nothing and G3 excuses the very file it exists to catch.
    added="$( { git diff HEAD --name-only --diff-filter=A 2>/dev/null; \
                git ls-files --others --exclude-standard 2>/dev/null; } \
              | grep -E '\.(spec|test)\.[tj]sx?$' || true)"
  else
    added="$(git diff --cached --name-only --diff-filter=A | grep -E '\.(spec|test)\.[tj]sx?$' || true)"
  fi
  [ -z "$added" ] && return 0

  local evidence
  evidence="$(staged_diff TEST_SUMMARY.md | grep -E '^\+(FAIL-FIRST:|NOT OBSERVED FAILING:)' || true)"
  if [ -z "$evidence" ]; then
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
  fi

  # --- The line must NAME the failure, not merely claim one --------------------------------
  #
  # WHY THIS HALF EXISTS
  #   The message above has asked for "<the failure it produced>" since G3 was written, and the
  #   check accepted anything after the colon - so "FAIL-FIRST: x - red first" passed, and that
  #   is what the fixtures actually said. Five results in one week were green or red for a
  #   reason nobody had looked at: a sweep whose regex matched zero lines, an injected defect
  #   that died with a syntax error so the tool never ran, and twice a new check passing on an
  #   OLDER check's identical exit 2. Every one of them satisfied fail-first.
  #
  #   Proving a test CAN go red is not proving it went red for the stated reason. Naming the
  #   failure is what makes the difference visible - you cannot write "exit 2" twice without
  #   noticing that the rail beside it returns the same thing.
  #
  # WHAT COUNTS
  #   A number (exit code, count, line, measurement) or a quoted fragment of the real message.
  #   Quoting is always available, so the rule is always satisfiable - see docs/15 §6.
  #   `NOT OBSERVED FAILING:` is exempt: it records a REASON, not a failure.
  local ff weak
  ff="$(printf '%s\n' "$evidence" | grep -E '^\+FAIL-FIRST:' || true)"
  if [ -n "$ff" ]; then
    # Weak = the phrases actually seen standing in for evidence, or no signal at all.
    weak="$(printf '%s\n' "$ff" \
      | grep -viE '^\+FAIL-FIRST:.*[-—:].*([0-9]|"[^"]+"|'"'"'[^'"'"']+'"'"')' \
      || true)"
    weak="$weak$(printf '%s\n' "$ff" \
      | grep -iE '[-—:][[:space:]]*"?(red|red first|it failed|failed|fails|was red|test failed|error)"?[[:space:]]*$' \
      || true)"
    if [ -n "$(printf '%s' "$weak" | tr -d '[:space:]')" ]; then
      {
        echo "BLOCKED [G3] fail-first evidence does not NAME the failure:"
        printf '%s\n' "$weak" | sed 's/^+/    /'
        echo "  'red first' says a failure happened. It does not say WHICH, so it cannot show the"
        echo "  failure belonged to THIS check - and a new check passing on an older check's"
        echo "  identical exit code is the way that goes wrong (RC-012, and twice since)."
        echo "  Record an observable signal: an exit code, a count, or the message in quotes."
        echo "      FAIL-FIRST: tests/unit/pricing.unit.spec.ts - \"expected 1200, received 0\""
        echo "      FAIL-FIRST: scripts/ratchet.test.sh - exit 0, not 2 (guard unwired from main)"
        echo "  If the failure signal is shared with an existing check, isolate it first"
        echo "  (escape tokens, a clean precondition, or assert on the message) - docs/15 §6."
        echo "  Genuine exception: 'FAILFIRST-NA: <reason>'."
      } >&2
      return 2
    fi
  fi
  return 0
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
# --- G9: the run left a row in the run log ---------------------------------------------------
# WHY THIS EXISTS
#   `checklists/DEFINITION_OF_DONE.md` has asked for a closed run log since the log existed, and
#   nothing ever checked. Observed in a real app: RUN_LOG.md held ONE row, dated 08-Sep, while
#   three runs shipped on 11-Sep - and that one row was closed with no verdict, no gate figure
#   and no stages.
#
#   TEST_SUMMARY.md does not decay this way, and the reason is not that people care more about
#   it: it is that G2 blocks without it. Two ledgers, one guarded and one not, kept side by side
#   for weeks, is as clean an experiment as this framework will ever get - and the unguarded one
#   emptied out. That is CLAUDE.md's first idea, measured.
#
#   The row matters because it is the only record of what a run COST. Without it "make this
#   faster" is a conversation about impressions, and the first question - was it the tooling or
#   the agent? - has no answer.
guard_run_log() {
  has_token 'RUNLOG-NA:' && { echo "[G9] escaped via RUNLOG-NA" >&2; return 0; }
  code_changed || return 0
  # Fails OPEN and audibly where there is no log: an app that has not adopted the register is
  # not committing a violation, and a guard that blocks it would be uninstalled by lunchtime.
  [ -f docs/registers/RUN_LOG.md ] || { echo "[G9] SKIPPED - no docs/registers/RUN_LOG.md" >&2; return 0; }
  staged_diff docs/registers/RUN_LOG.md | grep -qE '^\+\|[[:space:]]*R-[0-9]' && return 0
  {
    echo "BLOCKED [G9] Application code changed without a new row in docs/registers/RUN_LOG.md."
    echo "  Close the run:  node scripts/run-log.mjs end --verdict <PASS|FAIL|BLOCKED>"
    echo "  If no run was opened, that IS the finding - the duration is now a recalled number."
    echo "  Open one at the START next time; back-fill this one with --started <ISO>, which"
    echo "  marks the row as back-filled rather than quietly presenting it as measured."
    echo "  Genuine exception: 'RUNLOG-NA: <reason>'."
  } >&2
  return 2
}

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

added_files() {
  if [ -n "${PRE_PUSH_RANGE:-}" ]; then git diff --name-only --diff-filter=A "$PRE_PUSH_RANGE" 2>/dev/null
  else git diff --cached --name-only --diff-filter=A; fi
}

# --- G8: a MICRO claim must match the diff ------------------------------------------------
# The micro lane skips the design pass, the QA verdict table and the run document, on the
# strength of one promise: the change really is small. So the CLAIM is verified against the
# DIFF rather than trusted. A lane that can be claimed for anything is not a lane, it is a
# global bypass with a friendlier name - and the whole reason micro is safe is that the things
# it skips do not apply at this size. The moment they apply, the run promotes to scoped.
guard_micro_scope() {
  has_token 'SCALE: micro' || return 0
  has_token 'MICRO-NA:' && { echo "[G8] escaped via MICRO-NA" >&2; return 0; }

  # Tests, docs, the ledger and baselines are close-out ARTIFACTS of the change, not the
  # change itself. Counting them would push every honest micro run over its own limit.
  local src n
  src="$(echo "$CHANGED" | grep -vE '(\.spec\.[jt]sx?$|\.test\.[jt]sx?$|^tests/|/tests/|\.md$|\.baselines/)' || true)"
  n="$(printf '%s\n' "$src" | grep -c '[^[:space:]]' || true)"

  if [ "$n" -gt 2 ]; then
    { echo "BLOCKED [G8] 'SCALE: micro' claimed, but $n source file(s) changed (limit 2):"
      printf '%s\n' "$src" | grep '[^[:space:]]' | sed 's/^/    /'
      echo "  Promote the run to 'SCALE: scoped' and discharge its obligations."
      echo "  Shrinking the process to fit the label is how a lane becomes a bypass."
      echo "  Genuine exception: 'MICRO-NA: <reason>' - e.g. a purely mechanical rename."; } >&2
    return 2
  fi

  if echo "$CHANGED" | grep -qE '(^|/)migrations/|\.sql$'; then
    { echo "BLOCKED [G8] 'SCALE: micro' claimed with a schema change."
      echo "  A migration carries parity, constraint-awareness and rollback obligations that"
      echo "  the micro lane does not run. Promote to 'SCALE: scoped'."; } >&2
    return 2
  fi

  if added_files | grep -qE '(^|/)components/'; then
    { echo "BLOCKED [G8] 'SCALE: micro' claimed while ADDING a component."
      echo "  A new component owes the reuse check, every state, both themes and a keyboard"
      echo "  model. Promote to 'SCALE: scoped'."; } >&2
    return 2
  fi

  if echo "$CHANGED" | grep -qE '(^|/)package\.json$'; then
    { echo "BLOCKED [G8] 'SCALE: micro' claimed with a dependency change."
      echo "  Verifying a dependency exists, is the intended package and is pinned is a"
      echo "  scoped-run obligation. Promote to 'SCALE: scoped'."; } >&2
    return 2
  fi
  return 0
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
  guard_micro_scope || return $?
  guard_test_cases  || return $?
  guard_case_loss   || return $?
  guard_type_ratchet|| return $?
  guard_gate_ledger || return $?
  guard_fail_first  || return $?
  guard_theme_sync  || return $?
  guard_run_log     || return $?
  guard_docs_touched|| return $?
  return 0
}

main
exit $?
