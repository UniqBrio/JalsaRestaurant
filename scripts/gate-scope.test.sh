#!/usr/bin/env bash
# gate-scope.test.sh - EXECUTE the gate runner and prove it tells the truth about its SUBJECT:
# which directory it judged, and which tree it actually verified.
#
# WHY THIS SUITE EXISTS - PART ONE: WHICH DIRECTORY
#   The runner already separates the CHECKER's location (FRAMEWORK) from the SUBJECT's (ROOT):
#   an earlier incident had every gate report "Cannot find module" because a step's own script
#   was resolved against the app. That fix answered "where does the checker live". It never
#   answered the second question: within the subject, WHERE IS THE APPLICATION?
#
#   In the framework repository the application is `starter/`; in a scaffolded app it is the
#   root. `scripts/lib/layout.mjs` exists to answer exactly that, and every audit imports it.
#   The gate runner was the one consumer that did not, so G5-G8 ran `tsc`, `eslint` and the
#   test scripts against the framework root - a directory with no tsconfig, no eslint config
#   and no test scripts, because none of those things are the framework's.
#
#   The result was not a wrong answer, which would have been noticed. It was BLOCKED, forever:
#   24 of the 27 runs recorded in TEST_SUMMARY.md, always the same four steps. A verdict that
#   never changes carries no information, and the runner's own header names the cost - "a gate
#   that cries wolf about the environment is a gate people learn to ignore".
#
#   BLOCKED is still the right verdict when the toolchain is genuinely absent. What must be
#   true is that the step was aimed at the right directory and said so.
#
# WHY THIS SUITE EXISTS - PART TWO: WHICH TREE
#   The runner writes a fingerprint of the tree it gated, so a later run can say "this verdict
#   was already known". It wrote that fingerprint after ANY run - including one narrowed by
#   --only, which examined two steps out of eleven and knows nothing about the other nine.
#
#   The suites in this repository drive the real runner with --only against the framework root.
#   So: gate a tree, edit a file, run `npm run guard:test`, gate again - and the second run,
#   which was mandatory, announced itself avoidable on a tree no gate had ever judged. The
#   suites were not misusing the runner; the runner was recording a claim its run did not
#   support. Cases 8-10 hold that shut, from both ends.
#
# Run: bash scripts/gate-scope.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNNER="$ROOT/scripts/gate-runner.mjs"
PASS=0; FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

node -e '1' >/dev/null 2>&1 || { echo "SKIPPED - no node interpreter" >&2; exit 0; }
[ -f "$RUNNER" ] || { echo "SKIPPED - no gate-runner.mjs at $RUNNER" >&2; exit 0; }

echo "gate-scope"
check()  { if grep -qE "$2" "$1"; then echo "  PASS  $3"; PASS=$((PASS+1)); else echo "  FAIL  $3 (no match: $2)"; FAIL=$((FAIL+1)); fi; }
refute() { if grep -qE "$2" "$1"; then echo "  FAIL  $3 (matched what it must not: $2)"; FAIL=$((FAIL+1)); else echo "  PASS  $3"; PASS=$((PASS+1)); fi; }

# --- A. The framework repository: the application is starter/. -----------------------------
FW_OUT="$TMP/fw.txt"
node "$RUNNER" --cwd "$ROOT" --only G1,G5 --summary "$TMP/FW.md" --logdir "$TMP/fw-logs" >"$FW_OUT" 2>&1

# 1. The report NAMES the directory the application steps were aimed at. Without this the
#    reader cannot tell a real toolchain gap from the runner looking in the wrong place -
#    which is precisely the confusion that let this sit for 24 runs.
check "$FW_OUT" 'Application steps ran in .*starter' "the report names starter/ as the application subtree"

# 2. G1 still passes. The subject split must not disturb the framework-side steps.
check "$FW_OUT" '\*\*G1 .*\*\* - PASS' "a framework-side step is unaffected by the split"

# 3. When G5 is BLOCKED it is because the TOOLCHAIN is absent, never because the runner
#    looked for the application in a directory that is not one. The remediation must name
#    where to install, or it sends the reader to the wrong package.json.
if grep -qE '\*\*G5 Types\*\* - BLOCKED' "$FW_OUT"; then
  check "$FW_OUT" 'no local "tsc" in .*starter' "a blocked G5 names the application directory to install in"
else
  check "$FW_OUT" '\*\*G5 Types\*\* - (PASS|FAIL)' "G5 actually executed against the application"
fi

# 4. The gate must never claim the framework root as the application when a starter/ exists.
refute "$FW_OUT" 'Application steps ran in \.$' "the framework root is not mistaken for the application"

# --- B. A scaffolded app: the application IS the root. --------------------------------------
# The same runner, the same flags, a tree shaped like an app rather than the framework. The
# anchor layout.mjs uses is starter/design/tokens.json - absent here, so the app is the root.
APP="$TMP/app"
mkdir -p "$APP/design" "$APP/src/theme" "$APP/src/lib"
cp "$ROOT/starter/design/tokens.json" "$APP/design/tokens.json"
# One real source file, so a ratchet has something to PARSE. Without it the detector reports
# "no readable input" - correctly, and before it ever looks for a baseline - and case 13 would
# be asserting on the wrong branch.
printf 'export const probe = 1;\n' > "$APP/src/lib/probe.ts"
# --public is not passed on purpose: it must default to the directory beside these
# tokens, which is this app's. If it ever defaults to the caller's instead, this line
# writes into the real starter and case 6 fails - which is how that was found.
node "$ROOT/scripts/theme-build.mjs" --tokens "$APP/design/tokens.json" --out "$APP/src/theme" >/dev/null 2>&1
# A real repository, because the tree fingerprint is derived from git. Without a HEAD there is
# no fingerprint at all, and cases 8-11 would pass vacuously - agreeing that nothing was
# recorded because nothing could be. A test that cannot fail is not evidence.
( cd "$APP" && git init -q . && git config user.email t@t.t && git config user.name t \
    && git add -A && git commit -qm fixture ) >/dev/null 2>&1
if ! ( cd "$APP" && git rev-parse HEAD >/dev/null 2>&1 ); then
  echo "SKIPPED - git unavailable, cannot exercise the tree fingerprint" >&2; exit 0
fi
APP_OUT="$TMP/app.txt"
( cd "$APP" && node "$RUNNER" --cwd . --only G1,G5 --summary "$TMP/APP.md" --logdir "$TMP/app-logs" >"$APP_OUT" 2>&1 )

# 5. In an app there is no starter/ to descend into, so the application is the root itself.
check "$APP_OUT" 'Application steps ran in \.$' "a scaffolded app uses its own root as the application"

# 6. And G1 - the same checker, from the app's own directory - passes there too. This is the
#    scaffolded app's very first gate run, and it must not open on a false DRIFT.
check "$APP_OUT" '\*\*G1 .*\*\* - PASS' "a scaffolded app's first gate run is not a false DRIFT"

# --- C. The three-valued contract is untouched. ---------------------------------------------
# 7. No flag may produce green: this run selected two steps, so the rest are BLOCKED and the
#    verdict cannot be PASS.
refute "$FW_OUT" 'VERDICT: PASS' "a partial --only run still cannot report PASS"

# --- D. A narrowed run may not record that the TREE was verified. ---------------------------
# The scenario end-to-end, in the app tree built above so the real repository is never touched.
FP="$TMP/fp-logs"
# 8. A full run records the tree it gated - that is the feature, and it must still work.
( cd "$APP" && node "$RUNNER" --cwd . --summary "$TMP/FP1.md" --logdir "$FP" >/dev/null 2>&1 )
[ -f "$FP/last-tree.txt" ] \
  && ok8=1 || ok8=0
if [ "$ok8" = 1 ]; then echo "  PASS  a full run records the tree it verified"; PASS=$((PASS+1));
else echo "  FAIL  a full run records the tree it verified"; FAIL=$((FAIL+1)); fi

# 9. Now change the tree and run a NARROWED gate. It must leave the record alone: it verified
#    two steps, not the tree, and a stale record is better than a false one.
before="$(cat "$FP/last-tree.txt")"
printf '\n/* edit */\n' >> "$APP/src/theme/tokens.generated.css"
( cd "$APP" && node "$RUNNER" --cwd . --only G2 --summary "$TMP/FP2.md" --logdir "$FP" >/dev/null 2>&1 )
if [ "$(cat "$FP/last-tree.txt")" = "$before" ]; then
  echo "  PASS  a narrowed run does not record the tree as verified"; PASS=$((PASS+1))
else
  echo "  FAIL  a narrowed run does not record the tree as verified"; FAIL=$((FAIL+1))
fi

# 10. ...so the next FULL run on that changed tree is NOT announced as avoidable. This is the
#     symptom a reader meets, and the reason the notice is worth anything: a redundancy notice
#     that fires on mandatory runs is one people learn to scroll past.
FP_OUT="$TMP/fp3.txt"
( cd "$APP" && node "$RUNNER" --cwd . --summary "$TMP/FP3.md" --logdir "$FP" >"$FP_OUT" 2>&1 )
refute "$FP_OUT" 'This run was avoidable' "a genuinely new tree is never called avoidable"

# 11. And the notice still FIRES when it should - re-gating the same bytes really is avoidable.
#     A fix that silences a true signal has traded one wrong answer for another.
FP_OUT4="$TMP/fp4.txt"
( cd "$APP" && node "$RUNNER" --cwd . --summary "$TMP/FP4.md" --logdir "$FP" >"$FP_OUT4" 2>&1 )
check "$FP_OUT4" 'This run was avoidable' "re-gating an unchanged tree is still called avoidable"

# 12. --logdir keeps a harness OUT of the subject's own log directory, so no later run reads a
#     step log describing a run nobody performed. Asserted on the NAMED directory and on the
#     absence of the default one: "a log exists somewhere under the temp tree" would have been
#     satisfied by the unfixed runner writing to $APP/.gate-logs, which is the very thing this
#     case forbids.
if [ -f "$FP/G1.log" ] && [ ! -e "$APP/.gate-logs" ]; then
  echo "  PASS  --logdir diverts step logs away from the subject's .gate-logs"; PASS=$((PASS+1))
else
  echo "  FAIL  --logdir diverts step logs away from the subject's .gate-logs" \
       "(named dir: $([ -f "$FP/G1.log" ] && echo used || echo unused);" \
       "default dir: $([ -e "$APP/.gate-logs" ] && echo written || echo clean))"; FAIL=$((FAIL+1))
fi

# --- E. A step whose check did not RUN is never PASS. ---------------------------------------
# 13. The scratch app above has no baselines at all, so G4 (a ratchet) cannot verify anything
#     there. The gate must say BLOCKED. It said PASS - observed on a real scaffold with no
#     service worker: G12 PASS - because the ratchet exited 0 and the runner believed it.
G4_OUT="$TMP/g4.txt"
( cd "$APP" && node "$RUNNER" --cwd . --only G4 --summary "$TMP/G4.md" --logdir "$TMP/g4-logs" >"$G4_OUT" 2>&1 )
check "$G4_OUT" '\*\*G4 .*\*\* - BLOCKED \([0-9]' "a ratchet with no baseline is BLOCKED at the gate, with a duration (it ran)"
refute "$G4_OUT" '\*\*G4 .*\*\* - PASS' "...and is never PASS"
check "$G4_OUT" 'G4 .*no baseline' "...and the reason names the missing baseline"

# --- F. The gate reads its own ledger, so a verdict that never changes becomes visible. -------
# 14. RC-009 sat in TEST_SUMMARY.md for 24 consecutive runs - same four steps, same verdict -
#     and nothing noticed, because nothing reads that file for a TREND. The runner prepends to
#     it; it can read it. Seed a ledger with three prior runs where G4 was BLOCKED and run once
#     more: the report must say how long this has been going on.
LEDGER="$TMP/trend.md"
{ printf '# Test summary\n\n_Newest run first._\n\n---\n\n'
  for i in 1 2 3; do printf '## Gate run - 2026-09-0%s - VERDICT: BLOCKED\n\n- **G4 No hard-coded colours** - BLOCKED (40ms) - no baseline\n- **G1 Theme artifacts in sync** - PASS (40ms)\n\n---\n\n' "$i"; done
} > "$LEDGER"
TR_OUT="$TMP/trend.txt"
( cd "$APP" && node "$RUNNER" --cwd . --only G4 --summary "$LEDGER" --logdir "$TMP/tr-logs" >"$TR_OUT" 2>&1 )
check "$TR_OUT" 'G4 .*BLOCKED .*(4|four) consecutive' "a step blocked for the 4th run in a row says so"
# 15. ...but a step BLOCKED only by this run's own --only flag is not a trend - the ledger's
#     runs did not block it, and a --only run is not evidence about the steps it skipped.
refute "$TR_OUT" 'G1 .*consecutive' "a step blocked by --only alone is not reported as a trend"

echo "  ---- $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
