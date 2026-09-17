#!/usr/bin/env bash
# capture-candidate.test.sh - EXECUTE the capture tool, and prove it CANNOT promote.
#
# WHY THIS SUITE EXISTS
#   Automating capture is free; automating promotion is the expensive mistake. A tool that can
#   append a framework rule without the rule of three, the human gate, a rung, a test case and a
#   version bump generates exactly the "rule that nothing executes" this framework refuses -
#   only at machine speed, and with the authority of having been written by a script.
#
#   So the load-bearing assertion here is a NEGATIVE one: case 6 hands the tool the strongest
#   promotion signal it can ever see - a second sighting, from a different app - and then checks
#   that every governed file is byte-identical afterwards. A capability nothing asserts the
#   absence of is a capability that arrives later, quietly, in a refactor.
#
# Run: bash scripts/capture-candidate.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
. "$ROOT/scripts/lib/shpath.sh"   # CP-31: these paths cross into JS source, not argv

CAP="$ROOT/scripts/capture-candidate.mjs"
node -e '1' >/dev/null 2>&1 || { echo "SKIPPED - no node interpreter" >&2; exit 0; }
[ -f "$CAP" ] || { echo "SKIPPED - no capture-candidate.mjs at $CAP" >&2; exit 0; }

ok()  { echo "  PASS  $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL  $1"; FAIL=$((FAIL+1)); }
code_is() { if [ "$1" -eq "$2" ]; then ok "$3 (exit $1)"; else bad "$3 (expected $2, got $1)"; fi; }

# A scratch register with the real table shape. The tool is driven against THIS, never the live
# register - a suite that edits the register it documents has to put it back on every run,
# including the runs that are interrupted.
REG="$TMP/CANDIDATES.md"
fresh() {
  cat > "$REG" <<'MD'
# Promotion Candidates

| ID | Candidate rule (domain-free wording) | Source app · date | Sightings | Status |
|---|---|---|---|---|
| CAND-001 | "An existing parked rule." | first-app · 30-Aug-2026 | n=1 | **PARKED (n=1)** |
MD
}

echo "capture-candidate"

# --- 1. A dry run writes NOTHING. The default must be safe. ---------------------------------
fresh; before="$(cat "$REG")"
node "$CAP" --register "$REG" --rule "A derived value must recompute when any input changes" --app app-one >/dev/null 2>&1
[ "$(cat "$REG")" = "$before" ] && ok "a dry run leaves the register byte-identical" \
  || bad "a dry run MODIFIED the register - the unsafe thing is the default"

# --- 2. --apply parks at n=1, newest first, renumbering nothing. -----------------------------
fresh
node "$CAP" --register "$REG" --rule "A derived value must recompute when any input changes" --app app-one --apply >/dev/null 2>&1
grep -q 'CAND-002 .*PARKED (n=1)' "$REG" && ok "--apply parks the new candidate at n=1" \
  || bad "--apply did not park the candidate"
# Newest first: the new row must precede the one that was already there.
if [ "$(grep -n 'CAND-002' "$REG" | cut -d: -f1)" -lt "$(grep -n 'CAND-001' "$REG" | cut -d: -f1)" ]; then
  ok "the new row is newest-first, above the existing one"
else bad "the new row was appended below - the register is newest-first"; fi
grep -q 'CAND-001 .*first-app · 30-Aug-2026 .*PARKED' "$REG" \
  && ok "the existing row is untouched - nothing renumbered, nothing rewritten" \
  || bad "an existing row changed; the register is append-only (CLAUDE.md rule 8)"

# --- 3. Filter 2 - a rule naming a business concept is refused. ------------------------------
mkdir -p "$TMP/lex"
printf '# Lexicon\n\n| Term | Meaning |\n|---|---|\n| Invoice | a bill |\n' > "$TMP/lex/PRODUCT_LEXICON.md"
fresh
node "$CAP" --register "$REG" --rule "Invoice totals must recompute after a line item is deleted" \
  --app app-one --lexicon "$TMP/lex/PRODUCT_LEXICON.md" --apply >/dev/null 2>&1
code_is $? 2 "a rule containing a lexicon word is REFUSED"
grep -q 'CAND-002' "$REG" && bad "...but it was written anyway" \
  || ok "...and nothing was written"

# --- 4. The escape token excuses Filter 2 and nothing else (CLAUDE.md rule 2). ---------------
fresh
node "$CAP" --register "$REG" --rule "Invoice totals must recompute" --app app-one \
  --lexicon "$TMP/lex/PRODUCT_LEXICON.md" --allow-lexicon-word --apply >/dev/null 2>&1
grep -q 'CAND-002' "$REG" && ok "--allow-lexicon-word excuses that ONE check" \
  || bad "--allow-lexicon-word did not let the capture through"

# --- 5. A same-app repeat is NOT a promotion signal (promote.md Filter 3). -------------------
fresh
out="$(node "$CAP" --register "$REG" --sighting-of CAND-001 --app first-app --apply 2>&1)"
if grep -qi 'still n=1' <<<"$out" && grep -q 'n=1' "$REG" && ! grep -q 'ELIGIBLE' "$REG"; then
  ok "a same-app repeat stays n=1 and is named a Track C matter"
else bad "a same-app repeat was treated as a second sighting"; fi

# --- 6. THE ONE THIS SUITE EXISTS FOR ---------------------------------------------------------
# Hand it the strongest promotion signal it will ever see - n=2, from a different app - and
# prove the FRAMEWORK did not move. Not "prove it promoted correctly": prove it cannot.
fresh
SNAP="$TMP/snap"; mkdir -p "$SNAP"
for f in docs/registers/CANONICAL_PATTERNS.md checklists/SCREEN_CHECKLIST.md VERSION UPGRADES.md \
         docs/registers/CANDIDATES.md workflows/promote.md workflows/framework-update.md; do
  [ -f "$ROOT/$f" ] && cp "$ROOT/$f" "$SNAP/$(echo "$f" | tr '/' '_')"
done
out="$(node "$CAP" --register "$REG" --sighting-of CAND-001 --app second-app --apply 2>&1)"

drift=0
for f in docs/registers/CANONICAL_PATTERNS.md checklists/SCREEN_CHECKLIST.md VERSION UPGRADES.md \
         docs/registers/CANDIDATES.md workflows/promote.md workflows/framework-update.md; do
  [ -f "$ROOT/$f" ] || continue
  cmp -s "$ROOT/$f" "$SNAP/$(echo "$f" | tr '/' '_')" || { echo "        CHANGED: $f"; drift=1; }
done
[ "$drift" -eq 0 ] && ok "n=2 from a different app changes NO framework file - it cannot promote" \
  || bad "the capture tool modified a governed framework file"

grep -q 'ELIGIBLE (n=2)' "$REG" && ok "...the row is marked ELIGIBLE, which is a report, not an act" \
  || bad "the second sighting was not recorded as ELIGIBLE"
grep -q 'PROMOTED' "$REG" && bad "...the tool wrote PROMOTED - that verdict is the human gate's" \
  || ok "...and it never writes PROMOTED - that verdict belongs to /promote"
grep -qi 'NOT PROMOTED' <<<"$out" && ok "...and it says so out loud, naming the two commands to run" \
  || bad "the tool did not say the framework is unchanged"

# --- 7. Rule 3's corollary: a register it cannot parse is BLOCKED, never a silent success. ---
printf '# Promotion Candidates\n\nNo table here.\n' > "$TMP/empty.md"
node "$CAP" --register "$TMP/empty.md" --list >/dev/null 2>&1
code_is $? 3 "a register that parses to zero rows is BLOCKED, not treated as empty"
node "$CAP" --register "$TMP/nope.md" --list >/dev/null 2>&1
code_is $? 3 "a missing register is BLOCKED, and loudly"

echo "  ---- $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
