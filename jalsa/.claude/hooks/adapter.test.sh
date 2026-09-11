#!/usr/bin/env bash
# adapter.test.sh - EXECUTE the PreToolUse adapter against the hook protocol.
#
# WHY THIS EXISTS SEPARATELY FROM guard-reachability.test.sh
#   That test proves each GUARD can fire. This one proves the guards are ever REACHED — that the
#   adapter parses the hook payload, recovers the escape text the way each mode expresses it, and
#   returns the exit code the protocol expects.
#
#   A correct guard behind a broken adapter enforces exactly nothing, and looks installed.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ADAPTER="$ROOT/.claude/hooks/pre-tool-use-guard.mjs"
PASS=0; FAIL=0

scratch() {
  local d; d="$(mktemp -d)"
  ( cd "$d"
    git init -q .; git config user.email t@t.t; git config user.name t
    mkdir -p src scripts/hooks
    cp "$ROOT/scripts/hooks/pre-commit-guard.sh" scripts/hooks/
    printf '# Test summary\n\n---\n\n' > TEST_SUMMARY.md
    git add -A >/dev/null; git commit -qm init >/dev/null )
  echo "$d"
}

run() { # <dir> <command-json-string> -> exit code
  ( cd "$1"; printf '%s' "$2" | node "$ADAPTER" >/dev/null 2>&1 )
  echo $?
}

expect() { # <label> <want> <got>
  if [ "$3" -eq "$2" ]; then echo "  PASS  $1 (exit $3)"; PASS=$((PASS+1))
  else echo "  FAIL  $1 (expected $2, got $3)"; FAIL=$((FAIL+1)); fi
}

echo "adapter: routing"
d=$(scratch)
expect "ignores a non-git command"        0 "$(run "$d" '{"tool_name":"Bash","tool_input":{"command":"ls -la"}}')"
expect "ignores git status"               0 "$(run "$d" '{"tool_name":"Bash","tool_input":{"command":"git status"}}')"
expect "survives malformed JSON"          0 "$(run "$d" 'not json at all')"
expect "survives an empty payload"        0 "$(run "$d" '{}')"

echo "adapter: blocking"
d=$(scratch); ( cd "$d"; echo "export const x=1" > src/a.ts; git add -A >/dev/null )
expect "blocks a guarded commit"          2 "$(run "$d" '{"tool_name":"Bash","tool_input":{"command":"git commit -m \"feat: add x\""}}')"

echo "adapter: escape text is recovered from the COMMAND, not a stale message file"
d=$(scratch); ( cd "$d"; echo "export const x=1" > src/a.ts
  printf 'Gate run\n' >> TEST_SUMMARY.md; echo notes > docs.md; git add -A >/dev/null )
expect "-m double-quoted token honoured"  0 "$(run "$d" '{"tool_name":"Bash","tool_input":{"command":"git commit -m \"feat: x\n\nCASES-NA: pure type export\""}}')"

d=$(scratch); ( cd "$d"; echo "export const x=1" > src/a.ts
  printf 'Gate run\n' >> TEST_SUMMARY.md; echo notes > docs.md; git add -A >/dev/null )
expect "heredoc token honoured"           0 "$(run "$d" "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git commit -m \\\"\$(cat <<'EOM'\nfeat: x\n\nCASES-NA: pure type export\nEOM\n)\\\"\"}}")"

echo "adapter: --no-verify does not bypass"
d=$(scratch); ( cd "$d"; echo "export const x=1" > src/a.ts; git add -A >/dev/null )
expect "still blocks under --no-verify"   2 "$(run "$d" '{"tool_name":"Bash","tool_input":{"command":"git commit --no-verify -m \"feat: sneak\""}}')"

echo "adapter: a WORKSPACE app finds the guard through .framework-link.json"
d=$(mktemp -d)
# No scripts/ of its own - the process half is linked, exactly like a workspace scaffold.
( cd "$d"; git init -q .; git config user.email t@t.t; git config user.name t
  mkdir -p src
  printf '# Test summary\n\n---\n\n' > TEST_SUMMARY.md
  # cygpath gives node a path it can read on Windows; elsewhere the shell path is already fine.
  FWPATH="$(cygpath -m "$ROOT" 2>/dev/null || echo "$ROOT")"
  printf '{"framework":"%s","halfA":["scripts"]}\n' "$FWPATH" > .framework-link.json
  git add -A >/dev/null; git commit -qm init >/dev/null
  echo "export const x=1" > src/a.ts; git add -A >/dev/null )
expect "linked guard still blocks"        2 "$(run "$d" '{"tool_name":"Bash","tool_input":{"command":"git commit -m \"feat: add x\""}}')"

echo "adapter: fails OPEN and audibly when the guard is absent"
d=$(scratch); ( cd "$d"; rm -f scripts/hooks/pre-commit-guard.sh 2>/dev/null || true
  echo "export const x=1" > src/a.ts; git add -A >/dev/null )
expect "allows when guard file is gone"   0 "$(run "$d" '{"tool_name":"Bash","tool_input":{"command":"git commit -m \"feat: x\""}}')"

echo
echo "$PASS passed, $FAIL failed."
[ "$FAIL" -eq 0 ] || exit 1
