#!/usr/bin/env node
/**
 * fanout-check - is this plan actually safe to build in parallel?
 *
 * THE FAILURE THIS EXISTS FOR
 *   Parallel code generation fails in four ways, and all four are cheap to prevent and
 *   expensive to discover:
 *
 *     1. TWO AGENTS WRITE ONE FILE. The second write wins and the first agent's work is gone
 *        - silently, because both agents report success. This is the one that costs a whole run.
 *     2. ONE AGENT READS A FILE ANOTHER IS REWRITING. It reads a half-written or stale version
 *        and implements against something that will not exist by the time the run ends.
 *     3. INTERFACE DRIFT. Task A exports `getX(id)`, task B calls `getX(id, opts)`. Each is
 *        internally consistent; the build is broken. The fix is not coordination at the end,
 *        it is a CONTRACT declared before either agent starts.
 *     4. FAN-OUT THAT COSTS MORE THAN IT SAVES. Two tasks split across two agents spend more on
 *        context and coordination than the sequential run would have spent building both.
 *
 *   Every one of these is decidable from the plan, before a single agent is spawned. That is
 *   the cheapest possible moment, which is why this runs there.
 *
 * THE CONTRACT-FIRST RULE (why `reads` may not touch another task's `files`)
 *   A task that needs something another parallel task is writing does NOT read that file. It
 *   implements against the declared `contract` - the exported signature, agreed up front by
 *   the planner. If a task genuinely needs to read the file, the tasks are not independent and
 *   belong in different waves. Refusing this is what keeps "parallel" from meaning "racing".
 *
 * A DETECTOR THAT PARSED NOTHING REPORTS BLOCKED
 *   An empty or unparseable plan is not a clean plan. It exits 2, loudly.
 *
 * USAGE
 *   node scripts/fanout-check.mjs <plan.json> [--report]
 *
 * PLAN SHAPE
 *   { "tasks": [
 *       { "id": "api",
 *         "files":      ["src/lib/x-client.ts"],        // this task WRITES these, exclusively
 *         "reads":      ["src/lib/api-client.ts"],      // may read, must not write
 *         "contract":   ["fetchX(tenantId: string): Promise<X[]>"],
 *         "acceptance": "unit spec covers the empty and error paths" } ] }
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const argv = process.argv.slice(2);
const REPORT = argv.includes('--report');
const planPath = argv.find((a) => !a.startsWith('--'));

const fail = (lines) => {
  console.error('BLOCKED [FAN-OUT]');
  lines.forEach((l) => console.error('  ' + l));
  process.exit(2);
};

if (!planPath) fail(['No plan given.', 'Usage: node scripts/fanout-check.mjs <plan.json>']);
if (!fs.existsSync(planPath)) fail([`Plan not found: ${planPath}`]);

let plan;
try {
  plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
} catch (e) {
  fail([`Plan is not valid JSON: ${e.message}`]);
}

const tasks = Array.isArray(plan?.tasks) ? plan.tasks : null;
// Rule 3's corollary: parsing nothing looks exactly like a clean plan. It is not.
if (!tasks || tasks.length === 0) fail(['Plan declares no tasks. An empty plan is BLOCKED, never a pass.']);

const problems = [];
const norm = (p) => path.normalize(String(p)).replace(/\\/g, '/');

/* --- 1. Every task declares what it owns, what it promises, and how it is judged. --- */
tasks.forEach((t, i) => {
  const where = t?.id ? `task '${t.id}'` : `task #${i + 1}`;
  if (!t?.id) problems.push(`${where}: missing 'id'.`);
  if (!Array.isArray(t?.files) || t.files.length === 0) {
    problems.push(`${where}: must declare the files it OWNS ('files'). A task that owns nothing cannot be given a lane.`);
  }
  if (!Array.isArray(t?.contract) || t.contract.length === 0) {
    problems.push(`${where}: must declare its 'contract' - the exported signatures other tasks may rely on. Write "none" explicitly if it exports nothing.`);
  }
  if (!t?.acceptance) {
    problems.push(`${where}: must declare 'acceptance' - how the task is verified. An unverifiable task cannot be delegated.`);
  }
});

const ids = tasks.map((t) => t?.id).filter(Boolean);
const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupIds.length) problems.push(`Duplicate task id(s): ${[...new Set(dupIds)].join(', ')}.`);

/* --- 2. Write sets are pairwise disjoint. The lost-write failure, prevented. --- */
const owner = new Map();
for (const t of tasks) {
  for (const f of t?.files ?? []) {
    const key = norm(f);
    if (owner.has(key)) {
      problems.push(`COLLISION: '${key}' is written by both '${owner.get(key)}' and '${t.id}'. Two writers means one silently loses. Merge the tasks, or run them in separate waves.`);
    } else {
      owner.set(key, t.id);
    }
  }
}

/* --- 3. No task reads a file another task is rewriting (contract-first). --- */
for (const t of tasks) {
  for (const r of t?.reads ?? []) {
    const key = norm(r);
    const writer = owner.get(key);
    if (writer && writer !== t.id) {
      problems.push(`RACE: '${t.id}' reads '${key}', which '${writer}' is rewriting. Implement against ${writer}'s declared contract instead, or put the tasks in different waves.`);
    }
  }
}

/* --- 4. Fan-out must be worth its overhead. A warning, never a block. --- */
const warnings = [];
if (tasks.length < 3) {
  warnings.push(`Only ${tasks.length} task(s). Fan-out costs a context per agent; below about three independent tasks a sequential build is usually faster. Consider building this inline.`);
}

if (REPORT) {
  console.log(`${tasks.length} task(s); ${owner.size} file(s) owned.`);
  for (const t of tasks) console.log(`  ${t.id}: writes ${(t.files ?? []).length}, reads ${(t.reads ?? []).length}`);
  warnings.forEach((w) => console.log('  WARN  ' + w));
  problems.forEach((p) => console.log('  PROBLEM  ' + p));
  process.exit(problems.length ? 2 : 0);
}

if (problems.length) {
  fail([...problems, '', 'Fix the plan before spawning anything. A collision found here costs a sentence; found after the build it costs the run.']);
}

warnings.forEach((w) => console.error('WARN  [FAN-OUT] ' + w));
console.log(`OK  [FAN-OUT] ${tasks.length} task(s), ${owner.size} file(s), no collisions and no cross-reads.`);
