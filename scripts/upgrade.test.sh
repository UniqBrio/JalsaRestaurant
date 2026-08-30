#!/usr/bin/env bash
# upgrade.test.sh - EXECUTE the lineage + upgrade tooling against scratch apps.
#
# The behaviour rung for EVOLUTION_PLAN.md WS2/WS3. Each case pins one clause of the three-way
# contract, and the dangerous ones were observed FAILING first (see TEST_SUMMARY.md FAIL-FIRST
# entries) - a test never observed failing is not evidence that it can fail.
set -uo pipefail
FW="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0

expect() { # <label> <want-exit> <got-exit>
  if [ "$3" -eq "$2" ]; then echo "  PASS  $1 (exit $3)"; PASS=$((PASS+1))
  else echo "  FAIL  $1 (expected $2, got $3)"; FAIL=$((FAIL+1)); fi
}
check() { # <label> <condition-result 0/1>
  if [ "$2" -eq 0 ]; then echo "  PASS  $1"; PASS=$((PASS+1))
  else echo "  FAIL  $1"; FAIL=$((FAIL+1)); fi
}

# A miniature framework: VERSION + a two-file seed. Small on purpose - the contract under test
# is the three-way rule, not the real starter's size.
mkfw() {
  local d; d="$(mktemp -d)"
  mkdir -p "$d/scripts/lib" "$d/starter/src/lib" "$d/starter/design"
  cp "$FW/scripts/lineage.mjs" "$FW/scripts/upgrade.mjs" "$d/scripts/"
  cp "$FW/scripts/lib/lineage.mjs" "$d/scripts/lib/"
  echo "1.0.0" > "$d/VERSION"
  printf '# Upgrade Log\n\n## 1.1.0 - test - MINOR\n\nseed change.\n\n## 1.0.0 - test\n\ninitial.\n' > "$d/UPGRADES.md"
  echo "export const a = 1;" > "$d/starter/src/lib/a.ts"
  echo '{"brand":"x"}' > "$d/starter/design/tokens.json"
  # A miniature HALF A (the process half): one workflow the app must never edit, and one
  # register the app is EXPECTED to own and fill in.
  mkdir -p "$d/workflows" "$d/docs/registers"
  echo "PROCESS v1" > "$d/workflows/feature.md"
  echo "# Decision Log (framework template)" > "$d/docs/registers/DECISION_LOG.md"
  echo "$d"
}

mkapp() { # <fw> -> app dir, scaffolded by hand + lineage --init, committed
  local fw="$1" d; d="$(mktemp -d)"
  mkdir -p "$d/src/lib" "$d/design"
  cp "$fw/starter/src/lib/a.ts" "$d/src/lib/"
  cp "$fw/starter/design/tokens.json" "$d/design/"
  ( cd "$d"; git init -q .; git config user.email t@t.t; git config user.name t
    node "$fw/scripts/lineage.mjs" --init --framework "$fw" >/dev/null
    # --init stamps initMode:'adopted-existing-app'; new-app.mjs does NOT. This helper stands in
    # for a SCAFFOLDED app, so strip it - otherwise the fixture quietly tests the adopted path
    # while claiming to test the scaffolded one, and those two now differ on purpose.
    node -e "const f='.framework/lineage.json',fs=require('fs');const l=JSON.parse(fs.readFileSync(f));delete l.initMode;l.mode='workspace';fs.writeFileSync(f,JSON.stringify(l,null,2))"
    git add -A >/dev/null; git commit -qm init >/dev/null )
  echo "$d"
}

mkapp_standalone() { # <fw> -> app with a COPIED process half (new-app.mjs --standalone)
  local fw="$1" d; d="$(mktemp -d)"
  mkdir -p "$d/src/lib" "$d/design" "$d/scripts/audits" "$d/workflows" "$d/docs/registers"
  cp "$fw/starter/src/lib/a.ts" "$d/src/lib/"
  cp "$fw/starter/design/tokens.json" "$d/design/"
  cp "$fw/workflows/feature.md" "$d/workflows/"
  cp "$fw/docs/registers/DECISION_LOG.md" "$d/docs/registers/"
  # The app fills in its OWN register - this content must survive every upgrade, forever.
  echo "MY-APP-DECISION-KEEP-ME" >> "$d/docs/registers/DECISION_LOG.md"
  ( cd "$d"; git init -q .; git config user.email t@t.t; git config user.name t
    node "$fw/scripts/lineage.mjs" --init --framework "$fw" >/dev/null
    git add -A >/dev/null; git commit -qm init >/dev/null )
  echo "$d"
}

mkapp_adopted() { # <fw> -> an app that PREDATES the framework: different layout, adopted via --init
  local fw="$1" d; d="$(mktemp -d)"
  mkdir -p "$d/src/lib"
  # Deliberately NOT the seed's shape: this app has its own file and none of the seed's.
  echo "export const mine = true;" > "$d/src/lib/my-own-thing.js"
  ( cd "$d"; git init -q .; git config user.email t@t.t; git config user.name t
    node "$fw/scripts/lineage.mjs" --init --framework "$fw" >/dev/null
    git add -A >/dev/null; git commit -qm init >/dev/null )
  echo "$d"
}

bump() { # <fw>: framework moves to 1.1.0 and changes the seed
  echo "1.1.0" > "$1/VERSION"
  echo "export const a = 2; // improved" > "$1/starter/src/lib/a.ts"
  echo '{"brand":"NEW-DEFAULT"}' > "$1/starter/design/tokens.json"
  echo "export const brandNew = true;" > "$1/starter/src/lib/b.ts"
  echo "PROCESS v2 - improved" > "$1/workflows/feature.md"
  echo "# Decision Log (framework template, reworded)" > "$1/docs/registers/DECISION_LOG.md"
}

echo "lineage"
fw=$(mkfw); app=$(mkapp "$fw")
( cd "$app" && node "$fw/scripts/lineage.mjs" --status >/dev/null 2>&1 ); expect "status runs on an initialised app" 0 $?
( cd "$(mktemp -d)" && node "$fw/scripts/lineage.mjs" --status >/dev/null 2>&1 ); expect "status refuses an untracked dir" 2 $?

echo "upgrade: the three-way rule"
fw=$(mkfw); app=$(mkapp "$fw"); bump "$fw"
( cd "$app" && node "$fw/scripts/upgrade.mjs" --framework "$fw" >/dev/null 2>&1 ); expect "dry-run exits 0 and changes nothing" 0 $?
grep -q "export const a = 1" "$app/src/lib/a.ts"; check "dry-run really changed nothing" $?

( cd "$app" && node "$fw/scripts/upgrade.mjs" --framework "$fw" --apply >/dev/null 2>&1 ); expect "apply succeeds on a clean tree" 0 $?
grep -q "export const a = 2" "$app/src/lib/a.ts";        check "PRISTINE file was auto-updated" $?
[ -f "$app/src/lib/b.ts" ];                               check "NEW seed file arrived" $?
grep -q '"brand":"x"' "$app/design/tokens.json";          check "EXPECTED-DIVERGENT file untouched" $?
grep -q "1.1.0" "$app/.framework/lineage.json";           check "lineage version advanced" $?
[ -f "$app/FRAMEWORK_ADOPTION.md" ] && grep -q "1.1.0" "$app/FRAMEWORK_ADOPTION.md"; check "adoption log written" $?

echo "upgrade: a MODIFIED file is never overwritten"
fw=$(mkfw); app=$(mkapp "$fw")
echo "export const a = 1; // my precious app change" > "$app/src/lib/a.ts"
( cd "$app"; git add -A >/dev/null; git commit -qm change >/dev/null )
bump "$fw"
( cd "$app" && node "$fw/scripts/upgrade.mjs" --framework "$fw" --apply >/dev/null 2>&1 ); expect "apply still succeeds" 0 $?
grep -q "my precious app change" "$app/src/lib/a.ts";     check "the app's edit SURVIVED" $?
[ -f "$app/.framework/incoming/src/lib/a.ts" ];           check "incoming copy staged for review" $?
grep -q "export const a = 2" "$app/.framework/incoming/src/lib/a.ts"; check "incoming copy is the NEW seed" $?

echo "lineage --refresh closes the loop after a hand-merge"
cp "$app/.framework/incoming/src/lib/a.ts" "$app/src/lib/a.ts"   # human 'merges'
( cd "$app" && node "$fw/scripts/lineage.mjs" --refresh src/lib/a.ts --framework "$fw" >/dev/null 2>&1 )
expect "refresh accepts the merged file" 0 $?
[ ! -f "$app/.framework/incoming/src/lib/a.ts" ];         check "incoming copy cleaned up" $?

echo "upgrade: HALF A reaches a standalone app (and never eats its registers)"
fw=$(mkfw); app=$(mkapp_standalone "$fw"); bump "$fw"
( cd "$app" && node "$fw/scripts/upgrade.mjs" --framework "$fw" --apply >/dev/null 2>&1 ); expect "apply succeeds for a standalone app" 0 $?
grep -q "PROCESS v2" "$app/workflows/feature.md";          check "PROCESS file refreshed wholesale" $?
grep -q "MY-APP-DECISION-KEEP-ME" "$app/docs/registers/DECISION_LOG.md"; check "the app's REGISTER survived (expected-divergent)" $?
[ -f "$app/scripts/lineage.mjs" ];                          check "framework scripts arrived with the process half" $?
grep -q "Half A" "$app/FRAMEWORK_ADOPTION.md";              check "adoption log records the process refresh" $?

echo "upgrade: a WORKSPACE app links the process half - nothing is copied into it"
fw=$(mkfw); app=$(mkapp "$fw")
printf '{"framework":"..","halfA":["workflows"]}' > "$app/.framework-link.json"
( cd "$app"; git add -A >/dev/null; git commit -qm link >/dev/null )
bump "$fw"
( cd "$app" && node "$fw/scripts/upgrade.mjs" --framework "$fw" --apply >/dev/null 2>&1 ); expect "apply succeeds for a workspace app" 0 $?
[ ! -f "$app/workflows/feature.md" ];                       check "no process copy was made into a linked app" $?
grep -q "export const a = 2" "$app/src/lib/a.ts";           check "the SEED half still upgraded normally" $?

echo "upgrade: an ADOPTED app is OFFERED new seed files, never given them"
fw=$(mkfw); app=$(mkapp_adopted "$fw"); bump "$fw"
( cd "$app" && node "$fw/scripts/upgrade.mjs" --framework "$fw" --apply >/dev/null 2>&1 ); expect "apply succeeds on an adopted app" 0 $?
[ ! -f "$app/src/lib/a.ts" ];                    check "seed file NOT auto-copied into an adopted app" $?
[ -f "$app/.framework/incoming/src/lib/a.ts" ];  check "it was OFFERED in .framework/incoming instead" $?
grep -q "export const mine = true" "$app/src/lib/my-own-thing.js"; check "the app's own file is untouched" $?
( cd "$app" && node "$fw/scripts/upgrade.mjs" --framework "$fw" 2>&1 | grep -q "OFFERED" ); check "the plan says OFFERED, not 'new files'" $?

echo "upgrade: a SCAFFOLDED app still receives new seed files automatically"
fw=$(mkfw); app=$(mkapp "$fw"); bump "$fw"
( cd "$app" && node "$fw/scripts/upgrade.mjs" --framework "$fw" --apply >/dev/null 2>&1 )
[ -f "$app/src/lib/b.ts" ];                      check "new seed file auto-applied (adoption rule did NOT leak)" $?

echo "lineage --refresh accepts a TAKEN offer (an untracked file the seed has)"
fw=$(mkfw); app=$(mkapp_adopted "$fw"); bump "$fw"
( cd "$app" && node "$fw/scripts/upgrade.mjs" --framework "$fw" --apply >/dev/null 2>&1 )
mkdir -p "$app/src/lib" && cp "$app/.framework/incoming/src/lib/a.ts" "$app/src/lib/a.ts"   # human takes the offer
( cd "$app" && node "$fw/scripts/lineage.mjs" --refresh src/lib/a.ts --framework "$fw" >/dev/null 2>&1 )
expect "refresh records the taken offer" 0 $?
grep -q '"src/lib/a.ts"' "$app/.framework/lineage.json"; check "the taken file is now tracked" $?
# b.ts was never taken, so the OFFERED section legitimately remains - the assertion is that
# a.ts SPECIFICALLY left it. (First version of this test grepped for the heading and failed
# against its own fixture.)
( cd "$app" && node "$fw/scripts/upgrade.mjs" --framework "$fw" 2>&1 | grep -q "? src/lib/a.ts" ); \
  if [ $? -ne 0 ]; then echo "  PASS  a taken offer is not offered again"; PASS=$((PASS+1));
  else echo "  FAIL  a taken offer is not offered again"; FAIL=$((FAIL+1)); fi
( cd "$app" && node "$fw/scripts/lineage.mjs" --refresh no/such/file.ts --framework "$fw" >/dev/null 2>&1 )
expect "a typo is still refused" 2 $?

echo "lineage --decline stops an offer being repeated forever"
fw=$(mkfw); app=$(mkapp_adopted "$fw"); bump "$fw"
( cd "$app" && node "$fw/scripts/upgrade.mjs" --framework "$fw" --apply >/dev/null 2>&1 )
( cd "$app" && node "$fw/scripts/lineage.mjs" --decline src/lib/a.ts >/dev/null 2>&1 ); expect "decline is accepted" 0 $?
[ ! -f "$app/.framework/incoming/src/lib/a.ts" ]; check "the declined incoming copy is cleaned up" $?
( cd "$app" && node "$fw/scripts/upgrade.mjs" --framework "$fw" 2>&1 | grep -q "src/lib/a.ts" ); \
  if [ $? -ne 0 ]; then echo "  PASS  a declined file is never offered again"; PASS=$((PASS+1));
  else echo "  FAIL  a declined file is never offered again"; FAIL=$((FAIL+1)); fi

echo "upgrade: safety rails"
fw=$(mkfw); app=$(mkapp "$fw"); bump "$fw"
echo "uncommitted" > "$app/scratch.txt"
( cd "$app" && node "$fw/scripts/upgrade.mjs" --framework "$fw" --apply >/dev/null 2>&1 ); expect "apply REFUSES a dirty tree" 2 $?
d=$(mktemp -d); mkdir -p "$d/x"
( cd "$d/x" && node "$fw/scripts/upgrade.mjs" --framework "$fw" >/dev/null 2>&1 ); expect "refuses an app with no lineage" 2 $?

echo
echo "$PASS passed, $FAIL failed."
[ "$FAIL" -eq 0 ] || exit 1
