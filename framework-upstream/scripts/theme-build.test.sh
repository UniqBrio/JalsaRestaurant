#!/usr/bin/env bash
# theme-build.test.sh - EXECUTE the theme builder and prove its output does not depend on
# WHERE it was invoked from.
#
# WHY THIS SUITE EXISTS
#   The generated header named its token source with a path relative to the CURRENT WORKING
#   DIRECTORY. The same tokens, written to the same directory, therefore produced two
#   different byte streams: `starter/design/tokens.json` when built from the framework root,
#   `design/tokens.json` when built from the application directory. Every consumer of those
#   bytes then disagreed with every other one:
#
#     - `--check` reported DRIFT ("stale or hand-edited") on files nothing had edited, so
#       gate G1 and commit guard G4 blamed the tree for the checker's own cwd.
#     - `starter/package.json`'s own `theme:build` and `gate` scripts run from the application
#       directory, so using them broke the framework root's gate, and vice versa - a ping-pong
#       with no fixed point.
#     - `new-app.mjs` copies the starter and then REBUILDS the theme in the new app, so every
#       scaffolded app was born with a hash that did not match its seed. `upgrade.mjs` reads
#       that as "pristine, and the framework changed it", so both files were auto-overwritten
#       on EVERY upgrade - re-breaking the app's G1 - whether or not any token had changed.
#
#   One cause, four symptoms, and none of them looked like each other. Case 1 is the cause;
#   the rest hold the symptoms shut.
#
# Run: bash scripts/theme-build.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/scripts/theme-build.mjs"
PASS=0; FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
. "$ROOT/scripts/lib/shpath.sh"
# Paths that get interpolated into `node -e` SOURCE need the native form - inside a JS string
# the shell's argv translation never runs. Converted once here, not at each of the six sites.
ROOT_JS="$(jspath "$ROOT")"
TMP_JS="$(jspath "$TMP")"

# Fail open on tooling, loudly - a dead suite must be audible, never silently green.
node -e '1' >/dev/null 2>&1 || { echo "SKIPPED - no node interpreter" >&2; exit 0; }
[ -f "$BUILD" ] || { echo "SKIPPED - no theme-build.mjs at $BUILD" >&2; exit 0; }
[ -f "$ROOT/starter/design/tokens.json" ] || { echo "SKIPPED - no starter/design/tokens.json" >&2; exit 0; }

ok()  { echo "  PASS  $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL  $1"; FAIL=$((FAIL+1)); }

echo "theme-build"

# --- 1. THE CAUSE. Same tokens, same output directory, two invocation directories. ---------
# Absolute --out for both runs, so the ONLY variable is the cwd. If these differ, the builder
# is not a function of its inputs.
( cd "$ROOT"         && node "$BUILD" --out "$TMP/from-root"    >/dev/null 2>&1 )
( cd "$ROOT/starter" && node "$BUILD" --out "$TMP/from-app"     >/dev/null 2>&1 )
if diff -r "$TMP/from-root" "$TMP/from-app" >/dev/null 2>&1; then
  ok "identical tokens build byte-identically from any working directory"
else
  bad "identical tokens build byte-identically from any working directory"
  diff -r "$TMP/from-root" "$TMP/from-app" 2>&1 | sed 's/^/        /' | head -6
fi

# --- 2. The committed artifacts verify from the application directory too. -----------------
# This is the symptom an app actually meets: `starter/package.json` runs the gate with
# `--cwd .`, so G1 executes the checker from there. A checker that only agrees with itself in
# one directory is not a checker.
( cd "$ROOT/starter" && node "$BUILD" --check >/dev/null 2>&1 ) \
  && ok "--check passes from the application directory" \
  || bad "--check passes from the application directory"

# --- 3. ...and still from the framework root. A fix that moves the failure is not a fix. ----
( cd "$ROOT" && node "$BUILD" --check >/dev/null 2>&1 ) \
  && ok "--check passes from the framework root" \
  || bad "--check passes from the framework root"

# --- 4. The header's path is FOLLOWABLE from the generated file. ---------------------------
# A header naming a path that does not resolve is worse than one naming none: it reads as
# provenance and points nowhere. Resolved against the generated file's own directory, it must
# land on the real tokens file.
hdr="$(sed -n '1s/.*from \(.*\) - DO NOT EDIT.*/\1/p' "$ROOT/starter/src/theme/tokens.generated.css")"
if [ -n "$hdr" ] && [ -f "$ROOT/starter/src/theme/$hdr" ]; then
  ok "the header path resolves to the real tokens file ($hdr)"
else
  bad "the header path resolves to the real tokens file (got '${hdr:-<none>}')"
fi

# --- 5. REGRESSION GUARD. The gate must still fire on a genuinely hand-edited file. --------
# Making the checker stop crying wolf is only correct if it still barks at a real intruder.
mkdir -p "$TMP/tamper"
( cd "$ROOT" && node "$BUILD" --out "$TMP/tamper" >/dev/null 2>&1 )
printf '\n--tampered-with: red;\n' >> "$TMP/tamper/tokens.generated.css"
if ( cd "$ROOT" && node "$BUILD" --out "$TMP/tamper" --check >/dev/null 2>&1 ); then
  bad "a hand-edited generated file is still reported as DRIFT"
else
  ok "a hand-edited generated file is still reported as DRIFT"
fi

# --- 6. The installable artifacts are GENERATED, and their colours come from the tokens. -----
# A hand-written manifest is two more colour literals living outside the token file, and they
# drift the first time anybody rebrands: the app changes colour and the installed window
# around it does not.
MF="$ROOT/starter/public/manifest.webmanifest"
MF_JS="$(jspath "$MF")"
if node -e "
  const fs=require('fs');
  const m=JSON.parse(fs.readFileSync('$MF_JS','utf8'));
  const t=JSON.parse(fs.readFileSync('$ROOT_JS/starter/design/tokens.json','utf8'));
  const want=t.semantic[t.app.themeColorToken].light;
  if (m.theme_color!==want) throw new Error('theme_color '+m.theme_color+' != token '+want);
  for (const k of ['id','name','short_name','start_url','scope','display','icons'])
    if (m[k]===undefined) throw new Error('manifest is missing '+k);
  if (!m.icons.length) throw new Error('manifest declares no icons');
  if (m.icons.some((i)=>i.note!==undefined)) throw new Error('an icon carries the token file\\'s note field');
" 2>/dev/null; then ok "the manifest is valid and its colours come from the tokens"
else bad "the manifest is valid and its colours come from the tokens"; fi

# --- 7. The offline page names its source relative to ITSELF. --------------------------------
# It lives in public/ while the token files live in src/theme/, so one shared path string is
# right for one of them and wrong for the other. Observed failing exactly that way.
ohdr="$(sed -n '2s/.*from \(.*\) - DO NOT EDIT.*/\1/p' "$ROOT/starter/public/offline.html")"
if [ -n "$ohdr" ] && [ -f "$ROOT/starter/public/$ohdr" ]; then
  ok "the offline page's source path resolves from its own directory ($ohdr)"
else bad "the offline page's source path resolves from its own directory (got '${ohdr:-<none>}')"; fi

# --- 8. The generated launcher icons are real PNGs at the declared size. ----------------------
# "Installable with no manual configuration" is false if the icon the manifest points at is
# absent or is not an image. Decoded here rather than merely stat-ed: a zero-byte file exists.
if node -e "
  const fs=require('fs');
  const t=JSON.parse(fs.readFileSync('$ROOT_JS/starter/design/tokens.json','utf8'));
  for (const i of t.app.icons.filter((i)=>i.generated)) {
    const b=fs.readFileSync('$ROOT_JS/starter/public'+i.src);
    if (b.slice(0,8).toString('hex')!=='89504e470d0a1a0a') throw new Error(i.src+' is not a PNG');
    const w=b.readUInt32BE(16), h=b.readUInt32BE(20), want=Number(i.sizes.split('x')[0]);
    if (w!==want||h!==want) throw new Error(i.src+' is '+w+'x'+h+', declared '+i.sizes);
    if (b[25]!==6) throw new Error(i.src+' is not RGBA');
  }
" 2>/dev/null; then ok "every generated icon is a real PNG at its declared size"
else bad "every generated icon is a real PNG at its declared size"; fi

# --- 9. An icon the APP owns is never overwritten. -------------------------------------------
# A placeholder exists to be replaced. If a theme build clobbered real artwork, the icon would
# revert to the framework's placeholder on the next rebrand - silently, and only visible to
# someone who installs the app.
mkdir -p "$TMP/own/public/brand" "$TMP/own/design" "$TMP/own/src/theme"
node -e "
  const fs=require('fs');
  const t=JSON.parse(fs.readFileSync('$ROOT_JS/starter/design/tokens.json','utf8'));
  for (const i of t.app.icons) delete i.generated;   // the app now owns every icon
  fs.writeFileSync('$TMP_JS/own/design/tokens.json', JSON.stringify(t,null,2));
"
printf 'REAL ARTWORK' > "$TMP/own/public/brand/maskable-192.png"
( cd "$TMP/own" && node "$BUILD" --tokens design/tokens.json --out src/theme --public public >/dev/null 2>&1 )
if [ "$(cat "$TMP/own/public/brand/maskable-192.png")" = "REAL ARTWORK" ]; then
  ok "an icon the app owns is never overwritten by a theme build"
else bad "an icon the app owns is never overwritten by a theme build"; fi

# --- 10. The link is LIVE: change a token, the installed identity follows. --------------------
# The whole argument for generating the manifest is that a rebrand reaches it. Asserted, not
# assumed - otherwise this is just a differently-located hardcoded colour.
mkdir -p "$TMP/rebrand/design"
node -e "
  const fs=require('fs');
  const t=JSON.parse(fs.readFileSync('$ROOT_JS/starter/design/tokens.json','utf8'));
  t.semantic[t.app.themeColorToken].light='#123456';
  fs.writeFileSync('$TMP_JS/rebrand/design/tokens.json', JSON.stringify(t,null,2));
"
( cd "$TMP/rebrand" && node "$BUILD" --tokens design/tokens.json --out src/theme --public public >/dev/null 2>&1 )
if grep -q '"theme_color": "#123456"' "$TMP/rebrand/public/manifest.webmanifest" 2>/dev/null; then
  ok "a rebrand reaches the installed app's chrome colour"
else bad "a rebrand reaches the installed app's chrome colour"; fi

# --- 11. Building ANOTHER tree's tokens must not write into this one. ------------------------
# The served artifacts default to the directory beside the TOKENS, not beside the working
# directory. Anchored on cwd, a suite building a scratch app got its stylesheet in the scratch
# tree and its manifest written over the real starter's - stamped with a source path pointing
# into a temp directory that would not exist a second later. Observed exactly that way.
mkdir -p "$TMP/iso/design"
cp "$ROOT/starter/design/tokens.json" "$TMP/iso/design/tokens.json"
iso_before="$(cat "$ROOT/starter/public/offline.html" "$ROOT/starter/public/manifest.webmanifest")"
( cd "$ROOT" && node "$BUILD" --tokens "$TMP/iso/design/tokens.json" --out "$TMP/iso/src/theme" >/dev/null 2>&1 )
iso_after="$(cat "$ROOT/starter/public/offline.html" "$ROOT/starter/public/manifest.webmanifest")"
if [ "$iso_before" = "$iso_after" ] && [ -f "$TMP/iso/public/manifest.webmanifest" ]; then
  ok "building another tree's tokens writes only into that tree"
else
  bad "building another tree's tokens writes only into that tree" \
      "(real tree changed: $([ "$iso_before" = "$iso_after" ] && echo no || echo YES;)" \
      "scratch manifest written: $([ -f "$TMP/iso/public/manifest.webmanifest" ] && echo yes || echo NO))"
fi

echo "  ---- $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
