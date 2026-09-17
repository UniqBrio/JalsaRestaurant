#!/usr/bin/env bash
# supabase-safety.test.sh - EXECUTE the large-data safety audit against every shape it must accept
# and every shape it must reject (CP-34, docs/28).
#
# WHY THIS SUITE EXISTS
#   The audit's claim is that an unbounded Supabase read cannot reach the gate unnoticed, and
#   that the three sanctioned shapes pass without ceremony. Both halves matter equally: a
#   detector that rejects the correct shapes is switched off in a week, after which it rejects
#   nothing. So the first cases here are the ones that must PASS.
#
#   The unit spec (starter/tests/unit/supabase-safety.unit.spec.ts) covers the helper's runtime
#   contract - empty-page termination, throw on error, the truncation guard, the four UI states.
#   This suite covers what can be decided from SOURCE.
#
# Run: bash scripts/supabase-safety.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
node -e '1' >/dev/null 2>&1 || { echo "SKIPPED - no node interpreter" >&2; exit 0; }
AUDIT="$ROOT/scripts/audits/check-supabase-reads.mjs"
[ -f "$AUDIT" ] || { echo "SKIPPED - audit absent" >&2; exit 0; }

APP="$TMP/app"
reset() {
  rm -rf "$APP"; mkdir -p "$APP/src/lib/data" "$APP/src/components" "$APP/api" "$APP/.baselines"
  # An adopting app always carries a baseline (upgrade.mjs writes one). Without it the ratchet
  # correctly reports BLOCKED (exit 3), which would fail every "passes" case for the wrong reason.
  ( cd "$APP" && node "$AUDIT" --dir . --write-baseline >/dev/null 2>&1 )
}
src() { printf '%s\n' "$2" > "$APP/$1"; }   # <relpath> <content>
report() { ( cd "$APP" && node "$AUDIT" --dir . --report 2>&1 ); }
gate()   { ( cd "$APP" && node "$AUDIT" --dir . >/dev/null 2>&1; echo $? ); }
expect_risk() { # <label> <pattern-in-report>
  local out; out="$(report)"
  if printf '%s' "$out" | grep -qE "$2"; then echo "  PASS  $1"; PASS=$((PASS+1))
  else echo "  FAIL  $1 - no line matching /$2/:"; printf '%s\n' "$out" | sed 's/^/          /'; FAIL=$((FAIL+1)); fi
}
expect_exit() { if [ "$3" = "$2" ]; then echo "  PASS  $1 (exit $3)"; PASS=$((PASS+1)); else echo "  FAIL  $1 (expected $2, got $3)"; FAIL=$((FAIL+1)); fi; }

echo "supabase-safety"

# ---- ACCEPTED SHAPES FIRST.
reset; src src/lib/data/members.ts "export const total = () => supabase.from('members').select('*', { count: 'exact', head: true });"
expect_risk "1  aggregation (count, head:true) is SAFE"                      "SAFE +src/lib/data/members.ts:1 +from\(members\)"
expect_exit "1  ...exit 0" 0 "$(gate)"
reset; src src/lib/data/stats.ts "export const s = () => supabase.rpc('member_count_by_status', { academy });"
expect_risk "1b aggregating RPC by name is SAFE"                                "SAFE +src/lib/data/stats.ts:1 +rpc\(member_count_by_status\)"
reset; src src/lib/data/list.ts "export const page = () => supabase.from('members').select('id,name').order('id').limit(50);"
expect_risk "2  bounded + ordered list read is SAFE"                          "SAFE +src/lib/data/list.ts:1"
reset; src src/lib/data/all.ts "import { pageAllByKey } from '../supabase-safety';
export const all = () => pageAllByKey({ pageSize: 200, keyOf: (r) => r.id,
  fetchPage: (after, n) => supabase.from('members').select('*').order('id').gt('id', after ?? 0).limit(n) });"
expect_risk "3  keyset pagination through the approved helper is SAFE"         "SAFE +src/lib/data/all.ts"
reset; src src/lib/data/f.ts "// SUPABASE-BOUND: one venue has at most 40 tables (physical) | max 40 rows | A. Owner 2026-09-14
export const tables = () => supabase.from('tables').select('*').eq('venue_id', v);"
expect_risk "SAFE-BY-FILTER needs constraint + max rows + authority, and gets it"  "SAFE-BY-FILTER +src/lib/data/f.ts"
expect_exit "...exit 0" 0 "$(gate)"

# ---- REJECTED SHAPES.
reset; src src/lib/data/u.ts "export const all = () => supabase.from('attendance').select('*').eq('academy_id', a);"
expect_risk "7  unbounded read with a filter is UNKNOWN - a filter is not a bound"  "UNKNOWN +src/lib/data/u.ts:1 +from\(attendance\)"
expect_exit "7  ...HARD, exit 2" 2 "$(gate)"
( cd "$APP" && node "$AUDIT" --dir . --write-baseline >/dev/null 2>&1 )
expect_exit "7  ...still exit 2 after --write-baseline: an unsafe read is not debt" 2 "$(gate)"
reset; src src/lib/data/r.ts "export const all = () => supabase.rpc('list_members_for_academy', { a });"
expect_risk "8  unbounded set-returning RPC is UNKNOWN - no RPC exemption"         "UNKNOWN +src/lib/data/r.ts:1 +rpc\(list_members_for_academy\)"
reset; src src/lib/data/o.ts "export async function all() { const out = []; for (let page = 0; ; page++) {
  const { data } = await supabase.from('members').select('*').order('id').range(page * 100, page * 100 + 99);
  if (!data || data.length < 100) break; out.push(...data); } return out; }"
expect_risk "6  offset traversal in a loop is rejected"                            "OFFSET TRAVERSAL"
expect_risk "5  short-page termination is rejected"                               "SHORT-PAGE TERMINATION"
reset; src src/lib/data/e.ts "export const n = () => supabase.from('members').select('*', { count: 'estimated' }).order('id').limit(50);"
expect_risk "10 an estimated count cannot establish completeness"                 "ESTIMATED COUNT"
reset; src src/lib/data/n.ts "export async function fill(rows) { for (const r of rows) {
  const { data } = await supabase.from('profiles').select('*').eq('id', r.id); r.p = data; } }"
expect_risk "11 N+1 read inside a loop is detected"                               "N\+1 READ IN A LOOP"
reset; src src/lib/data/cr.ts "const res = await fetch(url); const cr = res.headers.get('content-range'); const truncated = cr?.endsWith('/*');
export const x = () => supabase.from('members').select('*').order('id').limit(50);"
expect_risk "Content-Range /* read as truncation evidence is rejected"            "CONTENT-RANGE"
reset; src src/lib/data/nb.ts "export const page = () => supabase.from('members').select('*').limit(50);"
expect_risk "a bound with NO ORDER is UNKNOWN - a different page each time"       "UNKNOWN +src/lib/data/nb.ts.*"
reset; src src/lib/data/ok.ts "export const page = () => supabase.from('members').select('*').order('id').limit(50);"; mkdir -p "$APP/supabase"; printf '[api]\nmax-rows = 5000\n' > "$APP/supabase/config.toml"
expect_risk "raising max-rows is the prohibited fix and is caught"                "CAP RAISED"
reset; src src/lib/data/cap.ts "// SUPABASE-BOUND: one academy | max 1500 rows | A. Owner 2026-09-14
export const m = () => supabase.from('members').select('*').eq('academy_id', a);"
expect_risk "an annotated max AT the cap is BROKEN NOW"                            "BROKEN NOW +src/lib/data/cap.ts"
reset; src src/lib/data/soon.ts "// SUPABASE-BOUND: one academy | max 800 rows | A. Owner 2026-09-14
export const m = () => supabase.from('members').select('*').eq('academy_id', a);"
expect_risk "an annotated max at 80% of the cap is BREAKS SOON (early warning)"    "BREAKS SOON +src/lib/data/soon.ts"
expect_exit "...BREAKS SOON is recorded, not blocking, once accepted" 2 "$(gate)"
( cd "$APP" && node "$AUDIT" --dir . --write-baseline >/dev/null 2>&1 ); expect_exit "...after knowing acceptance: exit 0" 0 "$(gate)"
reset; src src/lib/data/soon.ts "// SUPABASE-BOUND: one academy | max 800 rows | A. Owner 2026-09-14
export const m = () => supabase.from('members').select('*').eq('academy_id', a);"
out="$( cd "$APP" && node "$AUDIT" --dir . --warn-at 0.9 --report 2>&1 )"
if printf '%s' "$out" | grep -qE "SAFE-BY-FILTER +src/lib/data/soon.ts"; then echo "  PASS  12 the warn threshold is configurable (--warn-at 0.9 makes 800 SAFE-BY-FILTER)"; PASS=$((PASS+1)); else echo "  FAIL  12 --warn-at not honoured"; FAIL=$((FAIL+1)); fi

# ---- DATA-LAYER BOUNDARY.
reset; src src/components/Members.tsx "export const M = () => { const q = supabase.from('members').select('*').order('id').limit(20); return null; };"
expect_risk "12 a read outside the data layer is rejected even when bounded"      "OUTSIDE DATA LAYER"
reset; src src/components/Members.tsx "export const M = () => supabase.from('members').select('*').order('id').limit(20);"
printf '{ "dataLayer": ["src/components/**"] }\n' > "$APP/.supabase-safety.json"
expect_risk "12b the data layer is configurable per application"                   "SAFE +src/components/Members.tsx"
reset; src src/components/Ids.ts "export const ids = Array.from(new Set(xs)); export const b = Buffer.from('x');"
out="$(report)"; if printf '%s' "$out" | grep -q "0 read(s)"; then echo "  PASS  Array.from / Buffer.from are not Supabase reads"; PASS=$((PASS+1)); else echo "  FAIL  false positive on Array.from"; FAIL=$((FAIL+1)); fi

# ---- LOW CAP: correct keyset pagination survives a cap of 50 (the audit is cap-aware for bounds).
reset; src src/lib/data/list.ts "export const page = () => supabase.from('members').select('id').order('id').limit(50);"
out="$( cd "$APP" && node "$AUDIT" --dir . --cap 50 --report 2>&1 )"
if printf '%s' "$out" | grep -qE "UNKNOWN +src/lib/data/list.ts"; then echo "  PASS  13 at cap 50, limit(50) is no longer a bound - the low cap exposes it"; PASS=$((PASS+1)); else echo "  FAIL  13 low cap did not expose limit(50)"; FAIL=$((FAIL+1)); fi
reset; src src/lib/data/all.ts "import { pageAllByKey } from '../supabase-safety';
export const all = () => pageAllByKey({ pageSize: 20, keyOf: (r) => r.id, fetchPage: (after, n) => supabase.from('members').select('*').order('id').gt('id', after ?? 0).limit(n) });"
out="$( cd "$APP" && node "$AUDIT" --dir . --cap 50 --report 2>&1 )"
if printf '%s' "$out" | grep -qE "SAFE +src/lib/data/all.ts"; then echo "  PASS  13 at cap 50, keyset pagination is still SAFE"; PASS=$((PASS+1)); else echo "  FAIL  13 keyset broke at low cap"; FAIL=$((FAIL+1)); fi

# ---- NOTHING TO CLASSIFY IS SAID, NOT HIDDEN.
reset; src src/lib/data/none.ts "export const x = 1;"
out="$(report)"; if printf '%s' "$out" | grep -q "no Supabase reads were found"; then echo "  PASS  zero reads is reported loudly, never as a clean bill"; PASS=$((PASS+1)); else echo "  FAIL  zero reads was silent"; FAIL=$((FAIL+1)); fi

# ---- ESLint boundary, in the starter, where the linter is installed. Fail OPEN if it is not.
if [ -d "$ROOT/starter/node_modules/eslint" ]; then
  out="$( cd "$ROOT/starter" && printf "export const q = () => supabase.from('members').select('*');\n" | npx eslint --stdin --stdin-filename src/components/Probe.tsx --no-warn-ignored 2>&1 )"
  if printf '%s' "$out" | grep -q "data layer"; then echo "  PASS  12c ESLint rejects .from( outside the data layer"; PASS=$((PASS+1)); else echo "  FAIL  12c ESLint did not reject:"; printf '%s\n' "$out" | sed 's/^/          /'; FAIL=$((FAIL+1)); fi
  out="$( cd "$ROOT/starter" && printf "export const q = () => supabase.from('members').select('*');\n" | npx eslint --stdin --stdin-filename src/lib/data/probe.ts --no-warn-ignored 2>&1 )"
  if printf '%s' "$out" | grep -q "data layer"; then echo "  FAIL  12d ESLint rejected a read INSIDE the data layer"; FAIL=$((FAIL+1)); else echo "  PASS  12d ESLint allows .from( inside the data layer"; PASS=$((PASS+1)); fi
else
  echo "  SKIPPED  12c/12d ESLint boundary - starter/node_modules absent (fails open, loudly)" >&2
fi

echo "  ---- $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
