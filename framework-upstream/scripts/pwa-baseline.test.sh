#!/usr/bin/env bash
# pwa-baseline.test.sh - EXECUTE the installability audit and prove every block can fire.
#
# WHY EXECUTE RATHER THAN READ
#   An audit is only worth the failures it actually catches. Reading check-pwa-baseline.mjs
#   proves the source mentions icons; only running it against an app with a missing icon proves
#   it says so. Each case below breaks ONE thing in an otherwise complete application and
#   asserts that exactly that break is reported - because a detector that fires on everything
#   is as useless as one that fires on nothing, and both look identical from a green run.
#
#   The last case is the one that matters most: an app with nothing wrong must pass. A gate
#   that cannot be satisfied is a gate that gets switched off, and then the promise it was
#   protecting ("every generated application is installable") is back to being a sentence in
#   a document.
#
# Run: bash scripts/pwa-baseline.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AUDIT="$ROOT/scripts/audits/check-pwa-baseline.mjs"
PASS=0; FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
. "$ROOT/scripts/lib/shpath.sh"

node -e '1' >/dev/null 2>&1 || { echo "SKIPPED - no node interpreter" >&2; exit 0; }
[ -f "$AUDIT" ] || { echo "SKIPPED - no check-pwa-baseline.mjs at $AUDIT" >&2; exit 0; }
[ -f "$ROOT/starter/design/tokens.json" ] || { echo "SKIPPED - no starter tokens" >&2; exit 0; }

echo "pwa-baseline"

# Build a COMPLETE app from the real starter, once. Every case then copies it and breaks
# exactly one thing - so a failure names the break, not the scaffolding.
GOOD="$TMP/good"
mkdir -p "$GOOD/design" "$GOOD/src" "$GOOD/public"
cp "$ROOT/starter/design/tokens.json" "$GOOD/design/tokens.json"
node "$ROOT/scripts/theme-build.mjs" --tokens "$GOOD/design/tokens.json" \
  --out "$GOOD/src/theme" --public "$GOOD/public" >/dev/null 2>&1
cp "$ROOT/starter/public/sw.js" "$GOOD/public/sw.js"
mkdir -p "$GOOD/public/brand"
cp "$ROOT/starter/public/brand/"*.svg "$GOOD/public/brand/" 2>/dev/null
# The wiring the audit looks for, in the same two shapes the starter uses.
cp "$ROOT/starter/src/app/layout.tsx" "$GOOD/src/layout.tsx" 2>/dev/null
cp "$ROOT/starter/src/components/PwaProvider.tsx" "$GOOD/src/PwaProvider.tsx" 2>/dev/null

# `--app .` and an empty baseline: --report is used everywhere below so the ratchet's own
# baselining never masks a case. This suite tests the DETECTOR, not the ratchet.
report() { ( cd "$1" && node "$AUDIT" --app . --report 2>&1 ); }

expect_id() {  # <dir> <signature-id> <label>
  if report "$1" | grep -q "^$2|"; then echo "  PASS  $3"; PASS=$((PASS+1))
  else echo "  FAIL  $3 (no '$2' in the report)"; FAIL=$((FAIL+1))
       report "$1" | sed 's/^/        /' | head -4; fi
}
# Break exactly one thing in a case's manifest. The mutation is ASSERTED, never assumed: a
# `node -e` that dies leaves the fixture INTACT, and the case then fails as though the DETECTOR
# had missed something - which is exactly the misread that cost three suites in RC-012. The
# manifest path goes through jspath because it is interpolated into JS source, not passed as argv.
mutate() { # <case-dir> <expression over the parsed manifest `m`>
  local f_js; f_js="$(jspath "$1/public/manifest.webmanifest")"
  node -e "const fs=require('fs'),f='$f_js';const m=JSON.parse(fs.readFileSync(f));$2;fs.writeFileSync(f,JSON.stringify(m,null,2));" \
    || { echo "  FAIL  could not mutate the fixture at $1 - the case below proves nothing"; FAIL=$((FAIL+1)); return 1; }
}

refute_any() { # <dir> <label>
  if report "$1" | grep -q "^No PWA baseline problems found."; then echo "  PASS  $2"; PASS=$((PASS+1))
  else echo "  FAIL  $2"; report "$1" | sed 's/^/        /' | head -6; FAIL=$((FAIL+1)); fi
}

# 0. THE ONE THAT MUST PASS. A gate nobody can satisfy gets switched off within a day.
refute_any "$GOOD" "a complete application reports no problems"

# 1. No manifest at all.
c="$TMP/c1"; cp -r "$GOOD" "$c"; rm -f "$c/public/manifest.webmanifest"
expect_id "$c" "manifest.missing" "a missing manifest is reported"

# 2. A manifest that is present but not parseable - the shape a bad hand-edit leaves.
c="$TMP/c2"; cp -r "$GOOD" "$c"; printf '{ not json' > "$c/public/manifest.webmanifest"
expect_id "$c" "manifest.unparseable" "an unparseable manifest is reported, not skipped"

# 3. A required member removed. `id` in particular: without it start_url becomes the app's
#    identity, so changing the landing route later orphans every existing installation.
c="$TMP/c3"; cp -r "$GOOD" "$c"
mutate "$c" "delete m.id"
expect_id "$c" "manifest.field" "a manifest missing a required member is reported"

# 4. display: browser. The manifest is valid and the app is NOT a standalone application -
#    the single most plausible way to ship something that looks installable and is not.
c="$TMP/c4"; cp -r "$GOOD" "$c"
mutate "$c" "m.display='browser'"
expect_id "$c" "manifest.display" "display:browser is reported - it does not launch standalone"

# 5. A DECLARED icon whose file is absent. Declaration is not existence, and this is the exact
#    shape of "it looked finished".
c="$TMP/c5"; cp -r "$GOOD" "$c"; rm -f "$c/public/brand/maskable-512.png"
expect_id "$c" "icons.file" "a declared icon with no file is reported"

# 6. Icons present, but none maskable raster: Android crops badly, iOS takes no SVG.
c="$TMP/c6"; cp -r "$GOOD" "$c"
mutate "$c" "m.icons=m.icons.filter(i=>!/png\$/.test(i.src))"
expect_id "$c" "icons.maskable" "an icon set with no maskable raster is reported"

# 7. No service worker.
c="$TMP/c7"; cp -r "$GOOD" "$c"; rm -f "$c/public/sw.js"
expect_id "$c" "sw.missing" "a missing service worker is reported"

# 8. A worker that handles no fetch event - present, registered, and unable to serve anything
#    offline. Nothing about the file's existence reveals this.
c="$TMP/c8"; cp -r "$GOOD" "$c"; printf '/* a worker that does nothing */\n' > "$c/public/sw.js"
expect_id "$c" "sw.nofetch" "a worker with no fetch handler is reported"

# 9. A worker nobody registers. A file, not a feature.
c="$TMP/c9"; cp -r "$GOOD" "$c"; rm -f "$c/src/PwaProvider.tsx"
expect_id "$c" "sw.unregistered" "an unregistered worker is reported"

# 10. A manifest no page links. Same argument, other half.
c="$TMP/c10"; cp -r "$GOOD" "$c"; rm -f "$c/src/layout.tsx"
expect_id "$c" "manifest.unlinked" "an unlinked manifest is reported"

# 11. The offline page renamed out from under the worker - each half fine, the pair broken.
c="$TMP/c11"; cp -r "$GOOD" "$c"; rm -f "$c/public/offline.html"
expect_id "$c" "offline.missing" "a missing offline fallback is reported"

# 12. THE DETECTOR MUST NOT REPORT SUCCESS ON NOTHING. An app directory that is not there looks
#     exactly like a compliant one to every check above, so parsing nothing is BLOCKED - the
#     corollary to fail-open that this repository states as a binding rule.
c="$TMP/c12"; mkdir -p "$c"
( cd "$c" && node "$AUDIT" --app . >/dev/null 2>&1 )
if [ "$?" -ne 0 ]; then echo "  PASS  an empty tree is BLOCKED, never a clean pass"; PASS=$((PASS+1))
else echo "  FAIL  an empty tree reported success"; FAIL=$((FAIL+1)); fi

echo "  ---- $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
