#!/usr/bin/env bash
# design-fidelity.test.sh - EXECUTE the design-to-implementation protections (RC-018, v4.0.0).
#
# WHY THIS SUITE EXISTS
#   The claim is that an approved design can no longer be silently replaced during implementation.
#   Version one proved the ACCOUNTING: a decision could not be absent. Validation then showed the
#   hole - a row marked `implemented` was believed, so an omitted feature plus a false word
#   produced "complete and consistent". Cases A-I below are that validation, turned into a suite:
#   the audit now reads the CODE, and every status has to earn its word.
#
#   The case that matters most is still E. A protection that flags every difference gets switched
#   off within a week. Implementation freedom has to survive this suite intact.
#
# Run: bash scripts/design-fidelity.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

node -e '1' >/dev/null 2>&1 || { echo "SKIPPED - no node interpreter" >&2; exit 0; }
AUDIT="$ROOT/scripts/audits/check-design-contract.mjs"
INGEST="$ROOT/scripts/design-ingest.mjs"
[ -f "$AUDIT" ] && [ -f "$INGEST" ] || { echo "SKIPPED - scripts absent" >&2; exit 0; }

APP="$TMP/app"
reset_app() {
  rm -rf "$APP"; mkdir -p "$APP/docs" "$APP/design" "$APP/.baselines" "$APP/src/app/orders" "$APP/src/features" "$APP/tests"
  echo '{ "semantic": { "primary": { "light": "#7a1c24", "dark": "#7a1c24" } } }' > "$APP/design/tokens.json"
  # The synthetic IMPLEMENTATION: nav Orders + Reports exist, Menu does not; feature A exists, B does not.
  printf 'export default function Page(){ return <nav><a href="/orders">Orders</a><a href="/reports">Reports</a></nav> }\n' > "$APP/src/app/orders/page.tsx"
  printf 'export const featureA = 1; // data-testid="feature-a"\n' > "$APP/src/features/a.ts"
  printf "import { test } from '@playwright/test';\ntest('nav', () => {});\n" > "$APP/tests/nav.spec.ts"
  # An adopting app always carries a baseline (upgrade.mjs writes one); without it the ratchet
  # correctly reports BLOCKED, which would make every "passes" case below fail for the wrong reason.
  ( cd "$APP" && node "$AUDIT" --app . --contract docs/DESIGN_CONTRACT.md --tokens design/tokens.json --write-baseline >/dev/null 2>&1 )
}

# One contract, parameterised by the MUST-PRESERVE rows and the section-9 rows.
contract() { # <preserve-rows> [section9-rows] [section8-rows] [flexibility]
cat > "$APP/docs/DESIGN_CONTRACT.md" <<MD
# Design Contract — Synthetic
## 1. Source authority
| Artifact | Role | Authority | Notes |
|---|---|---|---|
| flow.html | SPECIFICATION | AUTHORITATIVE for IA | states the nav |
## 2. Artifact coverage — evidence, not a claim
| Artifact | Class | Extracted |
|---|---|---|
| flow.html | A | 3 nav items, 2 features |
## 3. Application identity and structure
Three nav items.
## 4. Visual identity
- **Brand colour (canonical hex):** \`#7a1c24\`
## 5. MUST PRESERVE
| # | Decision | Source | Status | Evidence | Verified by |
|---|---|---|---|---|---|
$1
## 6. Implementation flexibility
${4:-component architecture, state management, file organisation}
## 7. Interaction and content
n/a
## 8. Recorded design changes
| Decision changed | To what | Why | Authorised by | Date |
|---|---|---|---|---|
${3:-}
## 9. Unknown / unresolved / conflicting
| Item | Kind | Sources | Owner | Precedence | Status |
|---|---|---|---|---|---|
${2:-}
MD
}

GOOD='| 1 | Nav: Orders | flow.html | implemented | route:/orders; text:"Orders" | spec:tests/nav.spec.ts |
| 2 | Nav: Reports | flow.html | implemented | text:"Reports" | spec:tests/nav.spec.ts |
| 3 | Feature A | flow.html | implemented | file:src/features/a.ts; testid:feature-a | gate:G7 |'

audit()  { ( cd "$APP" && node "$AUDIT" --app . --contract docs/DESIGN_CONTRACT.md --tokens design/tokens.json --report 2>&1 ); }
gate()   { ( cd "$APP" && node "$AUDIT" --app . --contract docs/DESIGN_CONTRACT.md --tokens design/tokens.json >/dev/null 2>&1; echo $? ); }

expect_finding() { # <label> <pattern>
  local out; out="$(audit)"
  if printf '%s' "$out" | grep -qiE "$2"; then echo "  PASS  $1"; PASS=$((PASS+1))
  else echo "  FAIL  $1 - no line matching /$2/ in:"; printf '%s\n' "$out" | sed 's/^/          /'; FAIL=$((FAIL+1)); fi
}
expect_no_finding() { # <label> <pattern>
  local out; out="$(audit)"
  if printf '%s' "$out" | grep -qiE "$2"; then echo "  FAIL  $1 - unexpected /$2/:"; printf '%s\n' "$out" | sed 's/^/          /'; FAIL=$((FAIL+1))
  else echo "  PASS  $1"; PASS=$((PASS+1)); fi
}
expect_exit() { # <label> <want> <got>
  if [ "$3" = "$2" ]; then echo "  PASS  $1 (exit $3)"; PASS=$((PASS+1))
  else echo "  FAIL  $1 (expected exit $2, got $3)"; FAIL=$((FAIL+1)); fi
}

echo "design-fidelity"

# ---- E FIRST. If implementation freedom does not survive, nothing else matters.
reset_app; contract "$GOOD"
expect_finding "E  faithful implementation with evidence passes clean" "VERDICT: PASS"
reset_app; contract "$GOOD
| 4 | Orders table | flow.html | implemented | route:/orders ~ component architecture: DataTable instead of a plain table | spec:tests/nav.spec.ts |"
expect_finding "E  architecture differs in a CEDED area -> IMPLEMENTATION DETAIL" "IMPLEMENTATION DETAIL"
expect_exit    "E  ...and it does not block" 0 "$(gate)"

# ---- A / B  the validation's decisive failure: a false 'implemented' is now READ against the code.
reset_app; contract "$GOOD
| 4 | Nav: Menu | flow.html | implemented | text:\"Menu\" | spec:tests/nav.spec.ts |"
expect_finding "A  nav A,B,C required; code has A,C; C-row says implemented -> MISSING" "MISSING.*claimed implemented but text \"Menu\" not found"
expect_exit    "A  ...and it BLOCKS" 2 "$(gate)"
reset_app; contract "$GOOD
| 4 | Feature B | flow.html | implemented | file:src/features/b.ts | gate:G7 |"
expect_finding "B  feature B required, absent, marked implemented -> MISSING" "MISSING.*no file at src/features/b.ts"
reset_app; contract "$GOOD
| 4 | Feature B | flow.html | implemented | | gate:G7 |"
expect_finding "B2 implemented with NO evidence is not implemented -> UNKNOWN" "UNKNOWN.*NO EVIDENCE"

# ---- C  unresolved blocks, and a baseline does not turn it green.
reset_app; contract "$GOOD
| 4 | Owner nav: 13 sections | flow.html | unresolved | | |"
expect_finding "C  unresolved MUST-PRESERVE -> UNKNOWN, BLOCKING" "BLOCKING"
( cd "$APP" && node "$AUDIT" --app . --contract docs/DESIGN_CONTRACT.md --tokens design/tokens.json --write-baseline >/dev/null 2>&1 )
expect_exit    "C  ...still exit 2 AFTER --write-baseline: recorded is not resolved" 2 "$(gate)"

# ---- D  evidence cannot be evaluated -> UNKNOWN, block. Never a pass.
reset_app; contract "$GOOD"
out="$( cd "$APP" && node "$AUDIT" --app ./no-such-tree --contract docs/DESIGN_CONTRACT.md --tokens design/tokens.json --report 2>&1 )"
if printf '%s' "$out" | grep -q "UNKNOWN" && printf '%s' "$out" | grep -q "not readable"; then echo "  PASS  D  application tree unreadable -> UNKNOWN, not a pass"; PASS=$((PASS+1))
else echo "  FAIL  D  expected UNKNOWN/not readable:"; printf '%s\n' "$out" | sed 's/^/          /'; FAIL=$((FAIL+1)); fi
reset_app; contract "$GOOD
| 4 | Feature A | flow.html | implemented | screenshot:a.png | gate:G7 |"
expect_finding "D2 an evidence kind the audit cannot evaluate -> UNKNOWN" "UNKNOWN.*unrecognised evidence"

# ---- F  a declared variance outside the ceded areas -> MINOR VARIATION, recorded, not blocking.
reset_app; contract "$GOOD
| 4 | Orders table | flow.html | implemented | route:/orders ~ 12px row gap instead of 16px | spec:tests/nav.spec.ts |"
expect_finding "F  small non-material variance -> MINOR VARIATION" "MINOR VARIATION"
expect_exit    "F  ...NEW, so it blocks until someone accepts it knowingly" 2 "$(gate)"
( cd "$APP" && node "$AUDIT" --app . --contract docs/DESIGN_CONTRACT.md --tokens design/tokens.json --write-baseline >/dev/null 2>&1 )
expect_exit    "F  ...accepted with --write-baseline: recorded, not blocking" 0 "$(gate)"
expect_finding "F  ...and STILL visible in the report after acceptance" "MINOR VARIATION"

# ---- G  requester assertion vs authoritative artifact.
reset_app; contract "$GOOD" "| section count | ASSERTION | brief: 12; flow.html: 13, named | design owner | | open |"
expect_finding "G  assertion vs artifact, open -> CONFLICTING, blocks" "CONFLICTING"
expect_exit    "G  ...exit 2" 2 "$(gate)"
reset_app; contract "$GOOD" "| section count | ASSERTION | brief: 12; flow.html: 13, named | design owner | | resolved 2026-09-13 |"
expect_finding "G2 'resolved' with no precedence is caught" "RESOLVED WITHOUT PRECEDENCE"
reset_app; contract "$GOOD" "| section count | ASSERTION | brief: 12; flow.html: 13, named | design owner | flow.html — authority: declared for IA; scope: names all 13 | resolved 2026-09-13 |"
expect_exit    "G3 resolved WITH precedence passes" 0 "$(gate)"

# ---- Authority and visibility.
reset_app; contract "$GOOD
| 4 | Tips section | flow.html | deferred | owner: A. Owner — phase 2 | |"
expect_finding "deferred WITH owner stays VISIBLE as MISSING (accounted)" "MISSING.*deferred, accounted"
expect_exit    "...and does not block" 0 "$(gate)"
reset_app; contract "$GOOD
| 4 | Tips section | flow.html | deferred | | |"
expect_finding "deferred with NO owner blocks" "no owner or authority"
reset_app; contract "$GOOD
| 4 | Nav: Reports | flow.html | changed | | |" "" "| Nav: Reports | merged into Dashboard | owner asked | A. Owner | 2026-09-13 |"
expect_finding "changed WITH authority -> MATERIAL DESIGN CHANGE (authorised), allowed" "MATERIAL DESIGN CHANGE.*authorised"
expect_exit    "...exit 0" 0 "$(gate)"
reset_app; contract "$GOOD
| 4 | Nav: Reports | flow.html | changed | | |"
expect_finding "changed WITHOUT authority blocks" "NO RECORDED AUTHORITY"
reset_app; contract "$GOOD
| 4 | Feature A | flow.html | implemented | file:src/features/a.ts | |"
expect_finding "implemented with blank Verified-by blocks (traceability is end to end)" "NO VERIFICATION"
reset_app; echo '{ "semantic": { "primary": { "light": "#f5ead8", "dark": "#f5ead8" } } }' > "$APP/design/tokens.json"; contract "$GOOD"
expect_finding "brand replaced -> MATERIAL DESIGN CHANGE" "MATERIAL DESIGN CHANGE: contract #7a1c24 vs tokens #f5ead8"

# ---- H  Markdown / JSON / DOCX are ingested, not skipped.
C="$TMP/corpus"; mkdir -p "$C/_ds"
printf '# Organic design system\n\nOrganic is warm: a cream ground with a terracotta accent.\n' > "$C/_ds/readme.md"
printf '{"namespace":"Organic_x","cards":[]}\n' > "$C/_ds/_ds_manifest.json"
printf ':root{--color-accent:#c67139;--color-bg:#f5ead8;}\n' > "$C/_ds/styles.css"
printf '<html><head><title>Owner</title><link rel="stylesheet" href="_ds/styles.css"></head><body><img src="logo.png"><div class="nm" style="color:#7a1c24">Orders</div><div class="nm" style="color:#7a1c24">Menu</div><div class="nm" style="color:#7a1c24">Reports</div></body></html>' > "$C/screen.html"
printf 'PNG-BYTES-1' > "$C/logo.png"; printf 'PNG-BYTES-1' > "$C/logo-copy.png"; printf 'PNG-BYTES-2' > "$C/pasted-1.png"
mkdir -p "$TMP/docx/word"; printf '<?xml version="1.0"?><w:document xmlns:w="x"><w:body><w:p><w:r><w:t>1. Executive Summary</w:t></w:r></w:p><w:p><w:r><w:t>The owner needs thirteen sections and a maroon identity across every screen of the application, with the same navigation on desktop and on the phone, and every guest-facing string editable from settings.</w:t></w:r></w:p></w:body></w:document>' > "$TMP/docx/word/document.xml"
if command -v powershell >/dev/null 2>&1; then
  powershell -NoProfile -NonInteractive -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('$(cygpath -w "$TMP/docx")', '$(cygpath -w "$C/requirements.docx")')" >/dev/null 2>&1
fi
out="$(node "$INGEST" "$C" 2>&1)"; code=$?
if printf '%s' "$out" | grep -q "_ds/readme.md" && printf '%s' "$out" | grep -qi "Organic is warm"; then echo "  PASS  H  Markdown is ingested and its lede surfaced"; PASS=$((PASS+1)); else echo "  FAIL  H  readme.md not ingested"; FAIL=$((FAIL+1)); fi
if printf '%s' "$out" | grep -q "Organic_x"; then echo "  PASS  H  JSON is ingested and its namespace surfaced"; PASS=$((PASS+1)); else echo "  FAIL  H  manifest.json not ingested"; FAIL=$((FAIL+1)); fi
if [ -f "$C/requirements.docx" ]; then
  if printf '%s' "$out" | grep -q "requirements.docx" && printf '%s' "$out" | grep -qi "Executive Summary"; then echo "  PASS  H  DOCX text is extracted with stock tooling"; PASS=$((PASS+1)); else echo "  FAIL  H  DOCX not extracted:"; printf '%s\n' "$out" | grep -i docx | sed 's/^/          /'; FAIL=$((FAIL+1)); fi
else echo "  SKIP  H  DOCX case - could not build a .docx on this machine (no PowerShell zip)"; fi
if printf '%s' "$out" | grep -q "scope"; then echo "  PASS  H  the conflict cites the medium's OWN description as scope evidence"; PASS=$((PASS+1)); else echo "  FAIL  H  conflict lacks scope line"; FAIL=$((FAIL+1)); fi

# ---- I  visual artifacts: referenced -> E; duplicate -> F; unreferenced -> G; truthful summary.
if printf '%s' "$out" | grep -qE "logo.png.*REQUIRES VISUAL INSPECTION"; then echo "  PASS  I  a referenced image REQUIRES VISUAL INSPECTION - never 'parsed'"; PASS=$((PASS+1)); else echo "  FAIL  I  referenced logo not flagged E"; FAIL=$((FAIL+1)); fi
if printf '%s' "$out" | grep -qE "logo-copy.png.*byte-identical"; then echo "  PASS  I  a duplicate is classed F, not inspected twice"; PASS=$((PASS+1)); else echo "  FAIL  I  duplicate not detected"; FAIL=$((FAIL+1)); fi
if printf '%s' "$out" | grep -q "UNREFERENCED INPUT MATERIAL  (1)"; then echo "  PASS  I  an unreferenced image is input material (G), not design"; PASS=$((PASS+1)); else echo "  FAIL  I  unreferenced pasted image not classed G"; FAIL=$((FAIL+1)); fi
if printf '%s' "$out" | grep -q "INGESTION: INCOMPLETE" && [ "$code" = "1" ]; then echo "  PASS  I  the summary says INCOMPLETE while an E artifact is open (exit 1)"; PASS=$((PASS+1)); else echo "  FAIL  I  summary did not admit incompleteness (exit $code)"; FAIL=$((FAIL+1)); fi
if printf '%s' "$out" | grep -q "\[BRAND COLOUR\]" ; then echo "  PASS  I  the two palettes conflict is SURFACED, not resolved"; PASS=$((PASS+1)); else echo "  FAIL  I  no brand conflict surfaced"; FAIL=$((FAIL+1)); fi

# ---- Kept from v2.13: source unavailable, large corpus, absent contract.
node "$INGEST" "$TMP/nonexistent" >/dev/null 2>&1; expect_exit "unreadable design source BLOCKS, never invents" 3 "$?"
mkdir -p "$TMP/big"; i=0; while [ $i -lt 40 ]; do printf '<html><title>P%s</title><body><div class="nm">S%s</div><div class="nm">B</div><div class="nm">C</div><p style="color:#7a1c24">x</p></body></html>' "$i" "$i" > "$TMP/big/page$i.html"; i=$((i+1)); done
if node "$INGEST" "$TMP/big" 2>&1 | grep -q "A parsed 40"; then echo "  PASS  a 40-artifact corpus is inventoried in full"; PASS=$((PASS+1)); else echo "  FAIL  corpus not fully inventoried"; FAIL=$((FAIL+1)); fi
reset_app; rm -f "$APP/docs/DESIGN_CONTRACT.md"
if audit | grep -qi "No design contract"; then echo "  PASS  absent contract is reported, not silently green"; PASS=$((PASS+1)); else echo "  FAIL  absent contract did not announce itself"; FAIL=$((FAIL+1)); fi

echo "  ---- $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
