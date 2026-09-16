#!/usr/bin/env bash
# shpath.sh - hand a filesystem path from the shell INTO JavaScript source, on every platform.
#
# WHY THIS EXISTS
#   A path used as ARGV survives the trip untouched: `node "$ROOT/x.mjs"` works everywhere,
#   because the shell translates path-shaped command-line arguments on the way out. A path
#   interpolated into JS SOURCE - an import specifier, a readFileSync argument - is data, not
#   argv, so no translation runs. Git Bash's /c/Explorations/... arrives at Node as
#   C:\c\Explorations\..., every read throws ENOENT, and a suite whose subject is perfectly
#   healthy reports FAIL.
#
#   That is the worst shape a test can fail in. It does not say "nothing ran"; it names
#   assertions and calls them broken, so the reader goes looking for a defect in code that
#   never had one. Twelve assertions across ratchet, theme-build and pwa-baseline did exactly
#   this - see RC-012.
#
# THE TWO FORMS, AND WHY IT IS NOT ONE FUNCTION
#   jspath <path>  -> a path Node's `fs` resolves identically on every platform.
#   jsurl  <path>  -> a file:// URL. This is the ONLY form Node accepts as an ESM import
#                     specifier: a bare C:/... is rejected with ERR_UNSUPPORTED_ESM_URL_SCHEME,
#                     because Node reads the drive letter as a URL scheme. Verified, not assumed.
#
# USAGE
#   . "$(dirname "$0")/lib/shpath.sh"
#   node -e "require('fs').readFileSync('$(jspath "$ROOT/f.json")','utf8')"
#   echo "import x from '$(jsurl "$ROOT/scripts/lib/ratchet.mjs")';" > drive.mjs
#
# FAIL-OPEN (CLAUDE.md rule 3): where cygpath is absent - every POSIX system - the path is
# already the form Node wants, so passthrough is the correct answer, not a degraded one.

# Native form for fs: C:/Explorations/... on Windows, unchanged on POSIX.
jspath() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$1"
  else
    printf '%s' "$1"
  fi
}

# file:// URL for ESM import specifiers. POSIX /a/b -> file:///a/b (two slashes + the path's
# own leading one); Windows C:/a -> file:///C:/a (three, since the drive letter supplies none).
jsurl() {
  local p
  p="$(jspath "$1")"
  case "$p" in
    /*) printf 'file://%s' "$p" ;;
    *)  printf 'file:///%s' "$p" ;;
  esac
}
