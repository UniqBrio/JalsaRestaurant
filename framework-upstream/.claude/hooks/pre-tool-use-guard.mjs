#!/usr/bin/env node
/**
 * PreToolUse adapter — the bridge between Claude Code's hook protocol and the git guard.
 *
 * WHY AN ADAPTER RATHER THAN CALLING THE GUARD DIRECTLY
 *   The two see different worlds. A git pre-commit hook runs AFTER the message is written to
 *   .git/COMMIT_EDITMSG and can read the staged index. A PreToolUse hook runs BEFORE the command
 *   executes, so the commit does not exist yet — the message is still inside the command string.
 *
 *   Reading only COMMIT_EDITMSG here would find the PREVIOUS commit's message, which silently
 *   voids every escape token and blocks work that was correctly justified. The adapter's whole
 *   job is to hand the guard the same CHANGE, expressed the way that mode expresses it.
 *
 * PROTOCOL
 *   stdin  : JSON with { tool_name, tool_input: { command } }
 *   exit 0 : allow
 *   exit 2 : BLOCK, and stderr is shown to the agent as the reason
 *   Any other exit is treated as non-blocking. So a bug in THIS file cannot wedge a session —
 *   it fails open, loudly, which is the same contract the guards themselves follow.
 *
 * Install: referenced from .claude/settings.json. Nothing else needed.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ALLOW = 0;
const BLOCK = 2;

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

let payload = {};
try {
  payload = JSON.parse(readStdin() || '{}');
} catch {
  // Unparseable input is a protocol problem, not a policy violation. Never block on it.
  process.exit(ALLOW);
}

const command = String(payload?.tool_input?.command ?? '');
if (!command) process.exit(ALLOW);

// Only git commit and git push are governed. Everything else passes untouched — a hook that
// inspects every command is a hook that gets disabled for being slow.
const isCommit = /\bgit\s+(?:-[^\s]+\s+)*commit\b/.test(command);
const isPush = /\bgit\s+(?:-[^\s]+\s+)*push\b/.test(command);
if (!isCommit && !isPush) process.exit(ALLOW);

// `--no-verify` bypasses git's own hooks. It must not also bypass this one, or the guards are
// one flag away from being decorative.
const noVerify = /(^|\s)(--no-verify|-n)(\s|$)/.test(command);

const repoRoot = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
})();
if (!repoRoot) process.exit(ALLOW); // not a git repository — nothing to guard

let guard = path.join(repoRoot, 'scripts', 'hooks', 'pre-commit-guard.sh');
if (!fs.existsSync(guard)) {
  // A workspace-mode app LINKS the process half rather than copying it, so the guard lives in
  // the framework, named by .framework-link.json. Without this lookup the DEFAULT scaffold
  // shipped with no commit guards at all - the adapter warned and allowed, on every commit,
  // in exactly the mode most apps use.
  try {
    const link = JSON.parse(fs.readFileSync(path.join(repoRoot, '.framework-link.json'), 'utf8'));
    const linked = path.resolve(repoRoot, String(link.framework ?? ''), 'scripts', 'hooks', 'pre-commit-guard.sh');
    if (fs.existsSync(linked)) guard = linked;
  } catch { /* no link file, or unreadable - fall through to the audible warning */ }
}
if (!fs.existsSync(guard)) {
  // Fail OPEN, but AUDIBLY. A dead guard must never be silent.
  console.error('[framework] pre-commit-guard.sh not found — commit guards are NOT running.');
  process.exit(ALLOW);
}

/**
 * Recover the escape text the way each mode expresses it.
 *   commit : the message is in the command  (-m "...", or a heredoc, or -F file)
 *   push   : the messages are in the commits being pushed, so read the log range
 * Getting this wrong is the classic failure — a token written at commit time is invisible at
 * push time, and every guard silently rejects a correctly justified change.
 */
function escapeTextForCommit() {
  const parts = [];
  for (const re of [/-m\s+"((?:[^"\\]|\\.)*)"/g, /-m\s+'([^']*)'/g, /--message[= ]\s*"((?:[^"\\]|\\.)*)"/g]) {
    for (const m of command.matchAll(re)) parts.push(m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'));
  }
  // Heredoc form: git commit -m "$(cat <<'EOF' ... EOF)"
  const heredoc = command.match(/<<-?\s*'?(\w+)'?\n([\s\S]*?)\n\s*\1/);
  if (heredoc) parts.push(heredoc[2]);
  // -F <file>
  const fileFlag = command.match(/(?:-F|--file)\s+(\S+)/);
  if (fileFlag) {
    try { parts.push(fs.readFileSync(path.resolve(repoRoot, fileFlag[1]), 'utf8')); } catch { /* ignore */ }
  }
  return parts.join('\n');
}

function pushRange() {
  try {
    const upstream = execFileSync('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], {
      cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return `${upstream}..HEAD`;
  } catch {
    return 'HEAD~1..HEAD'; // no upstream yet — the first push of a new branch
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-'));
const msgFile = path.join(tmp, 'COMMIT_EDITMSG');
fs.writeFileSync(msgFile, isCommit ? escapeTextForCommit() : '', 'utf8');

const env = { ...process.env };
if (isPush) env.PRE_PUSH_RANGE = pushRange();

const result = spawnSync('bash', [guard, msgFile], {
  cwd: repoRoot,
  env,
  encoding: 'utf8',
  timeout: 110_000,
});

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }

if (result.error || result.status === null) {
  console.error(`[framework] guard could not run (${result.error?.message ?? 'timeout'}) — NOT enforced for this command.`);
  process.exit(ALLOW);
}

if (result.status === BLOCK) {
  console.error(result.stderr || 'Blocked by a framework commit guard.');
  console.error('');
  console.error('Each guard has its OWN escape token, and it excuses only that guard.');
  console.error('There is no global bypass — put the token, with a justification, in the commit message.');
  process.exit(BLOCK);
}

if (noVerify && result.status === 0) {
  console.error('[framework] note: --no-verify skips git\'s own hooks. The framework guards ran anyway.');
}

if (result.stderr?.trim()) console.error(result.stderr.trim()); // SKIPPED warnings stay audible
process.exit(ALLOW);
