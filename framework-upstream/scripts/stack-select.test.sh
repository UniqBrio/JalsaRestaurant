#!/usr/bin/env bash
# stack-select.test.sh - EXECUTE the stack-selection decision against §10's seven cases.
#
# WHY THIS SUITE EXISTS
#   The policy's whole claim is that stack selection is DETERMINISTIC and context-aware. A
#   paragraph cannot be deterministic - two readers get two answers, and the one under time
#   pressure gets the familiar one. These seven cases are the claim, executed.
#
#   The case that matters most is 7. A selection function that always returns a category will
#   quietly decide an architecture from absent information, and "it picked Next.js" is
#   indistinguishable from "it knew Next.js was right". ASK is a real outcome here.
#
# Run: bash scripts/stack-select.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
. "$ROOT/scripts/lib/shpath.sh"   # CP-31: the import specifier crosses into JS source

node -e '1' >/dev/null 2>&1 || { echo "SKIPPED - no node interpreter" >&2; exit 0; }
[ -f "$ROOT/scripts/lib/stack-select.mjs" ] || { echo "SKIPPED - no stack-select.mjs" >&2; exit 0; }

# One driver around the real module: each case is a JSON context in, a category out.
cat > "$TMP/drive.mjs" <<JS
import { selectStack } from '$(jsurl "$ROOT/scripts/lib/stack-select.mjs")';
const d = selectStack(JSON.parse(process.argv[2]));
console.log(d.category + '|' + (d.question ? 'HASQ' : 'NOQ') + '|' + d.stack.join(','));
JS

case_is() { # <label> <expected-category> <json>
  local got
  got="$(node "$TMP/drive.mjs" "$3" 2>&1)"
  local cat="${got%%|*}"
  if [ "$cat" = "$2" ]; then echo "  PASS  $1 -> $2"; PASS=$((PASS+1))
  else echo "  FAIL  $1 (expected $2, got '$got')"; FAIL=$((FAIL+1)); fi
}

echo "stack-select"

# 1. SEO-heavy public website, no PWA -> Next.js.
case_is "SEO-heavy public website, no PWA" B \
  '{"seo":"high","publicContent":true,"pwa":false,"mobileFirst":false,"android":"no","ios":"no","mobileWeb":true,"desktopWeb":true}'

# 2. THE DISTINCTION. A responsive business website whose only mobile requirement is a browser
#    is still Next.js. If mobileWeb ever selects Expo, this case is the one that catches it.
case_is "responsive business site, mobile BROWSER only" B \
  '{"seo":"moderate","publicContent":false,"pwa":false,"mobileFirst":false,"android":"no","ios":"no","mobileWeb":true,"tablet":true,"desktopWeb":true}'

# 3. Mobile-first + PWA + native + desktop -> the universal stack.
case_is "mobile-first + PWA + Android/iOS + desktop" A \
  '{"seo":"low","publicContent":false,"pwa":true,"mobileFirst":true,"android":"required","ios":"required","mobileWeb":true,"tablet":true,"desktopWeb":true}'

# 4. An authenticated business app with PWA + tablet + desktop, and no native TODAY. PWA alone
#    is a universal requirement - installability is the line, not the app stores.
case_is "authenticated app + PWA + tablet + desktop" A \
  '{"seo":"low","publicContent":false,"pwa":true,"mobileFirst":true,"android":"future","ios":"future","tablet":true,"desktopWeb":true}'

# 5. Both at once -> evaluate a split. Not "pick one and make it cope".
case_is "SEO public web AND a mobile-first app" HYBRID \
  '{"seo":"high","publicContent":true,"pwa":true,"mobileFirst":true,"android":"required","ios":"required","desktopWeb":true}'

# 6. An existing application is never re-categorised. The policy prefers a stack; it does not
#    authorise a rewrite, and a function that could order one would eventually order a bad one.
case_is "existing Next.js app, substantially built" EXISTING \
  '{"seo":"low","pwa":true,"mobileFirst":true,"existing":{"stack":"Next.js","substantiallyImplemented":true}}'

# 7. THE ONE THIS SUITE EXISTS FOR. The deciding inputs are unknown, so the honest outcome is a
#    question - not a default that decides the architecture from absent information.
case_is "ambiguous: PWA/native/mobile-first all unknown" ASK \
  '{"seo":"moderate","publicContent":false,"mobileWeb":true,"desktopWeb":true}'

# ...and the question is actually carried, not merely implied by the category.
q="$(node "$TMP/drive.mjs" '{"seo":"moderate","mobileWeb":true}' 2>&1)"
case "$q" in
  ASK\|HASQ\|*) echo "  PASS  ...and ASK carries the question to put"; PASS=$((PASS+1)) ;;
  *) echo "  FAIL  ASK returned no question ('$q')"; FAIL=$((FAIL+1)) ;;
esac

# A stated 'no' is NOT an unknown: explicit refusal of PWA and native settles it without asking.
case_is "explicit no to PWA and native does not ask" B \
  '{"seo":"moderate","pwa":false,"mobileFirst":false,"android":"no","ios":"no","mobileWeb":true}'

echo "  ---- $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
