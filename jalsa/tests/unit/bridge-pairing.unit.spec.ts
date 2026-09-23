/**
 * Pairing spec — a code the owner reads off a screen becomes a computer's credential, exactly once.
 *
 * WHAT IS EXECUTED AND WHAT IS READ
 *   EXECUTED: the code arithmetic (`bridge-pairing-code.ts`), the bridge's side of the exchange
 *   (`pairing.ts`, against an injected fetch), and the installer command (`cli.ts`, against a
 *   temporary directory). READ: the server's redeem, which needs Postgres — its single-use spend,
 *   its restaurant scoping and its hashing are pinned from source the way `bridge-contract` pins
 *   the claim, because a rung that needs a database is a rung that skips.
 *
 * FAIL-FIRST EVIDENCE (23-Sep-2026): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PAIRING_ALPHABET,
  PAIRING_CODE_LENGTH,
  PAIRING_MESSAGES,
  PAIRING_TTL_MINUTES,
  formatPairingCode,
  hashPairingCode,
  newPairingCode,
  normalizePairingCode,
  pairingExpiry,
  pairingVerdict,
} from '../../src/lib/bridge-pairing-code';
import { hashToken } from '../../src/lib/bridge-token';
import { NO_NETWORK, pairComputer, tidyCode } from '../../bridge/src/pairing';
import { EXIT, pairCommand, type CliDeps } from '../../bridge/src/cli';
import { nodeConfigFs, readPairedConfig } from '../../bridge/src/paired-config';

const read = (p: string): string => readFileSync(p, 'utf8');
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
function bodyOf(source: string, name: string): string {
  const start = source.search(new RegExp(`(export )?async function ${name}\\(`));
  expect(start, `${name} exists`).toBeGreaterThan(-1);
  const end = source.indexOf('\n}\n', start);
  return source.slice(start, end);
}

/* ── The code itself ───────────────────────────────────────────────────── */

test('a code is eight characters from an alphabet with no look-alikes', () => {
  expect(PAIRING_ALPHABET).not.toMatch(/[0OI1L]/);
  for (let i = 0; i < 200; i += 1) {
    const c = newPairingCode();
    expect(c).toHaveLength(PAIRING_CODE_LENGTH);
    for (const ch of c) expect(PAIRING_ALPHABET).toContain(ch);
  }
  // Two hundred draws from 31^8 must not collide; if they do the generator is not random.
  expect(new Set(Array.from({ length: 200 }, newPairingCode)).size).toBe(200);
});

test('the space is large enough that guessing is not a strategy', () => {
  expect(PAIRING_ALPHABET.length ** PAIRING_CODE_LENGTH).toBeGreaterThan(1e11);
  expect(PAIRING_TTL_MINUTES).toBeLessThanOrEqual(10);
});

test('what a person types is forgiven for case, spaces and dashes — and nothing else', () => {
  expect(normalizePairingCode('abcd-efgh')).toBe('ABCDEFGH');
  expect(normalizePairingCode(' ab cd ef gh ')).toBe('ABCDEFGH');
  expect(formatPairingCode('ABCDEFGH')).toBe('ABCD-EFGH');
  // A character outside the alphabet is a mistyping, not something to guess at.
  expect(normalizePairingCode('ABCD-EFG0')).toBeNull();
  expect(normalizePairingCode('ABCDEFG')).toBeNull();
  expect(normalizePairingCode('ABCDEFGHJ')).toBeNull();
  expect(normalizePairingCode(12345678)).toBeNull();
  expect(normalizePairingCode(null)).toBeNull();
  expect(tidyCode('abcd-efgh ')).toBe('ABCDEFGH');
});

test('a code is stored by its hash, in a different namespace from tokens', () => {
  const h = hashPairingCode('ABCDEFGH');
  expect(h).toMatch(/^[0-9a-f]{64}$/);
  expect(h).not.toBe(hashToken('ABCDEFGH'));
  expect(h).toBe(hashPairingCode('ABCDEFGH'));
});

test('the verdicts: unknown, used, expired, ok — in that order of precedence', () => {
  const now = new Date('2026-09-23T10:00:00Z');
  expect(pairingVerdict(null, now)).toBe('unknown');
  expect(pairingVerdict({ expires_at: '2026-09-23T10:05:00Z', used_at: '2026-09-23T09:59:00Z' }, now)).toBe('used');
  expect(pairingVerdict({ expires_at: '2026-09-23T09:59:59Z', used_at: null }, now)).toBe('expired');
  expect(pairingVerdict({ expires_at: '2026-09-23T10:00:00Z', used_at: null }, now)).toBe('expired');
  expect(pairingVerdict({ expires_at: '2026-09-23T10:00:01Z', used_at: null }, now)).toBe('ok');
  expect(pairingExpiry(now)).toBe('2026-09-23T10:10:00.000Z');
  // Every refusal is a sentence that names the next step, not a code.
  for (const m of Object.values(PAIRING_MESSAGES)) expect(m).toMatch(/Jalsa/);
});

/* ── The server's spend, read from source ──────────────────────────────── */

const PAIRING = read('src/lib/db/bridge-pairing.ts');
const PAIR_ROUTE = read('src/app/api/bridge/pair/route.ts');
const OWNER = read('src/lib/db/owner-mutations.ts');
const MIGRATION = read('supabase/migrations/20260923090000_jalsa_print_bridge_pairing.sql');

test('the sources this rung reasons about were actually read', () => {
  expect(PAIRING.length).toBeGreaterThan(2000);
  expect(PAIR_ROUTE.length).toBeGreaterThan(800);
  expect(MIGRATION).toContain('create table if not exists public.bridge_pairing_code');
});

test('SINGLE-USE: the spend is one conditional update on used_at IS NULL and not yet expired', () => {
  const r = code(bodyOf(PAIRING, 'redeemPairingCode'));
  const spend = r.slice(r.indexOf(".from('bridge_pairing_code')"), r.indexOf('.select(', r.indexOf(".from('bridge_pairing_code')")));
  expect(spend).toContain('.update({ used_at:');
  expect(spend).toContain(".is('used_at', null)");
  expect(spend).toContain(".gt('expires_at',");
  expect(spend).toContain(".eq('code_hash', codeHash)");
  // No read of the code row before the update: read-then-write is how two installers both win.
  expect(r.indexOf(".update({ used_at:")).toBeLessThan(r.indexOf(".select('expires_at,used_at')"));
});

test('RESTAURANT-SCOPED BY WHERE IT CAME FROM: the token takes restaurant_id from the code row, never the request', () => {
  const r = code(bodyOf(PAIRING, 'redeemPairingCode'));
  expect(r).toContain('restaurant_id: restaurantId');
  expect(r).toContain('const restaurantId = row.restaurant_id as string;');
  // The request type has no restaurant field, and the route reads none.
  expect(PAIR_ROUTE).not.toMatch(/restaurant(Id|_id)/);
  expect(code(PAIR_ROUTE)).not.toContain('currentRestaurantId');
  // And the code hash is the only lookup key — nothing else the PC sends selects a row.
  expect(r).toContain('hashPairingCode(input.code)');
});

test('what is stored is a hash; what is returned is the token, once', () => {
  const r = code(bodyOf(PAIRING, 'redeemPairingCode'));
  expect(r).toContain('token_hash: hashToken(token)');
  expect(r).toContain("source: 'paired'");
  expect(r).toContain('randomBytes(32)');
  // The audit line carries the label and the PC's name, never the code or the token.
  const auditBlock = r.slice(r.indexOf(".from('audit_entry')"), r.indexOf('confidential: true'));
  expect(auditBlock).toContain('detail:');
  expect(auditBlock).not.toMatch(/\$\{token\}|\$\{input\.code\}|codeHash/);
});

test('the pair route is the ONLY unauthenticated door, and it can only spend a code', () => {
  const src = code(PAIR_ROUTE);
  expect(src).not.toContain('authenticateBridge');
  expect(src).toContain('redeemPairingCode');
  for (const forbidden of ['listBridgeJobs', 'claimPrintJob', 'reportPrintJob', 'print_job', 'syncBridge', 'issueBridgeToken']) {
    expect(src, `the pair route must not reach ${forbidden}`).not.toContain(forbidden);
  }
  // Spent or stale → 410; never existed → 400. Same sentence shape either way.
  expect(src).toContain("result.verdict === 'unknown' ? 400 : 410");
});

test('issuing a code spends every earlier unused one — at most one code is ever live', () => {
  const body = code(bodyOf(OWNER, 'issuePairingCode'));
  expect(body).toContain("demand(input.actor, 'set.printer')");
  const spend = body.slice(body.indexOf('.update({ used_at:'), body.indexOf('const code = newPairingCode()'));
  expect(spend).toContain(".is('used_at', null)");
  expect(spend).toContain(".eq('restaurant_id', restaurantId)");
  expect(body).toContain('code_hash: hashPairingCode(code)');
  // Returned formatted, for a person; never logged.
  expect(body).toContain('code: formatPairingCode(code)');
  expect(body.slice(body.indexOf('await audit('))).not.toContain('code}');
});

test('the migration stores hashes, scopes by restaurant, and enables RLS with no policy', () => {
  expect(MIGRATION).toContain('code_hash      text not null');
  expect(MIGRATION).not.toMatch(/\bcode\s+text/);
  for (const table of ['bridge_pairing_code', 'bridge_discovered_printer', 'bridge_printer']) {
    expect(MIGRATION).toContain(`alter table public.${table} enable row level security`);
    expect(MIGRATION).toContain(`restaurant_id`);
  }
  expect(MIGRATION).not.toContain('create policy');
  // One printer, one computer.
  expect(MIGRATION).toContain('create unique index if not exists bridge_printer_one_computer on public.bridge_printer (printer_id)');
});

/* ── The bridge's side, executed ───────────────────────────────────────── */

const fakeFetch =
  (status: number, body: unknown, calls: Array<{ url: string; body: unknown }> = []): typeof fetch =>
  async (input, init) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? '{}')) });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };

test('PAIRING SUCCESS: the answer becomes a config, and the request names no restaurant', async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const result = await pairComputer({
    origin: 'https://jalsa.example/',
    code: 'abcd-efgh',
    hostname: 'KITCHEN-PC',
    bridgeVersion: '2.0.0',
    fetchImpl: fakeFetch(200, { apiUrl: 'https://jalsa.example/api/bridge', token: 'jbt_' + 'a'.repeat(64), label: 'Kitchen PC', restaurantName: 'Jalsa' }, calls),
    now: () => new Date('2026-09-23T10:00:00Z'),
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.config).toMatchObject({ version: 1, apiUrl: 'https://jalsa.example/api/bridge', label: 'Kitchen PC', restaurantName: 'Jalsa', pairedAt: '2026-09-23T10:00:00.000Z' });
  expect(calls[0]?.url).toBe('https://jalsa.example/api/bridge/pair');
  expect(calls[0]?.body).toEqual({ code: 'ABCDEFGH', hostname: 'KITCHEN-PC', bridgeVersion: '2.0.0' });
  expect(JSON.stringify(calls[0]?.body)).not.toMatch(/restaurant/i);
});

test('EXPIRED and USED codes are refused with the server’s sentence, and nothing is written', async () => {
  for (const [status, verdict] of [[410, 'expired'], [410, 'used'], [400, 'unknown']] as const) {
    const r = await pairComputer({ origin: 'https://j', code: 'ABCDEFGH', hostname: 'PC', bridgeVersion: '2', fetchImpl: fakeFetch(status, { code: `pairing_${verdict}`, message: PAIRING_MESSAGES[verdict] }) });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toBe(PAIRING_MESSAGES[verdict]);
  }
});

test('no network is its own sentence, and a proxy’s HTML page is not mistaken for Jalsa', async () => {
  const down: typeof fetch = async () => {
    throw new TypeError('fetch failed');
  };
  const r = await pairComputer({ origin: 'https://j', code: 'ABCDEFGH', hostname: 'PC', bridgeVersion: '2', fetchImpl: down });
  expect(!r.ok && r.message).toBe(NO_NETWORK);
  const portal: typeof fetch = async () => new Response('<html>Sign in to the hotel Wi-Fi</html>', { status: 200 });
  const p = await pairComputer({ origin: 'https://j', code: 'ABCDEFGH', hostname: 'PC', bridgeVersion: '2', fetchImpl: portal });
  expect(!p.ok && p.message).toBe(NO_NETWORK);
});

test('an answer without a credential is refused, never half-written', async () => {
  const r = await pairComputer({ origin: 'https://j', code: 'ABCDEFGH', hostname: 'PC', bridgeVersion: '2', fetchImpl: fakeFetch(200, { label: 'x' }) });
  expect(r.ok).toBe(false);
});

/* ── The installer command, against a real temporary directory ────────── */

const dirs: string[] = [];
const sandbox = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'jalsa-pair-'));
  dirs.push(d);
  return d;
};
test.afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

async function cli(home: string, installDir: string, fetchImpl: typeof fetch): Promise<CliDeps & { lines: string[] }> {
  const lines: string[] = [];
  return {
    env: { JALSA_BRIDGE_HOME: home },
    platform: 'linux',
    hostname: 'KITCHEN-PC',
    fs: await nodeConfigFs(),
    installDir,
    out: (l) => lines.push(l),
    fetchImpl,
    lines,
  };
}

test('`pair` reads the baked origin, writes config.json, and never prints the token', async () => {
  const install = sandbox();
  const home = join(sandbox(), 'nested', 'home');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(install, 'jalsa.json'), JSON.stringify({ origin: 'https://jalsa.example' }));
  const token = 'jbt_' + 'b'.repeat(64);
  const calls: Array<{ url: string; body: unknown }> = [];
  const deps = await cli(home, install, fakeFetch(200, { apiUrl: 'https://jalsa.example/api/bridge', token, label: 'Kitchen PC', restaurantName: 'Jalsa' }, calls));

  const exit = await pairCommand(['--code', 'abcd-efgh'], deps);
  expect(exit).toBe(EXIT.ok);
  expect(calls[0]?.url).toBe('https://jalsa.example/api/bridge/pair');
  expect(deps.lines.join('\n')).toContain('connected to Jalsa as "Kitchen PC"');
  expect(deps.lines.join('\n')).not.toContain(token);

  const saved = await readPairedConfig(deps.fs, home);
  expect(saved.ok).toBe(true);
  expect(saved.ok && saved.config.token).toBe(token);
  // Written whole, then renamed: no `.tmp` survives a successful write.
  expect(existsSync(join(home, 'config.json.tmp'))).toBe(false);
});

test('`pair` exit codes tell the installer whether to ask again', async () => {
  const install = sandbox();
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(install, 'jalsa.json'), JSON.stringify({ origin: 'https://jalsa.example' }));

  const refused = await cli(sandbox(), install, fakeFetch(410, { message: PAIRING_MESSAGES.expired }));
  expect(await pairCommand(['--code', 'ABCDEFGH'], refused)).toBe(EXIT.refused);
  expect(refused.lines[0]).toBe(PAIRING_MESSAGES.expired);

  const offline = await cli(sandbox(), install, async () => { throw new Error('ENOTFOUND'); });
  expect(await pairCommand(['--code', 'ABCDEFGH'], offline)).toBe(EXIT.network);

  const noCode = await cli(sandbox(), install, fakeFetch(200, {}));
  expect(await pairCommand([], noCode)).toBe(EXIT.usage);

  // A download with no jalsa.json is an incomplete download, and says so.
  const noOrigin = await cli(sandbox(), sandbox(), fakeFetch(200, {}));
  expect(await pairCommand(['--code', 'ABCDEFGH'], noOrigin)).toBe(EXIT.usage);
  expect(noOrigin.lines[0]).toContain('Download it again');
});
