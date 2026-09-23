import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';
import { BRIDGE_VERSION } from '../src/version';
import { listZip, readZip, readZipEntry, writeZip, type ZipEntry } from './zip';

/**
 * build — the thing an owner downloads: `bridge/dist/jalsa-print-bridge-windows.zip`.
 *
 *   npm run bridge:package -- --origin https://jalsa.example.com
 *
 * WHAT GOES IN, AND WHERE EACH PIECE COMES FROM
 *   main.js                     the bridge, bundled from bridge/src by esbuild (same as bridge:build)
 *   node\node.exe, node\LICENSE the Node.js runtime, taken out of the OFFICIAL Windows zip from
 *                               nodejs.org, whose SHA-256 is pinned below. The owner installs
 *                               nothing else: no Node, no compiler, no PowerShell module.
 *   jalsa.json                  which Jalsa server this download belongs to — the one thing that
 *                               is baked in, so nobody types a URL on a kitchen PC
 *   install.ps1 and friends     bridge/windows, verbatim
 *
 * WHY THE ORIGIN IS BAKED AT PACKAGE TIME
 *   The pairing code the owner types is not self-describing — it does not say which server issued
 *   it — and a URL is precisely the thing an owner must not be asked for. So the package is built
 *   PER DEPLOYMENT, with that deployment's public origin inside it. `PUBLIC_APP_URL` supplies it
 *   when `--origin` does not.
 *
 * WHY IT REFUSES RATHER THAN DEGRADES
 *   A package without the runtime installs nothing; a package with an unverified runtime is a
 *   supply-chain incident waiting for a restaurant. Either the pinned zip downloads and matches
 *   its hash, or there is no artifact — exit 3, BLOCKED, the same three-valued rule the gate uses.
 *   `--node-zip <path>` supplies the zip offline; the hash check still applies.
 */

/** The runtime. Bump both together, from https://nodejs.org/dist/<version>/SHASUMS256.txt. */
export const NODE_RUNTIME = {
  version: 'v24.21.0',
  file: 'node-v24.21.0-win-x64.zip',
  url: 'https://nodejs.org/dist/v24.21.0/node-v24.21.0-win-x64.zip',
  sha256: '158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541',
} as const;

export const PACKAGE_FILE = 'jalsa-print-bridge-windows.zip';
export const MANIFEST_FILE = 'jalsa-print-bridge-windows.json';

/** The files every download must contain. The installer refuses to run without the first three. */
export const REQUIRED_ENTRIES = [
  'main.js',
  'jalsa.json',
  'node/node.exe',
  'node/LICENSE',
  'install.ps1',
  'uninstall.ps1',
  'Install Jalsa Print Bridge.cmd',
  'Remove Jalsa Print Bridge.cmd',
  'README.txt',
] as const;

const sha256 = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');

/** A public origin: scheme and host, nothing after. `http://` is allowed for a developer's laptop. */
export function originFrom(raw: string | undefined): string | null {
  const v = (raw ?? '').trim().replace(/\/+$/, '');
  return /^https?:\/\/[^/\s]+$/.test(v) ? v : null;
}

/** `node.exe` and `LICENSE` out of the official zip, after the hash matched. */
export function runtimeFromZip(zip: Buffer): { exe: Buffer; license: Buffer } {
  if (sha256(zip) !== NODE_RUNTIME.sha256) {
    throw new Error(`The Node.js zip does not match the pinned SHA-256 for ${NODE_RUNTIME.file}. Refusing to package it.`);
  }
  const entries = listZip(zip);
  const find = (suffix: string) => {
    const e = entries.find((x) => x.name.endsWith(suffix));
    if (!e) throw new Error(`${NODE_RUNTIME.file} has no ${suffix}.`);
    return readZipEntry(zip, e);
  };
  return { exe: find('/node.exe'), license: find('/LICENSE') };
}

export function assemble(input: {
  mainJs: Buffer;
  origin: string;
  runtime: { exe: Buffer; license: Buffer };
  windowsDir: string;
  builtAt: Date;
}): ZipEntry[] {
  const w = (name: string): Buffer => readFileSync(join(input.windowsDir, name));
  const jalsaJson = `${JSON.stringify({ origin: input.origin, bridgeVersion: BRIDGE_VERSION, builtAt: input.builtAt.toISOString() }, null, 2)}\n`;
  return [
    { name: 'main.js', data: input.mainJs },
    { name: 'jalsa.json', data: Buffer.from(jalsaJson, 'utf8') },
    // Deflated like everything else: Node's own zip takes the .exe from ~90 MB to ~37 MB.
    { name: 'node/node.exe', data: input.runtime.exe },
    { name: 'node/LICENSE', data: input.runtime.license },
    { name: 'install.ps1', data: w('install.ps1') },
    { name: 'uninstall.ps1', data: w('uninstall.ps1') },
    { name: 'Install Jalsa Print Bridge.cmd', data: w('Install Jalsa Print Bridge.cmd') },
    { name: 'Remove Jalsa Print Bridge.cmd', data: w('Remove Jalsa Print Bridge.cmd') },
    { name: 'README.txt', data: w('README.txt') },
  ];
}

/* c8 ignore start — the command itself. */
async function main(argv: string[]): Promise<number> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, '..', '..');
  const arg = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const say = (line: string): void => {
    process.stderr.write(`${line}\n`);
  };

  const origin = originFrom(arg('--origin') ?? process.env.PUBLIC_APP_URL);
  if (!origin) {
    say('bridge:package: no origin. Pass --origin https://<your-jalsa-host> or set PUBLIC_APP_URL.');
    return 2;
  }

  const dist = join(root, 'bridge', 'dist');
  mkdirSync(join(dist, 'cache'), { recursive: true });

  say(`bridge:package: bundling bridge/src/main.ts (bridge ${BRIDGE_VERSION})`);
  await esbuild({
    entryPoints: [join(root, 'bridge', 'src', 'main.ts')],
    bundle: true,
    outfile: join(dist, 'main.js'),
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'warning',
  });
  const mainJs = readFileSync(join(dist, 'main.js'));

  let zip: Buffer;
  const supplied = arg('--node-zip');
  const cached = join(dist, 'cache', NODE_RUNTIME.file);
  if (supplied) {
    zip = readFileSync(supplied);
  } else if (existsSync(cached) && sha256(readFileSync(cached)) === NODE_RUNTIME.sha256) {
    zip = readFileSync(cached);
    say(`bridge:package: using cached ${NODE_RUNTIME.file}`);
  } else {
    say(`bridge:package: downloading ${NODE_RUNTIME.url}`);
    const res = await fetch(NODE_RUNTIME.url);
    if (!res.ok) {
      say(`bridge:package: BLOCKED — nodejs.org answered ${res.status}. No artifact was written.`);
      return 3;
    }
    zip = Buffer.from(await res.arrayBuffer());
    writeFileSync(cached, zip);
  }

  let runtime: { exe: Buffer; license: Buffer };
  try {
    runtime = runtimeFromZip(zip);
  } catch (err) {
    say(`bridge:package: BLOCKED — ${err instanceof Error ? err.message : String(err)}`);
    return 3;
  }

  const builtAt = new Date();
  const entries = assemble({ mainJs, origin, runtime, windowsDir: join(root, 'bridge', 'windows'), builtAt });
  const out = writeZip(entries, builtAt);

  // Read it back before calling it an artifact.
  const check = readZip(out);
  const missing = REQUIRED_ENTRIES.filter((n) => !check.has(n));
  if (missing.length) {
    say(`bridge:package: BLOCKED — the package read back without ${missing.join(', ')}.`);
    return 3;
  }

  writeFileSync(join(dist, PACKAGE_FILE), out);
  const manifest = {
    file: PACKAGE_FILE,
    bridgeVersion: BRIDGE_VERSION,
    origin,
    builtAt: builtAt.toISOString(),
    sizeBytes: out.length,
    sha256: sha256(out),
    node: { version: NODE_RUNTIME.version, zipSha256: NODE_RUNTIME.sha256 },
    entries: [...check.keys()],
  };
  writeFileSync(join(dist, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  say(`bridge:package: wrote bridge/dist/${PACKAGE_FILE} (${(out.length / 1_048_576).toFixed(1)} MB) for ${origin}`);
  return 0;
}

if (process.argv[1] && /package-builder\.mjs$|build\.[cm]?js$/.test(process.argv[1])) {
  void main(process.argv.slice(2)).then((code) => process.exit(code));
}
/* c8 ignore stop */
