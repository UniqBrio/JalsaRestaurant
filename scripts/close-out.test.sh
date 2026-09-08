#!/usr/bin/env bash
# close-out.test.sh - EXECUTE the close-out generator against real records.
#
# WHY EXECUTE RATHER THAN READ
#   The claim is that ONE record produces four consistent renderings, and that --apply can
#   never overwrite an existing entry. Reading the source proves the renderers exist; only
#   running them proves a fact stated once appears in all of them, and that the append-only
#   refusal actually fires. Each case was observed before this file was committed.
#
# Run: bash scripts/close-out.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CO="$ROOT/scripts/close-out.mjs"
PASS=0; FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

node -e '1' >/dev/null 2>&1 || { echo "SKIPPED - no node interpreter" >&2; exit 0; }
[ -f "$CO" ] || { echo "SKIPPED - no close-out.mjs at $CO" >&2; exit 0; }

REC="$TMP/rec.json"
OUT="$TMP/out.txt"
co() { ( cd "$TMP" && node "$CO" "$@" ) > "$OUT" 2>&1; }

full_record() {
  cat > "$REC" <<'JSON'
{
  "version": "9.9.9",
  "date": "08-Sep-2026",
  "bump": "MINOR",
  "title": "a distinctive title nobody else would write",
  "why": "The unmistakable reason sentence.",
  "rootCause": "RC-042",
  "added": ["**A thing** was added with `code` in it"],
  "fixed": ["A prior mistake was corrected"],
  "debt": ["One gap stays open and is named"],
  "appAction": "None. Nothing to do.",
  "verification": "audit:all clean; guard:test 99/99."
}
JSON
}

check()  { if grep -qE "$2" "$OUT"; then echo "  PASS  $1"; PASS=$((PASS+1));
           else echo "  FAIL  $1 (no match: $2)"; FAIL=$((FAIL+1)); fi; }
refute() { if grep -qE "$2" "$OUT"; then echo "  FAIL  $1 (matched what it must not: $2)"; FAIL=$((FAIL+1));
           else echo "  PASS  $1"; PASS=$((PASS+1)); fi; }
ok()     { if [ "$1" -eq "$2" ]; then echo "  PASS  $3 (exit $1)"; PASS=$((PASS+1));
           else echo "  FAIL  $3 (expected $2, got $1)"; FAIL=$((FAIL+1)); fi; }

echo "close-out"

# 1. ONE record, and the same fact reaches every rendering. This is the entire point: told
#    four times by hand the four accounts drift, and the drifted one is found first.
full_record
co "$REC" --all
ok $? 0 "a complete record renders"
appearances="$(grep -c 'a distinctive title nobody else would write' "$OUT" || true)"
if [ "$appearances" -ge 3 ]; then echo "  PASS  the title reaches all three renderings ($appearances)"; PASS=$((PASS+1))
else echo "  FAIL  the title appeared $appearances time(s), expected >= 3"; FAIL=$((FAIL+1)); fi
check "the upgrades section carries the bump grammar" '^## 9\.9\.9 — 08-Sep-2026 — MINOR'
check "the root cause is cited where an app will look" 'RC-042'
check "the app action is stated, never left silent" 'None\. Nothing to do\.'
check "honest debt gets its own heading, not a footnote" 'honest debt'
check "the commit message carries the co-author trailer" 'Co-Authored-By: Claude Opus 5'

# 2. The changelog is read in a terminal, so markdown emphasis is noise there.
co "$REC" --changelog
refute "the changelog strips bold markers" '\*\*A thing\*\*'
check  "but keeps the words themselves" 'A thing was added'

# 3. git log is shown at 72 columns by half the tools that render it.
co "$REC" --commit
longest="$(awk '{ print length }' "$OUT" | sort -n | tail -1)"
if [ "$longest" -le 76 ]; then echo "  PASS  no commit line exceeds the readable width ($longest)"; PASS=$((PASS+1))
else echo "  FAIL  a commit line is $longest chars - it will be truncated"; FAIL=$((FAIL+1)); fi

# 4. Every required field is read by somebody. appAction especially: an upgrading app must be
#    told "nothing" explicitly, because silence there reads as "unknown", not as "no action".
for field in version date bump title why appAction; do
  full_record
  node -e "const fs=require('fs');const r=JSON.parse(fs.readFileSync(process.argv[1]));delete r['$field'];fs.writeFileSync(process.argv[1],JSON.stringify(r))" "$REC"
  co "$REC" --all
  if [ $? -eq 2 ] && grep -q "$field" "$OUT"; then echo "  PASS  a missing '$field' is refused by name"; PASS=$((PASS+1))
  else echo "  FAIL  a missing '$field' was not refused by name"; FAIL=$((FAIL+1)); fi
done

# 5. A bump value outside the three changes what an upgrading app is promised.
full_record
node -e "const fs=require('fs');const r=JSON.parse(fs.readFileSync(process.argv[1]));r.bump='TINY';fs.writeFileSync(process.argv[1],JSON.stringify(r))" "$REC"
co "$REC" --all
ok $? 2 "an unregistered bump value is refused"

# 6. Malformed input must not produce half a release note.
printf 'not json at all' > "$REC"
co "$REC" --all
ok $? 2 "an unparseable record is refused"

# 7. --apply PREPENDS. Both files are newest-first and append-only; a generator that rewrote
#    an entry would quietly delete a release nobody could then look up.
full_record
printf '# Upgrade Log\n\nintro\n\n---\n\n## 1.0.0 — old\n\nprior content\n' > "$TMP/UPGRADES.md"
printf '# Changelog\n\n## 1.0.0 — old\n\nprior content\n' > "$TMP/CHANGELOG.md"
co "$REC" --apply
ok $? 0 "--apply writes"
if [ "$(grep -n '9.9.9' "$TMP/UPGRADES.md" | cut -d: -f1)" -lt "$(grep -n '1.0.0' "$TMP/UPGRADES.md" | cut -d: -f1)" ]; then
  echo "  PASS  the new section is newest-first in UPGRADES"; PASS=$((PASS+1))
else echo "  FAIL  the new section is not above the old one"; FAIL=$((FAIL+1)); fi
if grep -q 'prior content' "$TMP/UPGRADES.md" && grep -q 'prior content' "$TMP/CHANGELOG.md"; then
  echo "  PASS  the prior entry survived untouched"; PASS=$((PASS+1))
else echo "  FAIL  --apply destroyed a prior entry"; FAIL=$((FAIL+1)); fi
[ -f "$TMP/.close-out-commit.txt" ] && { echo "  PASS  the commit message was written to a file"; PASS=$((PASS+1)); } \
  || { echo "  FAIL  no commit message file"; FAIL=$((FAIL+1)); }

# 8. Applying the same version twice would put two sections for one release in the file.
co "$REC" --apply
ok $? 2 "a second --apply of the same version is refused"

echo "  ---- $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
