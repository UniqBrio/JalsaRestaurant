/**
 * Paired config spec — what a computer remembers across a reboot, and how it is kept.
 *
 * Executed against a real temporary directory through the same `ConfigFs` the process uses.
 *
 * FAIL-FIRST EVIDENCE (23-Sep-2026): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import * as nodeFs from 'node:fs';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CONFIG_FILE,
  bridgeHome,
  nodeConfigFs,
  parsePairedConfig,
  readInstallerInfo,
  readPairedConfig,
  writePairedConfig,
  type PairedConfig,
} from '../../bridge/src/paired-config';
import { LOG_MAX_BYTES, rotatingLog } from '../../bridge/src/log-file';

const dirs: string[] = [];
const sandbox = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'jalsa-cfg-'));
  dirs.push(d);
  return d;
};
test.afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const CONFIG: PairedConfig = {
  version: 1,
  apiUrl: 'https://jalsa.example/api/bridge',
  token: 'jbt_' + 'c'.repeat(64),
  label: 'Kitchen PC',
  restaurantName: 'Jalsa',
  pairedAt: '2026-09-23T10:00:00.000Z',
};

test('the home is machine-wide on Windows, an override anywhere, and never a guess', () => {
  expect(bridgeHome({ ProgramData: 'C:\\ProgramData' }, 'win32')).toBe('C:\\ProgramData\\Jalsa\\PrintBridge');
  expect(bridgeHome({}, 'win32')).toBe('C:\\ProgramData\\Jalsa\\PrintBridge');
  expect(bridgeHome({ JALSA_BRIDGE_HOME: '/srv/bridge', ProgramData: 'C:\\ProgramData' }, 'win32')).toBe('/srv/bridge');
  expect(bridgeHome({ HOME: '/home/dev' }, 'linux')).toBe('/home/dev/.jalsa-print-bridge');
});

test('PERSISTENCE: written, read back identical, survives a "restart" of the reader', async () => {
  const fs = await nodeConfigFs();
  const home = join(sandbox(), 'deep', 'er');
  await writePairedConfig(fs, home, CONFIG);
  const first = await readPairedConfig(fs, home);
  expect(first).toEqual({ ok: true, config: CONFIG });
  // A second, fresh reader — as the Scheduled Task is after a reboot — sees the same thing.
  const again = await readPairedConfig(await nodeConfigFs(), home);
  expect(again).toEqual({ ok: true, config: CONFIG });
  // Only the config, no temp file left behind.
  expect(readdirSync(home)).toEqual([CONFIG_FILE]);
});

test('a missing config says the computer is not connected, in a sentence, and says it is MISSING', async () => {
  const r = await readPairedConfig(await nodeConfigFs(), join(sandbox(), 'nowhere'));
  expect(r.ok).toBe(false);
  expect(!r.ok && r.missing).toBe(true);
  expect(!r.ok && r.problems[0]).toContain('not connected to a Jalsa restaurant');
});

test('a half-valid config never starts a bridge; every problem is named at once', () => {
  const r = parsePairedConfig(JSON.stringify({ version: 1, apiUrl: 'https://x/api/bridge', token: 'not-a-token', label: '' }));
  expect(r.ok).toBe(false);
  if (r.ok) return;
  expect(r.problems).toHaveLength(2);
  expect(r.problems.join(' ')).toContain('credential');
  expect(r.problems.join(' ')).toContain('computer name');
  expect(parsePairedConfig('{ nope').ok).toBe(false);
  expect(parsePairedConfig(JSON.stringify({ ...CONFIG, version: 2 })).ok).toBe(false);
  expect(parsePairedConfig(JSON.stringify({ ...CONFIG, apiUrl: 'https://x/somewhere-else' })).ok).toBe(false);
});

test('a write that fails midway leaves the previous config intact (rename is the commit)', async () => {
  const real = await nodeConfigFs();
  const home = sandbox();
  await writePairedConfig(real, home, CONFIG);
  const failing = { ...real, rename: async () => { throw new Error('disk full'); } };
  await expect(writePairedConfig(failing, home, { ...CONFIG, label: 'Bar PC' })).rejects.toThrow('disk full');
  const after = await readPairedConfig(real, home);
  expect(after.ok && after.config.label).toBe('Kitchen PC');
});

test('the baked installer info is an origin and nothing more', async () => {
  const fs = await nodeConfigFs();
  const dir = sandbox();
  writeFileSync(join(dir, 'jalsa.json'), JSON.stringify({ origin: 'https://jalsa.example/', bridgeVersion: '2.0.0' }));
  expect(await readInstallerInfo(fs, dir)).toEqual({ origin: 'https://jalsa.example' });
  writeFileSync(join(dir, 'jalsa.json'), JSON.stringify({ origin: 'https://jalsa.example/api/bridge' }));
  expect(await readInstallerInfo(fs, dir)).toBeNull();
  expect(await readInstallerInfo(fs, sandbox())).toBeNull();
});

test('the service log rolls over and never throws', () => {
  const dir = join(sandbox(), 'logs');
  const { readFileSync, existsSync } = nodeFs;
  const fs = nodeFs;
  const log = rotatingLog(fs, dir, 120);
  for (let i = 0; i < 10; i += 1) log(JSON.stringify({ event: 'bridge.cycle', i, pad: 'x'.repeat(20) }));
  expect(existsSync(join(dir, 'bridge.log'))).toBe(true);
  expect(existsSync(join(dir, 'bridge.1.log'))).toBe(true);
  expect(readFileSync(join(dir, 'bridge.log'), 'utf8').length).toBeLessThanOrEqual(120);
  expect(LOG_MAX_BYTES).toBe(1_000_000);
  // A broken filesystem is swallowed: the ticket matters more than the diagnostic.
  const broken = rotatingLog({ ...fs, appendFileSync: () => { throw new Error('EROFS'); } }, dir, 120);
  expect(() => broken('x')).not.toThrow();
});
