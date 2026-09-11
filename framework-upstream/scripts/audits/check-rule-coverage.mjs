#!/usr/bin/env node
/**
 * check-rule-coverage - which binding rules actually have an executable enforcement point?
 *
 * THE FAILURE MODE THIS EXISTS FOR
 *   A rule can be written in a governing document, declared BINDING, restated after each
 *   violation, and violated dozens of times - because nothing ever EXECUTED it. Restating a
 *   rule after it breaks produces a true document and a false codebase.
 *
 *   This audit reads the registers and asks each rule one question: name the path of the
 *   thing that runs you. A rule with no rung is not wrong; it is honest debt, and it must be
 *   COUNTED so the ratchet can stop the count from growing.
 *
 * THE SIGNAL IS A MECHANISM, NOT A WORD
 *   Matching the word "enforced" is worthless: it also matches "this is NOT enforced" - the
 *   exact sentence the audit exists to find. The signal is a concrete path or an explicit
 *   `rung:` declaration. It then verifies the named file EXISTS: a rule pointing at a deleted
 *   spec claims enforcement it does not have, which is worse than claiming none.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { evaluateRatchet, writeBaseline } from '../lib/ratchet.mjs';
import { appPath } from '../lib/layout.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = process.cwd();
const BASELINE = path.resolve(ROOT, arg('--baseline', appPath(ROOT, '.baselines/rule-coverage-baseline.txt')));
const CMD = 'node scripts/audits/check-rule-coverage.mjs --write-baseline';

const REGISTERS = (arg('--registers',
  'docs/registers/CANONICAL_PATTERNS.md,docs/registers/ROOT_CAUSE_REGISTER.md,docs/registers/DESIGN_RULES.md'
)).split(',').map((p) => path.resolve(ROOT, p.trim()));

/* A rule line starts with an ID in the first table cell or as a heading: CP-3, RC-017, DR-2. */
const RULE_ID = /(?:^\|\s*|^#{2,4}\s*)((?:CP|RC|DR|FP)-\d+)\b/;
// Extensions matter: a rule pointing at a .tsx component makes exactly the same enforcement
// claim as one pointing at a .spec.ts, and must be verified the same way. Omitting them made
// an unverified claim look like declared debt.
// A rung claim is either an explicit `rung: <path>` marker, or a path with a DIRECTORY
// separator. A bare filename is deliberately NOT enough: prose that quotes a pattern
// ("...matched .spec.ts|.mjs only...") would otherwise be read as an enforcement claim, and the
// audit would invent a dead rung out of its own documentation.
const RUNG = /(?:rung:\s*`?|`)((?:[\w.-]+\/)+[\w.-]+\.(?:spec\.ts|test\.ts|tsx|jsx|mjs|json|css|py|sh|ts))`?/;

const rules = [];
const deadRungs = [];
const seen = new Map();
let parsedAny = false;

for (const file of REGISTERS) {
  if (!fs.existsSync(file)) continue;
  parsedAny = true;
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  let inFence = false;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    // A fenced block is a TEMPLATE or an example, not a rule definition. Counting it would
    // report a placeholder id as an unenforced rule - a detector must know which parts of its
    // input are examples, or it audits its own documentation.
    if (/^\s*```/.test(raw)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const idm = raw.match(RULE_ID);
    if (!idm) continue;
    const id = idm[1];
    if (seen.has(id)) {
      // The parser keeps the first definition, so a collision would silently mask a rule.
      deadRungs.push(`DUPLICATE|${id}|first in ${seen.get(id)}, again in ${rel}`);
      continue;
    }
    seen.set(id, rel);
    // A table row defines a rule on ONE line; a heading defines one across a BLOCK. Reading only
    // the first line of a block-form rule reports every one of them as prose-only, because the
    // enforcement point is conventionally stated further down under "Prevention".
    // A detector must read the whole definition, not its first line.
    const isHeading = /^#{2,4}\s/.test(raw);
    let scope = raw;
    if (isHeading) {
      const rest = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (/^#{2,4}\s*(?:CP|RC|DR|FP)-\d+\b/.test(lines[j])) break;
        rest.push(lines[j]);
      }
      scope = raw + '\n' + rest.join('\n');
    }

    const rm = scope.match(RUNG);
    if (!rm) { rules.push({ id, rel, rung: null }); continue; }

    const claimed = rm[1];
    const exact = path.resolve(ROOT, claimed);
    let exists = fs.existsSync(exact);
    if (!exists) {
      // Fall back to basename-anywhere: a bare prose mention is not a broken path claim.
      const base = path.basename(claimed);
      const stack = [ROOT];
      while (stack.length && !exists) {
        const d = stack.pop();
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          if (e.name === 'node_modules' || e.name.startsWith('.git')) continue;
          const full = path.join(d, e.name);
          if (e.isDirectory()) stack.push(full);
          else if (e.name === base) { exists = true; break; }
        }
      }
    }
    if (!exists) deadRungs.push(`DEAD-RUNG|${id}|claims ${claimed}, which does not exist`);
    rules.push({ id, rel, rung: claimed });
  }
}

const proseOnly = rules.filter((r) => !r.rung).map((r) => `PROSE-ONLY|${r.id}|${r.rel}`);
const signatures = [...proseOnly, ...deadRungs].sort();

if (argv.includes('--report')) {
  console.log(`${rules.length} rule(s) parsed across ${REGISTERS.filter(fs.existsSync).length} register(s).`);
  console.log(`  with a rung : ${rules.filter((r) => r.rung).length}`);
  console.log(`  prose only  : ${proseOnly.length}`);
  console.log(`  dead/dupe   : ${deadRungs.length}`);
  signatures.forEach((s) => console.log('  ' + s));
  process.exit(0);
}

if (argv.includes('--write-baseline')) {
  const n = writeBaseline(BASELINE, signatures, {
    name: 'RULE COVERAGE',
    regenerateCmd: CMD,
    note: 'PROSE-ONLY entries are honest debt. DEAD-RUNG and DUPLICATE entries should be fixed, not baselined.',
  });
  console.log(`wrote ${path.relative(ROOT, BASELINE)} (${n} entr${n === 1 ? 'y' : 'ies'})`);
  process.exit(0);
}

process.exit(
  evaluateRatchet({
    name: 'RULE COVERAGE',
    signatures,
    baselineFile: BASELINE,
    regenerateCmd: CMD,
    parsedSomething: parsedAny && rules.length > 0,
    remediation:
      'Give the new rule the CHEAPEST workable enforcement point, in this order:\n' +
      '  automated check > checklist item > canonical-pattern row > prose (last resort).\n' +
      '  Then name that path in the rule text itself, as "rung: <path>".',
  })
);
