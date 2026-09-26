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

/* ── The installer must parse on Windows (added 23-Sep-2026, after the first real Windows run) ── */

/**
 * WHAT HAPPENED: `install.ps1` line 125 held `→`. With no BOM, Windows PowerShell 5.1 decoded the
 * file as Windows-1252, where the arrow's byte 0x92 is `’` — a quote character to PowerShell — so
 * the string closed early: "The string is missing the terminator: '" at 125:97, then unclosed `{`
 * at 124, 77, 73. PowerShell 7 on Linux reproduces those four errors from the same bytes decoded
 * as Windows-1252. The rungs below hold the scripts to ASCII, hold the packager to a BOM, and
 * keep the exact failing file as a fixture so the tokenizer can be shown to catch it.
 *
 * FAIL-FIRST EVIDENCE (23-Sep-2026): recorded in TEST_SUMMARY.md.
 */
import { ansiView, lintPowerShell, nonAscii, prepareForWindows, tokenizeErrors, BOM } from '../../bridge/package/powershell-lint';
import { WINDOWS_SCRIPTS, parseWithPowerShell, realPowerShell, validateWindowsScripts } from '../../bridge/package/build';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The file exactly as it shipped in 1504bb9, reconstructed from git so the fixture cannot drift. */
const OLD_INSTALL = execFileSync('git', ['show', '1504bb9:jalsa/bridge/windows/install.ps1']);

test('THE REGRESSION: the shipped installer, read as Windows PowerShell 5.1 read it, fails at 125:97 on a missing terminator', () => {
  const asAnsi = ansiView(OLD_INSTALL);
  expect(asAnsi).toContain('â†’'); // what the arrow became — and the ’ inside it is a quote to PowerShell
  const r = lintPowerShell(asAnsi);
  expect(r.ok).toBe(false);
  if (r.ok) return;
  const structural = tokenizeErrors(asAnsi);
  expect(structural[0]).toMatchObject({ line: 125, message: "The string is missing the terminator: '" });
  // And the same bytes decoded as UTF-8 were never a syntax error — the defect was the encoding.
  expect(tokenizeErrors(OLD_INSTALL.toString('utf8'))).toEqual([]);
  // The ASCII rule alone also catches it, on the file as written, naming the first arrow.
  expect(nonAscii(OLD_INSTALL.toString('utf8'))[0]?.message).toContain('non-ASCII character U+2014');
});

test('the real PowerShell parser agrees, when one is on this machine (loud SKIP otherwise)', () => {
  const pwsh = realPowerShell();
  if (!pwsh) {
    process.stderr.write('SKIPPED: no pwsh/powershell on this machine — the real-parser rung did NOT run; the tokenizer rungs did.\n');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'jalsa-ps1-'));
  writeFileSync(join(dir, 'old-as-ansi.ps1'), ansiView(OLD_INSTALL), 'utf8');
  const errors = parseWithPowerShell(pwsh, join(dir, 'old-as-ansi.ps1'));
  expect(errors).toContain('125:97 TerminatorExpectedAtEndOfString');
  expect(errors).toContain('124:8 MissingEndCurlyBrace');
  for (const name of WINDOWS_SCRIPTS.filter((n) => n.endsWith('.ps1'))) {
    expect(parseWithPowerShell(pwsh, join('bridge/windows', name)), name).toBe('');
  }
});

test('every script the package ships is ASCII, tokenizes clean, and still does as Windows PowerShell 5.1 would read it', () => {
  for (const name of WINDOWS_SCRIPTS) {
    const bytes = readFileSync(join('bridge/windows', name));
    expect(nonAscii(bytes.toString('utf8')), name).toEqual([]);
    if (name.endsWith('.ps1')) {
      expect(lintPowerShell(bytes.toString('utf8')), name).toEqual({ ok: true });
      expect(lintPowerShell(ansiView(bytes)), `${name} as ANSI`).toEqual({ ok: true });
    }
  }
  const v = validateWindowsScripts('bridge/windows');
  expect(v.ok).toBe(true);
});

test('the tokenizer knows PowerShell strings: escapes, here-strings, comments — and refuses what is not closed', () => {
  expect(tokenizeErrors("Write-Host 'it''s fine'")).toEqual([]);
  expect(tokenizeErrors('Write-Host "a `" quote and a "" quote"')).toEqual([]);
  expect(tokenizeErrors("$s = @'\nline with ' and \" and }\n'@\nif ($s) { 1 }")).toEqual([]);
  expect(tokenizeErrors("<# a { comment ' #>\n# another ' one\nif (1) { 2 }")).toEqual([]);
  expect(tokenizeErrors("Say 'open")[0]?.message).toBe("The string is missing the terminator: '");
  expect(tokenizeErrors('if (1) { Say "x"')[0]?.message).toContain("Missing closing '}'");
  expect(tokenizeErrors('if (1) { Say "x" } }')[0]?.message).toContain("unexpected '}'");
  // Typographic quotes are quotes to PowerShell, so they are quotes here.
  expect(tokenizeErrors("Say ‘smart’")).toEqual([]);
  expect(tokenizeErrors("Say 'Jalsa ’ Printers'")[0]?.message).toContain('missing the terminator');
  // The ASCII rule reports where, in a form a person can go to.
  expect(nonAscii("line one\nSay 'Jalsa → Printers'")[0]).toMatchObject({ line: 2, column: 12 });
});

test('the packager ships .ps1 with a BOM, .cmd WITHOUT one (cmd.exe cannot read a BOM), all CRLF — and refuses a script that would not run', () => {
  const out = prepareForWindows("Say 'hi'\nSay 'there'\n", 'ps1');
  expect(out.subarray(0, 3).equals(BOM)).toBe(true);
  expect(out.subarray(3).toString('utf8')).toBe("Say 'hi'\r\nSay 'there'\r\n");
  // Already-CRLF input is not doubled.
  expect(prepareForWindows("a\r\nb\n", 'ps1').subarray(3).toString('utf8')).toBe('a\r\nb\r\n');
  // A batch file: the three BOM bytes would become part of `@echo off` and cmd.exe would refuse it.
  const cmd = prepareForWindows('@echo off\nrem x\n', 'plain');
  expect(cmd.subarray(0, 3).equals(BOM)).toBe(false);
  expect(cmd.toString('utf8')).toBe('@echo off\r\nrem x\r\n');

  const entries = assemble({
    mainJs: Buffer.from('// bridge'),
    origin: 'https://jalsa.example',
    runtime: { exe: Buffer.from('MZ'), license: Buffer.from('MIT') },
    windowsDir: 'bridge/windows',
    builtAt: new Date('2026-09-23T10:00:00Z'),
  });
  for (const name of WINDOWS_SCRIPTS) {
    const data = Buffer.from(entries.find((e) => e.name === name)!.data);
    expect(data.subarray(0, 3).equals(BOM), `${name} BOM`).toBe(name.endsWith('.ps1'));
    expect(data.toString('utf8')).not.toMatch(/[^\r]\n/);
    if (name.endsWith('.cmd')) expect(data.toString('utf8').startsWith('@echo off\r\n'), `${name} starts with @echo off`).toBe(true);
  }

  // A directory holding the old installer is refused, naming the line.
  const dir = mkdtempSync(join(tmpdir(), 'jalsa-winscripts-'));
  for (const name of WINDOWS_SCRIPTS) writeFileSync(join(dir, name), readFileSync(join('bridge/windows', name)));
  writeFileSync(join(dir, 'install.ps1'), OLD_INSTALL);
  const refused = validateWindowsScripts(dir);
  expect(refused.ok).toBe(false);
  expect(!refused.ok && refused.problems.join('\n')).toMatch(/install\.ps1:2:\d+ non-ASCII/);
  expect(!refused.ok && refused.problems.join('\n')).toContain('as Windows PowerShell 5.1 reads it without a BOM');
});

test('the packager cannot skip the check: the command refuses (exit 3) on a script that would not run', () => {
  const build = read('bridge/package/build.ts');
  const main = build.slice(build.indexOf('async function main('));
  const at = main.indexOf('validateWindowsScripts(join(root');
  expect(at, 'main validates the scripts').toBeGreaterThan(-1);
  const after = main.slice(at, at + 400);
  expect(after).toContain('if (!scripts.ok) {');
  expect(after).toContain('return 3;');
  // Validation happens BEFORE anything is assembled or written.
  expect(at).toBeLessThan(main.indexOf('assemble({'));
  expect(at).toBeLessThan(main.indexOf('writeFileSync(join(dist, PACKAGE_FILE)'));
});

/* ── Appended 25-Sep-2026: the ANSI view must not depend on the runtime's ICU ─────────────────
   CI on main runs Node 20, whose small-ICU `TextDecoder('windows-1252')` is Latin-1: 0x86 came
   back as U+0086 instead of the dagger, the ’ vanished, and THE REGRESSION rung above went red on
   Node 20 while passing on Node 22. */

test('the ANSI view maps 0x80-0x9F as Windows-1252 itself, not through TextDecoder', () => {
  expect(ansiView(Uint8Array.from([0x80, 0x86, 0x92, 0x97, 0x99, 0x9f]))).toBe('€†’—™Ÿ');
  expect(ansiView(Uint8Array.from([0x41, 0xe2, 0xff, 0x81]))).toBe('Aâÿ\u0081');
  expect(read('bridge/package/powershell-lint.ts')).not.toContain("TextDecoder('windows-1252')");
});
