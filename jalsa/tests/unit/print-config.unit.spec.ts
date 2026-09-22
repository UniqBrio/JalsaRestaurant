/**
 * Gate 6 spec — printer configuration, test print, and the bridge credential.
 *
 * WHY A TEST PRINT IS ASSERTED AS AN ORDINARY JOB
 *   The tempting shape for "Test print" is a small function that opens the printer and writes
 *   `Hello`. It would work, and it would prove almost nothing: not the claim, not the composition,
 *   not the encoder, not the transport, not the report. Then a real ticket would fail later and
 *   the successful test would be evidence for the wrong thing. So the rungs below pin that it is a
 *   row in `print_job` and that no second print path exists anywhere in the tree.
 *
 * WHY THE CREDENTIAL RUNGS READ SOURCE
 *   "The token is never stored" and "the token is never audited" are properties of a WRITE, and a
 *   rung that needs a database is a rung that skips. The precedent is `bridge-contract` and
 *   `print-assignment`, which ask the same kind of question the same way.
 *
 * FAIL-FIRST EVIDENCE (22-Sep-2026): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

import { TEST_TICKET_ITEMS, testTicketHeader } from '../../src/lib/test-ticket';
import { composeTicket } from '../../src/lib/ticket-compose';
import { defaultTemplate, type PaperWidth } from '../../src/lib/print-template';
import type { RoutablePrinter } from '../../src/lib/print-routing';
import { DEFAULT_ENCODER, encodeTicket, hex } from '../../src/lib/escpos';

const read = (p: string): string => readFileSync(p, 'utf8');
const OWNER = read('src/lib/db/owner-mutations.ts');
const ROUTE = read('src/app/api/owner/action/route.ts');
const PAYLOAD = read('src/lib/db/bridge-payload.ts');
const SECTION = read('src/features/owner/sections/PrintSetupSection.tsx');

function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
}

function bodyOf(source: string, name: string): string {
  const start = source.search(new RegExp(`export async function ${name}\\(`));
  if (start === -1) return '';
  const end = source.indexOf('\n}\n', start);
  return end === -1 ? '' : source.slice(start, end);
}

/* ── The parse guard ───────────────────────────────────────────────────── */

test('the sources these rungs reason about were actually read', () => {
  expect(OWNER.length).toBeGreaterThan(10_000);
  expect(ROUTE.length).toBeGreaterThan(5_000);
  expect(bodyOf(OWNER, 'testPrint').length, 'testPrint body').toBeGreaterThan(500);
  expect(bodyOf(OWNER, 'issueBridgeToken').length, 'issueBridgeToken body').toBeGreaterThan(500);
  expect(bodyOf(OWNER, 'no_such_function'), 'and one known not to exist').toBe('');
});

/* ── A test print is an ordinary print job ─────────────────────────────── */

test('a test print INSERTS a print_job and does nothing else', () => {
  const body = code(bodyOf(OWNER, 'testPrint'));
  expect(body).toContain(".from('print_job')");
  expect(body).toContain('.insert(');
  expect(body).toContain("status: 'queued'");
  expect(body).toContain("kind: 'Test'");
});

test('a test print cannot bypass the bridge, the encoder or the transport', () => {
  // There is nowhere in this function to do so: it has no transport, no encoder and no bytes.
  const body = code(bodyOf(OWNER, 'testPrint'));
  for (const forbidden of ['encodeTicket', 'Transport', 'escpos', 'spawn', 'writeFile']) {
    expect(body, `testPrint must not reach ${forbidden}`).not.toContain(forbidden);
  }
});

test('NO SECOND PRINT PATH EXISTS: the encoder has exactly the callers it should', () => {
  // The rung that would catch somebody adding a quick direct-to-printer helper later. `escpos.ts`
  // is imported by the bridge loop, by the specs that pin its bytes, and by nothing else.
  const APPLICATION = [
    'src/lib/db/bridge-payload.ts',
    'src/lib/db/owner-mutations.ts',
    'src/lib/db/mutations.ts',
    'src/lib/ticket-compose.ts',
    'src/app/api/owner/action/route.ts',
  ];
  const grep = (files: string[], needle: string): string[] => files.filter((f) => read(f).includes(needle));

  // The encoder is called in exactly one place in this whole system, and it is the bridge loop.
  expect(grep(['bridge/src/loop.ts'], 'encodeTicket'), 'the bridge loop encodes').toEqual(['bridge/src/loop.ts']);
  expect(grep(APPLICATION, 'encodeTicket'), 'no application module encodes').toEqual([]);
  // And no application module holds a transport, so none of them could send bytes anywhere.
  expect(grep(APPLICATION, 'PrintTransport'), 'no application module holds a transport').toEqual([]);
  expect(grep(APPLICATION, 'transport.send'), 'and none of them sends').toEqual([]);
});

test('a test print records the machine it was sent to, and calls it a chosen one', () => {
  const body = code(bodyOf(OWNER, 'testPrint'));
  // Same reasoning `printElsewhere` records: a person picked the machine, which is not a routing
  // outcome and must not be mistakable for one on the history screen.
  expect(body).toContain("routing_rule: 'chosen'");
  expect(body).toContain("food_side: 'all'");
  expect(body).toContain('printer_name:');
  expect(body).toContain('station:');
});

test('a test print to a switched-off machine is refused, with a reason', () => {
  // SUPERSEDED 22-Sep-2026 at the merge of `main`, under the contract-change exception.
  //
  //   Gate 6 checked `enabled` inline, and this rung pinned that guard EXPRESSION — after an
  //   earlier version of it stayed green under `if (false)` because it only looked for the words
  //   in the message. `main` had independently written `testPrintBlocker()`, one definition of
  //   "is this machine testable" shared by the button and the server, and its own comment gives
  //   the reason: two copies would eventually disagree, and the disagreement would be a button
  //   that does nothing. The merge kept the blocker and dropped the inline check.
  //
  //   So the rung now pins the CALL and the blocker's own guard, which is where the rule moved
  //   to. The property is unchanged: a switched-off machine is refused, and it is told why.
  const body = code(bodyOf(OWNER, 'testPrint'));
  expect(body, 'one shared definition, called').toContain('testPrintBlocker({');
  expect(body, 'and its answer is returned, not thrown').toContain('if (blocker) return { queued: false');
  expect(body, 'no second inline enabled check alongside it').not.toMatch(/===\s*false/);

  const blocker = code(read('src/lib/test-print.ts'));
  expect(blocker, 'switched off is the first thing it refuses').toContain('if (!printer.enabled) return');
  expect(read('src/lib/test-print.ts')).toContain('switched off');
  expect(read('src/lib/test-print.ts')).toContain('Switch it on in Configure first');
});

test('a test print demands the printer permission, like every other printer operation', () => {
  expect(code(bodyOf(OWNER, 'testPrint'))).toContain("demand(input.actor, 'set.printer')");
});

/* ── The test ticket itself ────────────────────────────────────────────── */

test('the test ticket cannot be mistaken for an order', () => {
  // Somebody WILL pick this paper up off a kitchen pass. A plausible `KOT-0000` would send a cook
  // looking for table zero.
  const header = testTicketHeader({
    restaurant: 'JALSA',
    branch: 'Hosur',
    phone: '04344 000000',
    machineName: 'TVS RP 3160 — Kitchen 1',
    machineId: 'KOT-TANDOOR',
    date: '22 Sep 2026',
    time: '7:40 PM',
    actor: 'Owner',
  });

  expect(header.kotCode).toBe('TEST PRINT');
  expect(header.note.toLowerCase()).toContain('nothing here is an order');
  expect(header.source).toContain('KOT-TANDOOR');
  expect(TEST_TICKET_ITEMS[0]?.name.toLowerCase()).toContain('do not cook');
});

test('the test ticket exercises both food headings and the column width', () => {
  const types = new Set(TEST_TICKET_ITEMS.map((i) => i.foodType));
  expect(types.has('veg')).toBe(true);
  expect(types.has('non_veg')).toBe(true);
  // One line longer than a 58 mm roll holds, so a wrong width is visible on paper without
  // measuring anything.
  expect(Math.max(...TEST_TICKET_ITEMS.map((i) => i.name.length))).toBeGreaterThan(42);
});

test('every test-ticket item is unrouted, so no routing configuration can misdirect it', () => {
  for (const item of TEST_TICKET_ITEMS) expect(item.category).toBe('');
});

test('the test ticket composes and encodes at both widths, through the real path', () => {
  const machine: RoutablePrinter = {
    id: 'p1',
    machineId: 'KOT-TANDOOR',
    name: 'TVS RP 3160 — Kitchen 1',
    purpose: 'KOT',
    station: 'Tandoor',
    routes: [],
    online: false,
    enabled: true,
  };

  for (const width of ['58', '80'] as PaperWidth[]) {
    const result = composeTicket({
      job: { id: 'j', kind: 'kot', printerId: 'p1', station: 'Tandoor', foodSide: 'all', isReprint: false },
      width,
      template: defaultTemplate('kot', width),
      printers: [machine],
      splitByFoodType: false,
      header: testTicketHeader({
        restaurant: 'JALSA',
        branch: 'Hosur',
        phone: '',
        machineName: machine.name,
        machineId: machine.machineId,
        date: '22 Sep 2026',
        time: '7:40 PM',
        actor: 'Owner',
      }),
      items: TEST_TICKET_ITEMS,
    });

    expect(result.ok, `${width} mm composes`).toBe(true);
    if (!result.ok) continue;
    expect(result.itemCount, 'every line is on it').toBe(TEST_TICKET_ITEMS.length);
    // Through the real encoder, which is the point.
    const bytes = encodeTicket(result.lines, { ...DEFAULT_ENCODER, width });
    expect(hex(bytes).startsWith('1B 40'), `${width} mm encodes`).toBe(true);
    // And the station reaches it, like any kitchen ticket.
    expect(result.lines.some((l) => l.text.startsWith('STATION'))).toBe(true);
  }
});

test('the payload composes a Test job through composeTicket, not a second builder', () => {
  const p = code(PAYLOAD);
  expect(p).toContain("const TEST_KIND = 'Test'");
  expect(p).toContain('testPayload(');
  const fn = p.slice(p.indexOf('async function testPayload'));
  expect(fn).toContain('composeTicket({');
  expect(fn).toContain('TEST_TICKET_ITEMS');
  expect(fn, 'no second encoder').not.toContain('encodeTicket');
  // Only the assigned machine, with no routes, so it cannot be sent astray by configuration.
  expect(fn).toContain('routes: []');
});

/* ── The bridge credential ─────────────────────────────────────────────── */

test('only the HASH of a token is ever written', () => {
  const body = code(bodyOf(OWNER, 'issueBridgeToken'));
  expect(body).toContain('token_hash: hashToken(token)');
  // The raw token appears in exactly one place in the insert — as the argument being hashed.
  expect(body).not.toMatch(/token:\s*token\s*[,}]/);
  expect(body).toContain('randomBytes(32)');
});

test('the token never reaches the audit trail, not even a prefix', () => {
  const body = code(bodyOf(OWNER, 'issueBridgeToken'));
  // STRENGTHENED 22-Sep-2026, after fail-first. The first version looked for the literal `token)`
  // and stayed GREEN when `${token}` was interpolated into the detail — it matched the punctuation
  // rather than the identifier. The whole identifier is what must be absent.
  // Just the audit CALL. Slicing to the end of the body would sweep in the `return { …, token }`
  // that hands the token to the caller once, which is the one legitimate mention in the function.
  const from = body.indexOf('await audit(');
  const audit = body.slice(from, body.indexOf('});', from) + 3);
  expect(audit).toContain('label');

  // THE IDENTIFIER, NOT THE ENGLISH WORD. The detail legitimately reads "Bridge token issued
  // for …", so a bare /\btoken\b/ goes red on the sentence rather than on the value — the first
  // attempt at this rung did exactly that. What must be absent is `token` as an EXPRESSION:
  // interpolated into the message, or referenced outside a string literal.
  const interpolations = [...audit.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1] ?? '');
  expect(interpolations.length, 'the detail does interpolate something').toBeGreaterThan(0);
  for (const expr of interpolations) {
    expect(expr, `no interpolation may carry the token: \${${expr}}`).not.toMatch(/\btoken\b/);
  }

  const outsideStrings = audit.replace(/`[^`]*`/g, '``').replace(/'[^']*'/g, "''");
  expect(outsideStrings, 'and it is never passed as a value').not.toMatch(/\btoken\b/);

  expect(audit).toContain('confidential: true');
});

test('the token is returned exactly once and can never be read back', () => {
  // `listBridgeTokens` is the only read, and it selects columns by name.
  const queries = code(read('src/lib/db/queries.ts'));
  const listing = queries.slice(queries.indexOf('export async function listBridgeTokens'));
  expect(listing).toContain("select('id,label,created_at,last_seen_at,revoked_at')");
  expect(listing, 'the hash is not even exposed').not.toContain('token_hash');
});

test('revoking is a timestamp, never a delete', () => {
  // The job history says which PC carried which ticket. A deleted label makes last Tuesday
  // unreadable.
  const body = code(bodyOf(OWNER, 'revokeBridgeToken'));
  expect(body).toContain('revoked_at:');
  expect(body).not.toContain('.delete(');
  // And revoking an already-revoked token is refused rather than silently repeated.
  expect(body).toContain(".is('revoked_at', null)");
});

test('issuing and revoking demand the printer permission', () => {
  for (const fn of ['issueBridgeToken', 'revokeBridgeToken', 'testPrint']) {
    expect(code(bodyOf(OWNER, fn)), fn).toContain("demand(input.actor, 'set.printer')");
  }
});

/* ── The console ───────────────────────────────────────────────────────── */

test('the console can send a test print and can manage bridges', () => {
  for (const action of ['test-print', 'issue-bridge-token', 'revoke-bridge-token']) {
    expect(ROUTE, `${action} is routed`).toContain(`case '${action}':`);
    expect(ROUTE, `${action} is typed`).toContain(`action: '${action}'`);
  }
});

test('the screen shows the token once and says so', () => {
  expect(SECTION).toContain('owner-bridge-token-value');
  expect(SECTION).toContain('It is shown once');
  // The Test print control exists per machine, and is disabled for a switched-off one.
  expect(SECTION).toContain('owner-print-test-');
  expect(SECTION).toContain('!p.enabled');
});

test('the screen never SENDS a token, only receives one', () => {
  // A token travels in exactly one direction: out, once, in the response that created it. The
  // issue request carries a label and nothing else, and no other request carries a token at all.
  const ui = code(SECTION);

  const sends = [...ui.matchAll(/send\('\/api\/owner\/action',\s*\{([^}]*)\}/g)].map((m) => m[1] ?? '');
  expect(sends.length, 'the panel does send things').toBeGreaterThan(0);
  for (const payload of sends) {
    expect(payload, `no request may carry a token: ${payload.trim()}`).not.toMatch(/\btoken\s*:/);
  }
  expect(ui).toContain("action: 'issue-bridge-token', label");
});
