#!/usr/bin/env node
/**
 * par - run independent checks CONCURRENTLY, and report what each one cost.
 *
 * WHY THIS EXISTS
 *   `audit:all` and `guard:test` were `&&` chains: ten and six independent processes run one
 *   after another, each waiting on a predecessor it shares nothing with. Measured 08-Sep-2026,
 *   that was 17.7s and 60.2s. Nothing about them is ordered - every audit reads the tree and
 *   writes only its own baseline, and every guard suite builds its own scratch directory - so
 *   the ordering was habit, not a constraint.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   It does NOT parallelise `npm run gate`. The gate is ordered ON PURPOSE: cheapest and
 *   broadest first, and a step runs only if its prerequisite passed. There is no value in
 *   running a browser suite against code that does not compile, and a concurrent gate would
 *   spend the machine proving things about a tree already known to be broken. Speed that costs
 *   the prerequisite order is not a saving, it is a different, worse gate.
 *
 * FAILURE IS AGGREGATED, NEVER SHORTENED
 *   An `&&` chain stops at the first failure, so you fix one thing, re-run, and discover the
 *   next. Every task here runs to completion and EVERY failure is reported together. That is
 *   strictly more information per run - and it is the reason this is not merely faster.
 *
 * OUTPUT IS ORDERED BY DECLARATION, NOT BY COMPLETION
 *   Concurrent output interleaves into nonsense. Each task's output is buffered and printed in
 *   the order the tasks were declared, so two runs of the same suite are diffable.
 *
 * USAGE
 *   node scripts/par.mjs "<label>=<command>" ["<label>=<command>" ...] [--jobs <n>] [--serial]
 *   --serial runs them one at a time - the escape hatch when a failure needs isolating.
 */
import { spawn } from 'node:child_process';
import os from 'node:os';
import process from 'node:process';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const SERIAL = argv.includes('--serial');
// Default to the machine's parallelism, capped: past a point the tasks contend for the same
// disk and each one gets slower, so the wall-clock stops improving and the report gets noisier.
const JOBS = SERIAL ? 1 : Math.max(1, Math.min(Number(flag('--jobs', os.cpus()?.length || 4)) || 4, 8));

const tasks = argv
  .filter((a) => !a.startsWith('--') && a.includes('='))
  .filter((a, i, all) => all.indexOf(a) === i)
  .map((spec) => {
    const at = spec.indexOf('=');
    return { label: spec.slice(0, at), cmd: spec.slice(at + 1) };
  });

if (!tasks.length) {
  console.error('par: no tasks. Usage: par.mjs "<label>=<command>" [...] [--jobs <n>] [--serial]');
  process.exit(2);
}

const fmt = (ms) => (ms < 1000 ? `${ms}ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(ms / 60_000)}m ${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')}s`);

function run(task) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    // shell:true so a task can be any command line, exactly as it read in the npm script.
    const child = spawn(task.cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', (e) => resolve({ ...task, code: -1, ms: Date.now() - startedAt, out: `could not launch: ${e.message}\n` }));
    child.on('close', (code) => resolve({ ...task, code, ms: Date.now() - startedAt, out }));
  });
}

/** A fixed-size worker pool: start JOBS tasks, and start the next as each finishes. */
async function pool(items, size, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) results[i] = await fn(items[i], i);
  });
  await Promise.all(workers);
  return results;
}

const runStartedAt = Date.now();
const results = await pool(tasks, JOBS, run);
const totalMs = Date.now() - runStartedAt;

// Exit 3 is the gate's third value - BLOCKED, the check could not run - and it is reported as
// exactly that, never as FAIL. The tasks behind audit:all are ratchets; a ratchet with no
// baseline exits 3, and the one thing worse than a dead gate is a dead gate reported as a
// broken codebase. The whole run then exits 3 unless something genuinely FAILED, which outranks.
const verdict = (code) => (code === 0 ? 'OK  ' : code === 3 ? 'BLKD' : 'FAIL');
for (const r of results) {
  const head = `${verdict(r.code)} ${r.label} (${fmt(r.ms)})`;
  console.log(`\n=== ${head} ===`);
  process.stdout.write(r.out.trimEnd() + '\n');
}

const failed = results.filter((r) => r.code !== 0 && r.code !== 3);
const blocked = results.filter((r) => r.code === 3);
// Serial cost is the honest comparison: the sum of what the tasks actually took. Reporting a
// speed-up against anything else would be flattering the tool rather than measuring it.
const serialMs = results.reduce((a, r) => a + r.ms, 0);
const slowest = results.reduce((a, b) => (b.ms > a.ms ? b : a));

console.log('\n' + '-'.repeat(70));
console.log(`${results.length - failed.length - blocked.length}/${results.length} passed in ${fmt(totalMs)}`
  + `${SERIAL ? ' (serial)' : ` with ${JOBS} jobs`} - serial cost would be ${fmt(serialMs)}.`);
console.log(`Slowest: ${slowest.label} (${fmt(slowest.ms)})`
  + `${SERIAL ? '' : ' - the floor for this set, since nothing finishes before its longest task.'}`);
if (blocked.length) {
  console.log(`\nBLOCKED: ${blocked.map((b) => b.label).join(', ')}`);
  console.log('These checks could not run. That is not a pass: make them runnable or accept the gap in writing.');
}
if (failed.length) {
  console.log(`\nFAILED: ${failed.map((f) => f.label).join(', ')}`);
  console.log('Every task ran to completion - the list above is complete, not the first failure.');
}
process.exit(failed.length ? 1 : blocked.length ? 3 : 0);
