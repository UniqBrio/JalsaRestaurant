#!/usr/bin/env bash
# shpath.test.sh - EXECUTE the shell->JS path helpers, and hold the class shut.
#
# WHY THIS SUITE EXISTS
#   Three guard suites - ratchet, theme-build, pwa-baseline - reported 12 failing assertions
#   about code that was completely correct. Each interpolated a shell path into JavaScript
#   SOURCE: an ESM import specifier, a readFileSync argument. A path used as argv is translated
#   by the shell on the way out, so `node "$ROOT/x.mjs"` works everywhere; a path inside a JS
#   string is data, and nothing translates it. Git Bash's /c/Explorations/... reached Node as
#   C:\c\Explorations\..., every read threw ENOENT, and the suites called it a defect.
#
#   That is the most expensive way a test can fail. "Nothing ran" sends you to the harness;
#   "6 assertions failed" sends you to the code - and the code was fine. RC-012.
#
#   So this suite does two jobs. It proves the helpers work, and it SWEEPS every shell harness
#   in the tree for the pattern that caused it - because a fix that lives only in three files
#   is one new test script away from coming back.
#
# Run: bash scripts/shpath.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Fail open on tooling, loudly - a dead suite must be audible, never silently green.
node -e '1' >/dev/null 2>&1 || { echo "SKIPPED - no node interpreter" >&2; exit 0; }
[ -f "$ROOT/scripts/lib/shpath.sh" ] || { echo "SKIPPED - no scripts/lib/shpath.sh" >&2; exit 0; }
. "$ROOT/scripts/lib/shpath.sh"

ok()  { echo "  PASS  $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL  $1"; FAIL=$((FAIL+1)); }

echo "shpath"

# --- 1. jspath survives the trip into JS SOURCE, which is the whole point. -------------------
# Asserted by reading a real file through it, not by comparing strings: the only question that
# matters is whether Node can open what came out.
if node -e "
  const fs=require('fs');
  const t=JSON.parse(fs.readFileSync('$(jspath "$ROOT/starter/design/tokens.json")','utf8'));
  if (!t.semantic) throw new Error('parsed, but not the tokens file');
" >/dev/null 2>&1; then ok "jspath produces a path Node's fs can open"
else bad "jspath produces a path Node's fs can open"; fi

# --- 2. jsurl produces a specifier a REAL import accepts. -----------------------------------
cat > "$TMP/imp.mjs" <<JS
import { evaluateRatchet } from '$(jsurl "$ROOT/scripts/lib/ratchet.mjs")';
if (typeof evaluateRatchet !== 'function') { console.error('not a function'); process.exit(1); }
JS
if node "$TMP/imp.mjs" >/dev/null 2>&1; then ok "jsurl produces a specifier ESM import accepts"
else bad "jsurl produces a specifier ESM import accepts"; fi

# --- 3. ...and jsurl is NECESSARY, not decorative. -------------------------------------------
# The native path from jspath is right for fs and WRONG for import: Node reads the drive letter
# as a URL scheme. If this ever starts passing, jsurl can be retired - and until it does, this
# is the evidence that two functions are two functions for a reason.
cat > "$TMP/bare.mjs" <<JS
import '$(jspath "$ROOT/scripts/lib/ratchet.mjs")';
JS
if node "$TMP/bare.mjs" >/dev/null 2>&1; then
  case "$(jspath "$ROOT")" in
    /*) ok "a bare path imports on this platform (POSIX - jspath and jsurl agree here)" ;;
    *)  bad "a bare Windows path was accepted as an ESM specifier - jsurl may now be redundant" ;;
  esac
else ok "a bare native path is REJECTED as an ESM specifier - which is why jsurl exists"; fi

# --- 4. THE SWEEP. No shell harness interpolates a raw path into JS source. ------------------
# The rule in one regex: inside JS source a path arrives through $(jspath ...) / $(jsurl ...)
# or a _js / _url variable - never a bare $VAR. A quote, then $, then an identifier, then a
# SLASH is the violation; a quote followed by $( is a conversion, which is the fix.
#
# WHAT THIS DELIBERATELY DOES NOT CATCH, stated rather than implied: a whole path held in one
# variable - '$MF' - is indistinguishable by syntax from a JSON key, '$field'. Requiring the
# slash means this sweep never fires on correct code, and a check that cries wolf is switched
# off within a day - so the narrow version that never lies is worth more than the broad one
# that does. The residual shape is covered by the naming convention and by review, not here.
HARNESSES=""
for f in "$ROOT"/scripts/*.test.sh "$ROOT"/scripts/hooks/*.test.sh \
         "$ROOT"/.claude/hooks/*.test.sh "$ROOT"/.codex/hooks/*.test.sh; do
  # This suite is excluded from its own sweep: it PLANTS a violation in section 5 as a
  # fixture, and a detector that reads its own fixtures as evidence is the defect CLAUDE.md
  # rule 5 names. The dead-weight audit excludes its own baseline for the same reason.
  [ -f "$f" ] && [ "$f" != "$ROOT/scripts/shpath.test.sh" ] && HARNESSES="$HARNESSES $f"
done

sweep() {  # <file>... -> "file:line:text" per offending site
  local f
  for f in "$@"; do
    [ -f "$f" ] || continue
    grep -nE "'[\$][A-Za-z_][A-Za-z0-9_]*/" "$f" 2>/dev/null | grep -viE '_js|_url' | sed "s|^|${f#"$ROOT/"}:|"
  done
}

# 4a. RULE 5's COMPANION ASSERTION - the detector must have read something. A sweep over zero
#     files reports "clean" and means nothing, which is the exact failure this framework blocks
#     everywhere else. Checked BEFORE the result is trusted, never after.
COUNT="$(printf '%s\n' $HARNESSES | grep -c .)"
if [ "$COUNT" -ge 8 ]; then ok "the sweep read $COUNT shell harnesses (a zero-file sweep is not a clean one)"
else bad "the sweep found only $COUNT harness(es) - it is not reading the tree, so its verdict means nothing"; fi

# 4b. The tree is clean.
HITS="$(sweep $HARNESSES)"
if [ -z "$HITS" ]; then ok "no shell harness interpolates a raw path into JS source"
else
  bad "a raw path reaches JS source - it will resolve wrongly off POSIX"
  printf '%s\n' "$HITS" | sed 's/^/        /' | head -8
fi

# --- 5. FAIL-FIRST. The sweep can actually fire. ---------------------------------------------
# A sweep never observed failing is not evidence that it can fail; it may encode exactly the
# blind spot it is meant to cover. Planted here, against the real function, every run.
cat > "$TMP/planted.test.sh" <<'PLANT'
#!/usr/bin/env bash
node -e "const fs=require('fs');fs.readFileSync('$ROOT/starter/design/tokens.json','utf8');"
PLANT
if [ -n "$(sweep "$TMP/planted.test.sh")" ]; then ok "the sweep FIRES on a planted violation"
else bad "the sweep did not fire on a planted violation - it cannot catch a regression"; fi

# 5b. ...and does not fire on the corrected form, or it would just be noise nobody reads.
cat > "$TMP/clean.test.sh" <<'CLEAN'
#!/usr/bin/env bash
node -e "const fs=require('fs');fs.readFileSync('$(jspath "$ROOT/f.json")','utf8');"
node -e "const fs=require('fs');fs.readFileSync('$ROOT_JS/f.json','utf8');"
CLEAN
if [ -z "$(sweep "$TMP/clean.test.sh")" ]; then ok "the sweep is quiet on the corrected form"
else bad "the sweep flags the corrected form - it would be switched off within a day"; fi

echo "  ---- $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
