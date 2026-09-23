/**
 * Package spec — the thing an owner downloads, and the installer inside it.
 *
 * EXECUTED: the zip writer and reader, round-trip and against Python's reading of the same bytes
 *   (recorded in TEST_SUMMARY.md), and `assemble()` over the real bridge/windows files.
 * READ: `install.ps1`, which no Linux runner can execute. What is pinned is what it must and must
 *   not do; whether Windows honours it is Gate 7 (rows 33–40, added with this change).
 * SCANNED: the tracked tree, for a credential that should never have been committed.
 *
 * FAIL-FIRST EVIDENCE (23-Sep-2026): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { crc32, listZip, readZip, readZipEntry, writeZip } from '../../bridge/package/zip';
import { NODE_RUNTIME, REQUIRED_ENTRIES, assemble, originFrom, runtimeFromZip } from '../../bridge/package/build';
import { BRIDGE_VERSION } from '../../bridge/src/version';

const read = (p: string): string => readFileSync(p, 'utf8');
const INSTALL = read('bridge/windows/install.ps1');
const UNINSTALL = read('bridge/windows/uninstall.ps1');
const LAUNCHER = read('bridge/windows/Install Jalsa Print Bridge.cmd');

/* ── The zip ───────────────────────────────────────────────────────────── */

test('CRC-32 is the IEEE one everybody else computes', () => {
  expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
  expect(crc32(Buffer.alloc(0))).toBe(0);
});

test('a zip round-trips: stored and deflated entries, nested names, binary bytes', () => {
  const exe = Buffer.from(Array.from({ length: 5000 }, (_, i) => (i * 7919) % 256));
  const z = writeZip(
    [
      { name: 'main.js', data: Buffer.from('console.log(1)\n') },
      { name: 'node/node.exe', data: exe, method: 0 },
      { name: 'node/LICENSE', data: Buffer.from('MIT\n'.repeat(100)) },
    ],
    new Date('2026-09-23T10:00:00Z')
  );
  const back = readZip(z);
  expect([...back.keys()]).toEqual(['main.js', 'node/node.exe', 'node/LICENSE']);
  expect(back.get('node/node.exe')?.equals(exe)).toBe(true);
  expect(back.get('main.js')?.toString()).toBe('console.log(1)\n');
  const listing = listZip(z);
  expect(listing.map((e) => e.method)).toEqual([8, 0, 8]);
  // Deflate earned its keep on the repetitive text and was skipped for the binary as asked.
  expect(listing[2]?.compressedSize).toBeLessThan(listing[2]?.size ?? 0);
});

test('corruption is refused, never quietly read', () => {
  const z = writeZip([{ name: 'a.txt', data: Buffer.from('hello world, hello world') }]);
  const listing = listZip(z);
  const flipped = Buffer.from(z);
  // Flip a byte inside the deflated payload.
  const at = (listing[0]?.localOffset ?? 0) + 30 + 5 + 2;
  flipped[at] = (flipped[at] as number) ^ 0xff;
  expect(() => readZipEntry(flipped, listZip(flipped)[0]!)).toThrow(/Corrupt zip|invalid/);
  expect(() => listZip(Buffer.from('not a zip at all'))).toThrow('Not a zip file');
});

test('Python reads what this writer wrote (the artifact must open on a machine that is not ours)', () => {
  const z = writeZip([{ name: 'install.ps1', data: Buffer.from('Write-Host hi\n') }, { name: 'node/x.bin', data: Buffer.from([0, 1, 2, 255]), method: 0 }]);
  const out = execFileSync('python3', ['-c', 'import sys,zipfile,io; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(z.testzip()); print(",".join(i.filename for i in z.infolist())); print(z.read("node/x.bin").hex())'], { input: z }).toString().trim().split('\n');
  expect(out).toEqual(['None', 'install.ps1,node/x.bin', '000102ff']);
});

/* ── The package ───────────────────────────────────────────────────────── */

test('the runtime is pinned by hash, and a zip that does not match is refused', () => {
  expect(NODE_RUNTIME.sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(NODE_RUNTIME.url).toBe(`https://nodejs.org/dist/${NODE_RUNTIME.version}/${NODE_RUNTIME.file}`);
  // Node 20 reached end-of-life in April 2026; the runtime shipped to a restaurant is a supported line.
  expect(Number(NODE_RUNTIME.version.slice(1, 3))).toBeGreaterThanOrEqual(22);
  expect(() => runtimeFromZip(writeZip([{ name: 'node-v0/node.exe', data: Buffer.from('MZ') }]))).toThrow('does not match the pinned SHA-256');
});

test('the origin is baked in and validated; the owner never types a URL', () => {
  expect(originFrom('https://jalsa.example/')).toBe('https://jalsa.example');
  expect(originFrom('http://localhost:3000')).toBe('http://localhost:3000');
  expect(originFrom('https://jalsa.example/api/bridge')).toBeNull();
  expect(originFrom('jalsa.example')).toBeNull();
  expect(originFrom(undefined)).toBeNull();
});

test('assemble() produces every required entry, with the origin and version in jalsa.json', () => {
  const entries = assemble({
    mainJs: Buffer.from('// bridge'),
    origin: 'https://jalsa.example',
    runtime: { exe: Buffer.from('MZ'), license: Buffer.from('MIT') },
    windowsDir: 'bridge/windows',
    builtAt: new Date('2026-09-23T10:00:00Z'),
  });
  expect(entries.map((e) => e.name).sort()).toEqual([...REQUIRED_ENTRIES].sort());
  const jalsa = JSON.parse(Buffer.from(entries.find((e) => e.name === 'jalsa.json')!.data).toString()) as Record<string, string>;
  expect(jalsa).toEqual({ origin: 'https://jalsa.example', bridgeVersion: BRIDGE_VERSION, builtAt: '2026-09-23T10:00:00.000Z' });
  // The installer copies exactly what the package contains.
  for (const required of ['main.js', 'jalsa.json', 'node\\node.exe']) expect(INSTALL).toContain(`'${required}'`);
});

/* ── The installer, read ───────────────────────────────────────────────── */

test('the installer puts the bridge under ProgramData, pairs once, and registers a self-restarting task', () => {
  expect(INSTALL).toContain("Join-Path $env:ProgramData 'Jalsa\\PrintBridge'");
  expect(INSTALL).toContain("$TaskName = 'Jalsa Print Bridge'");
  expect(INSTALL).toContain('& $Node $Main pair --code $Code');
  expect(INSTALL).toContain('-Argument "`"$Main`" run"');
  expect(INSTALL).toContain('New-ScheduledTaskTrigger -AtStartup');
  expect(INSTALL).toContain("New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest");
  expect(INSTALL).toContain('-RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)');
  expect(INSTALL).toContain('-ExecutionTimeLimit ([TimeSpan]::Zero)');
  expect(INSTALL).toContain('-MultipleInstances IgnoreNew');
  expect(INSTALL).toContain('Start-ScheduledTask -TaskName $TaskName');
  // The folder with the credential is locked to the task and the installer.
  expect(INSTALL).toContain("'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F'");
  // It waits for the bridge's own status file rather than declaring success.
  expect(INSTALL).toContain("$state.state -eq 'connected'");
});

test('the installer never asks for, prints or stores a token, a URL or a queue name', () => {
  for (const s of [INSTALL, UNINSTALL, LAUNCHER]) {
    expect(s).not.toMatch(/JALSA_BRIDGE_TOKEN|JALSA_BRIDGE_API|JALSA_BRIDGE_DESTINATIONS|Read-Host.*(url|queue|token)/i);
    expect(s).not.toMatch(/jbt_[0-9a-f]{20,}/);
  }
  // The pairing code is the one prompt, and it is retried rather than abandoned.
  expect((INSTALL.match(/Read-Host/g) ?? []).length).toBe(1);
  expect(INSTALL).toContain("Read-Host '  Type the pairing code'");
  // Exit codes drive the loop: 3 refused (ask again), 4 no network.
  expect(INSTALL).toContain('$rc -eq 4');
  // The launcher elevates and points at the installer beside it; nothing is downloaded from anywhere.
  expect(LAUNCHER).toContain('-Verb RunAs');
  expect(LAUNCHER).toContain('install.ps1');
  expect(LAUNCHER).not.toMatch(/https?:\/\//);
});

test('the bundle the installer runs is the bridge, and the bridge runs the paired service', () => {
  const main = read('bridge/src/main.ts');
  expect(main).toContain("const COMMANDS = ['pair', 'run', 'discover'] as const;");
  expect(main).toContain('servePaired(setup.service');
  expect(main).toContain("rotatingLog(fsSync, joinPath(home, 'logs'))");
  // Environment mode still exists for Gate 7 and developers: the legacy branch is intact.
  expect(main).toContain('const started = startup(process.env, { log });');
});

/* ── No secrets committed ───────────────────────────────────────────────── */

test('NO SECRETS COMMITTED: no live bridge token, pairing hash or Supabase secret in the tracked tree', () => {
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  expect(tracked.length).toBeGreaterThan(100);
  const offenders: string[] = [];
  for (const file of tracked) {
    if (/\.(png|jpg|jpeg|svg|ico|woff2?|zip|webp)$/i.test(file) || file === 'package-lock.json') continue;
    const text = read(file);
    // A bridge token is `jbt_` + 64 hex. A pairing hash never appears anywhere but the database.
    if (/jbt_[0-9a-f]{64}/.test(text)) offenders.push(`${file}: bridge token`);
    // A Supabase secret key from a real project. The CI placeholder is `sb_secret_ci_reaches_no_database`.
    if (/sb_secret_[A-Za-z0-9]{20,}/.test(text) && !/sb_secret_ci_reaches_no_database/.test(text)) offenders.push(`${file}: supabase secret`);
    if (/PRINT_BRIDGE_DOWNLOAD_URL\s*=\s*https/.test(text)) offenders.push(`${file}: a real download url`);
  }
  expect(offenders).toEqual([]);
  // The test env file and the package artifact are ignored, by rule.
  expect(execFileSync('git', ['check-ignore', '.env.test', 'bridge/dist/jalsa-print-bridge-windows.zip'], { encoding: 'utf8' }).trim().split('\n')).toHaveLength(2);
});
