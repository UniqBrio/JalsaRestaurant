#!/usr/bin/env bash
# Regenerate the type-error ratchet baseline.
#
# WHY A RATCHET AND NOT A CLEAN GATE
#   Most existing codebases have a standing type-error backlog. A gate demanding zero blocks
#   every commit on day one and is switched off by lunchtime. A ratchet demands NO WORSE, so it
#   can be adopted today and the backlog can only shrink.
#
# THE SIGNATURE
#   `file|TScode`, deliberately WITHOUT line and column numbers: inserting a blank line above a
#   known error is not a new error, and a ratchet that cries wolf gets disabled.
#
# Enforced by guard G7 in pre-commit-guard.sh.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

DIR=starter
[ -f tsconfig.json ] && DIR=.
OUT="$DIR/.baselines/tsc-baseline.txt"

[ -x "$DIR/node_modules/.bin/tsc" ] || {
  echo "No local tsc - a baseline generated now would record tooling noise, not the real" >&2
  echo "backlog (and a bare npx would fetch a registry squatter named tsc). Install typescript," >&2
  echo "then re-run." >&2
  exit 1
}

# `|| true`: tsc exits non-zero when it finds errors, which under `set -e` would kill the
# generator at exactly the moment it has something to record. Generators must survive their
# own success AND their own findings.
SIGS="$( (cd "$DIR" && npx tsc --noEmit 2>&1 || true) \
  | sed -nE 's/^(.+)\([0-9]+,[0-9]+\): error (TS[0-9]+).*/\1|\2/p' | sort -u )"

mkdir -p "$(dirname "$OUT")"
N=$(printf '%s\n' "$SIGS" | grep -c . || true); N=${N:-0}
{
  echo "# TYPE ERROR BASELINE - accepted, temporary debt. This file may only shrink."
  echo "# Signature: <file>|<TScode>, deliberately WITHOUT line numbers so an unrelated edit"
  echo "# above a known error does not read as a new one."
  echo "# A NEW signature BLOCKS. A signature fixed but still listed here ALSO BLOCKS."
  echo "# Regenerate: bash scripts/hooks/tsc-baseline.sh"
  echo "# Generated: $(date -u +%F) - $N signature(s)"
  [ "$N" -gt 0 ] && printf '%s\n' "$SIGS"
} > "$OUT"

if [ "$N" -eq 0 ]; then
  echo "wrote $OUT (0 signatures - this is now a CLEAN GATE, not a ratchet)"
else
  echo "wrote $OUT ($N signature(s))"
fi
