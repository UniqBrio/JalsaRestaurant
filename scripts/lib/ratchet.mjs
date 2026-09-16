/**
 * ratchet - the generic "no worse than yesterday" gate engine.
 *
 * THE PROBLEM IT SOLVES
 *   A rule that is written down but never executed is not a rule; it is a wish. But a CLEAN
 *   gate turned on over an existing backlog blocks every commit on day one, so it gets
 *   switched off within a day - and the rule goes back to being a wish, now with the added
 *   confidence of a document claiming it is enforced.
 *
 *   A ratchet resolves that: it does not demand clean, it demands NO WORSE. You can adopt any
 *   rule today, on any codebase, and the backlog can only shrink.
 *
 * THE TWO-SIDED CHECK (the half that is usually forgotten)
 *   - A signature present now but absent from the baseline -> BLOCK. "You introduced this."
 *   - A signature in the baseline but absent now         -> ALSO BLOCK. "You fixed it; delist it."
 *   Without the second half the file never shrinks, and a genuine regression can hide inside a
 *   stale exemption forever.
 *
 * SIGNATURE DESIGN
 *   A signature must be stable under UNRELATED edits or the ratchet cries wolf and gets
 *   disabled. Include the file and the rule; exclude line and column numbers - inserting a
 *   blank line above a known violation is not a new violation.
 *
 * THREE VALUES, AND "DID NOT RUN" IS THE THIRD
 *   A missing baseline means the check DID NOT RUN. It exits 3 - the gate's word for exactly
 *   that - never 0. It used to exit 0 while printing "this gate is INERT and is telling you
 *   so": it told stderr, and the thing that decides reads the exit code. So the gate runner,
 *   which has a third verdict precisely so that "did not run" is never mistaken for "passed",
 *   recorded every baseline-less ratchet as PASS. Observed on a real scaffold with no service
 *   worker and no PWA baseline: G12 PASS. Green by omission, at the one layer built to prevent
 *   it, in every ratchet, in any app missing a baseline.
 *
 *   Exit 3 is not 2. A FAIL says "your code is broken"; this says "nothing checked it", and a
 *   gate that confuses the two is a gate people learn to ignore. par.mjs and gate-runner.mjs
 *   both read 3 as BLOCKED. upgrade.mjs probes for the phrase "no baseline at" and writes the
 *   baseline, so an app that upgrades never meets this exit - which is what makes it safe.
 *   A dead gate must be AUDIBLE, and an exit code is the only thing every caller hears.
 *   rung: scripts/ratchet.test.sh
 */
import fs from 'node:fs';
import path from 'node:path';

export const RATCHET_OK = 0;
export const RATCHET_BLOCK = 2;
export const RATCHET_SKIP = 3;   // BLOCKED: the check did not run. Never 0 - see the header.

export function readBaseline(file) {
  if (!fs.existsSync(file)) return null;
  return new Set(
    fs.readFileSync(file, 'utf8')
      .split('\n')
      // The dead-weight header says "add a reason beside any entry you keep" - honour it.
      // Without this strip, an annotated entry stops matching and the ratchet blocks the
      // exact entry a human just justified. Signatures never contain " #".
      .map((l) => l.replace(/\s+#.*$/, '').trim())
      .filter((l) => l && !l.startsWith('#'))
  );
}

export function writeBaseline(file, signatures, { name, regenerateCmd, note }) {
  const sorted = [...new Set(signatures)].sort();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const header = [
    `# ${name} BASELINE - accepted, temporary debt. Not an allowlist: this file may only shrink.`,
    `# A NEW signature BLOCKS. A signature fixed but still listed here ALSO BLOCKS (regenerate).`,
    note ? `# ${note}` : null,
    `# Regenerate: ${regenerateCmd}`,
    `# Generated: ${new Date().toISOString().slice(0, 10)} - ${sorted.length} entr${sorted.length === 1 ? 'y' : 'ies'}`,
    '',
  // filter(x => x !== null), NOT filter(Boolean): the trailing '' is the header's final
  // newline. filter(Boolean) stripped it, gluing the FIRST ENTRY onto the last comment line -
  // where readBaseline() then discarded it as a comment. Every clean (0-entry) baseline masked
  // this; the first 1-entry baseline exposed it (found by fixtures/with-debt). A ratchet that
  // silently loses its first entry reports that entry as "new" forever.
  ].filter((x) => x !== null).join('\n');
  fs.writeFileSync(file, header + sorted.join('\n') + (sorted.length ? '\n' : ''), 'utf8');
  return sorted.length;
}

/**
 * @param {object} o
 * @param {string}   o.name           Human name used in messages.
 * @param {string[]} o.signatures     Current violations. MUST be [] only when genuinely clean.
 * @param {string}   o.baselineFile
 * @param {string}   o.regenerateCmd
 * @param {string}   o.remediation    What the developer should actually do.
 * @param {boolean}  [o.parsedSomething=true] False if the detector could not read its input.
 *                    A detector that parsed nothing must report BLOCKED, never success - a
 *                    scan matching zero files looks identical to a clean codebase.
 */
export function evaluateRatchet(o) {
  const { name, signatures, baselineFile, regenerateCmd, remediation, parsedSomething = true } = o;

  if (!parsedSomething) {
    console.error(`BLOCKED [${name}]: the detector produced no readable input.`);
    console.error('  A scan that matched nothing is indistinguishable from a clean tree. That is a defect, not a pass.');
    // 3, not 2. This line has always SAID "BLOCKED" and then exited 2, which the gate renders
    // as FAIL - "your code is broken" about a tree nothing looked at. The verdict for "could
    // not verify" is the third value, and the message and the exit code must be the same word.
    return RATCHET_SKIP;
  }

  const now = new Set(signatures);
  const base = readBaseline(baselineFile);

  if (base === null) {
    // "no baseline at" is load-bearing: upgrade.mjs greps for it to know what to baseline.
    console.error(`BLOCKED [${name}] - no baseline at ${baselineFile}.`);
    console.error(`  Create one: ${regenerateCmd}`);
    console.error(`  Until then this check cannot run, and a check that did not run is not a pass.`);
    return RATCHET_SKIP;
  }

  const introduced = [...now].filter((s) => !base.has(s));
  const fixedButListed = [...base].filter((s) => !now.has(s));
  let exit = RATCHET_OK;

  if (introduced.length) {
    exit = RATCHET_BLOCK;
    console.error(`\nBLOCKED [${name}] - ${introduced.length} new violation(s):`);
    introduced.slice(0, 40).forEach((s) => console.error(`  + ${s}`));
    if (introduced.length > 40) console.error(`  ... and ${introduced.length - 40} more`);
    console.error(`\n  ${remediation}`);
  }

  if (fixedButListed.length) {
    exit = RATCHET_BLOCK;
    console.error(`\nBLOCKED [${name}] - ${fixedButListed.length} baselined item(s) now pass but are still listed:`);
    fixedButListed.slice(0, 40).forEach((s) => console.error(`  - ${s}`));
    console.error(`\n  A ratchet must shrink when it is paid down, or a regression can hide inside it.`);
    console.error(`  Fix: ${regenerateCmd}   then commit the baseline.`);
  }

  if (exit === RATCHET_OK) {
    console.log(`OK [${name}] ${now.size} known violation(s), none new.${now.size === 0 ? ' Backlog is zero - this is now a CLEAN GATE.' : ''}`);
  }
  return exit;
}

/** Recursive file walk with sane excludes. Shared so every audit sees the same tree. */
export function walk(dir, { exts = ['.ts', '.tsx', '.js', '.jsx'], skip = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.out'] } = {}, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.baselines') continue;
    if (skip.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, { exts, skip }, out);
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}
