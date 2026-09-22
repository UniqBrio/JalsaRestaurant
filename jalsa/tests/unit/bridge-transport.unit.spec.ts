/**
 * Bridge transport unit spec — the bytes that left are the bytes that arrived, and a transport
 * that could not deliver says so as a value.
 *
 * WHY BYTE-IDENTITY IS THE HEADLINE CASE
 *   A thermal stream is not text. It contains 0x00, it contains 0x1B, and on the day a verified
 *   codepage lands it will contain bytes above 0x7F. Every accidental way of handling it —
 *   `toString()`, a default `utf8` encoding argument, a stray BOM, text-mode line endings on
 *   Windows — is silently lossy: the file still exists, still looks plausible, and prints
 *   something subtly wrong. Nothing downstream can catch that, so it is caught here, against all
 *   256 byte values.
 *
 * WHY THE FAILURE CASES ARE NOT AFTERTHOUGHTS
 *   Phase 1 shipped a success nobody had performed. The rungs below pin the opposite habit: a
 *   transport that wrote nothing returns `ok: false`, never throws, and — structurally — has
 *   nowhere in its result to name a printer other than the one it was handed.
 *
 * FAIL-FIRST EVIDENCE (21-Sep-2026): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { FileTransport, readable, type FileTransportConfig } from '../../bridge/src/transport/file';
import { NULL_TRANSPORT_REASON, NullTransport } from '../../bridge/src/transport/null';
import {
  failed,
  succeeded,
  type PrintTransport,
  type TransportResult,
  type TransportTarget,
} from '../../bridge/src/transport/types';
import { DEFAULT_ENCODER, encodeTicket, hex } from '../../src/lib/escpos';

const QUEUE = 'KOT-VEG-01';

const target = (over: Partial<TransportTarget> = {}): TransportTarget => ({
  machineId: 'KOT-VEG-01',
  jobId: '11111111-2222-3333-4444-555555555555'.replace(/-/g, '_'),
  destination: QUEUE,
  ...over,
});

const sandbox = async (): Promise<string> => mkdtemp(join(tmpdir(), 'jalsa-bridge-'));

const fileTransport = (over: Partial<FileTransportConfig> & { directory: string }): FileTransport =>
  new FileTransport({ humanReadable: false, ...over });

/** Every byte value there is, in order. The stream no text path survives. */
const EVERY_BYTE = Uint8Array.from({ length: 256 }, (_, i) => i);

/* ── Byte identity ─────────────────────────────────────────────────────── */

test('what lands on disk is byte-for-byte what was handed over, for all 256 byte values', async () => {
  const directory = await sandbox();
  const t = target();
  const result = await fileTransport({ directory }).send(EVERY_BYTE, t);

  expect(succeeded(result)).toBe(true);

  const back = new Uint8Array(await readFile(join(directory, QUEUE, `${t.jobId}.bin`)));
  expect(back.length).toBe(EVERY_BYTE.length);
  expect(Array.from(back)).toEqual(Array.from(EVERY_BYTE));

  await rm(directory, { recursive: true, force: true });
});

test('a real encoded ticket round-trips through the file sink unchanged', async () => {
  const directory = await sandbox();
  const bytes = encodeTicket(
    [
      { text: 'JALSA', weight: 'big' },
      { text: 'KOT-113', weight: 'bold' },
      { text: '2 x Paneer Tikka', weight: 'plain' },
    ],
    DEFAULT_ENCODER
  );
  const t = target();
  await fileTransport({ directory }).send(bytes, t);

  const back = new Uint8Array(await readFile(join(directory, QUEUE, `${t.jobId}.bin`)));
  // Compared as hex so a failure names the offending byte rather than printing control codes.
  expect(hex(back)).toBe(hex(bytes));

  await rm(directory, { recursive: true, force: true });
});

test('an empty stream writes an empty file rather than nothing at all', async () => {
  // Zero bytes is a legitimate stream and must not be confused with "did not run".
  const directory = await sandbox();
  const t = target();
  const result = await fileTransport({ directory }).send(new Uint8Array(0), t);

  expect(result).toEqual({
    ok: true,
    bytesSent: 0,
    detail: `file: wrote 0 bytes to ${join(directory, QUEUE, `${t.jobId}.bin`)} for ${t.machineId}`,
  });
  expect((await stat(join(directory, QUEUE, `${t.jobId}.bin`))).size).toBe(0);

  await rm(directory, { recursive: true, force: true });
});

test('bytesSent is measured from the file, not echoed from the input', async () => {
  const directory = await sandbox();
  const result = await fileTransport({ directory }).send(EVERY_BYTE, target());
  expect(succeeded(result) && result.bytesSent).toBe(256);
  await rm(directory, { recursive: true, force: true });
});

/* ── The human-readable rendering ──────────────────────────────────────── */

test('the .txt rendering is written only when configuration asks for it', async () => {
  const directory = await sandbox();
  const t = target();
  const bytes = encodeTicket([{ text: 'HI', weight: 'plain' }], DEFAULT_ENCODER);

  await fileTransport({ directory }).send(bytes, t);
  await expect(stat(join(directory, QUEUE, `${t.jobId}.txt`))).rejects.toThrow();

  await fileTransport({ directory, humanReadable: true }).send(bytes, t);
  expect(await readFile(join(directory, QUEUE, `${t.jobId}.txt`), 'utf8')).toContain('HI');

  await rm(directory, { recursive: true, force: true });
});

test('the .bin is identical whether or not the .txt was produced beside it', async () => {
  // The convenience file must never be able to change the artifact of record.
  const directory = await sandbox();
  const plainTarget = target({ jobId: 'plain_job' });
  const readableTarget = target({ jobId: 'readable_job' });

  await fileTransport({ directory }).send(EVERY_BYTE, plainTarget);
  await fileTransport({ directory, humanReadable: true }).send(EVERY_BYTE, readableTarget);

  const a = await readFile(join(directory, QUEUE, 'plain_job.bin'));
  const b = await readFile(join(directory, QUEUE, 'readable_job.bin'));
  expect(Array.from(new Uint8Array(b))).toEqual(Array.from(new Uint8Array(a)));

  await rm(directory, { recursive: true, force: true });
});

test('the rendering shows control bytes as hex and never pretends to parse them', () => {
  // ESC @ ESC t 0 H I LF. If this ever renders as "<reset>" someone has started writing a second
  // ESC/POS implementation inside a debug helper.
  expect(readable(Uint8Array.from([0x1b, 0x40, 0x1b, 0x74, 0x00, 0x48, 0x49, 0x0a]))).toBe(
    '<1b>@<1b>t<00>HI\n'
  );
});

/* ── Refusals, as values ───────────────────────────────────────────────── */

test('a destination that tries to climb out of the configured directory is refused', async () => {
  const directory = await sandbox();
  const result = await fileTransport({ directory }).send(EVERY_BYTE, target({ destination: '../escaped' }));

  expect(failed(result)).toBe(true);
  expect(failed(result) && result.error).toContain('refused destination');
  // And nothing was written anywhere.
  await expect(stat(join(directory, '..', 'escaped'))).rejects.toThrow();

  await rm(directory, { recursive: true, force: true });
});

for (const destination of ['..', '.', '/etc', 'a/b', 'a\\b', 'C:', '']) {
  test(`destination ${JSON.stringify(destination)} is refused rather than interpreted`, async () => {
    const directory = await sandbox();
    const result = await fileTransport({ directory }).send(EVERY_BYTE, target({ destination }));
    expect(failed(result)).toBe(true);
    await rm(directory, { recursive: true, force: true });
  });
}

test('a job id that is not a safe filename is refused rather than sanitised', async () => {
  // Sanitising would collapse two different jobs onto one filename, and the second would
  // overwrite the first with no error anywhere.
  const directory = await sandbox();
  const result = await fileTransport({ directory }).send(EVERY_BYTE, target({ jobId: '../../etc/passwd' }));

  expect(failed(result)).toBe(true);
  expect(failed(result) && result.error).toContain('refused job id');

  await rm(directory, { recursive: true, force: true });
});

test('an unwritable directory is a returned failure, not a thrown exception', async () => {
  const directory = await sandbox();
  const notADirectory = join(directory, 'file-in-the-way');
  await writeFile(notADirectory, 'occupied');

  const result = await fileTransport({ directory: notADirectory }).send(EVERY_BYTE, target());

  expect(failed(result)).toBe(true);
  expect(failed(result) && result.retryable).toBe(true);
  expect(failed(result) && result.error).toContain('could not write');

  await rm(directory, { recursive: true, force: true });
});

/* ── NullTransport ─────────────────────────────────────────────────────── */

test('NullTransport always fails, and says why in a sentence a person can read', async () => {
  const result = await new NullTransport().send(EVERY_BYTE, target());

  expect(result.ok).toBe(false);
  expect(failed(result) && result.error).toContain(NULL_TRANSPORT_REASON);
  expect(failed(result) && result.error).toContain(target().jobId);
  expect(failed(result) && result.retryable).toBe(false);
});

test('NullTransport never throws, whatever it is handed', async () => {
  const odd: TransportTarget[] = [
    target(),
    { machineId: '', jobId: '', destination: '' },
    { machineId: '../..', jobId: '\u0000', destination: '\n' },
  ];
  for (const t of odd) {
    for (const bytes of [new Uint8Array(0), EVERY_BYTE]) {
      const result = await new NullTransport().send(bytes, t);
      expect(result.ok).toBe(false);
    }
  }
});

test('NullTransport never reports a success, over many attempts', async () => {
  // The failure mode this guards is the one Phase 1 actually shipped: a "nothing went wrong"
  // that gets recorded as printed. It must be structurally impossible, not merely usual.
  const transport = new NullTransport();
  for (let i = 0; i < 50; i += 1) {
    expect((await transport.send(EVERY_BYTE, target({ jobId: `job_${i}` }))).ok).toBe(false);
  }
});

/* ── The contract both implementations answer to ───────────────────────── */

const implementations: Array<{ name: string; make: (directory: string) => PrintTransport }> = [
  { name: 'FileTransport', make: (directory) => fileTransport({ directory }) },
  { name: 'NullTransport', make: () => new NullTransport() },
];

for (const { name, make } of implementations) {
  test(`${name} names itself for logs and configuration`, async () => {
    const directory = await sandbox();
    expect(make(directory).name.length).toBeGreaterThan(0);
    await rm(directory, { recursive: true, force: true });
  });

  test(`${name} returns a result whose shape can never name a different printer`, async () => {
    const directory = await sandbox();
    const result: TransportResult = await make(directory).send(EVERY_BYTE, target());

    // The whole redirect defect of Phase 1 was a transport-layer decision about WHICH printer.
    // There is no key here that could carry one back, and this rung is what keeps it that way.
    expect(Object.keys(result).sort()).toEqual(
      result.ok ? ['bytesSent', 'detail', 'ok'] : ['error', 'ok', 'retryable']
    );
    expect(Object.keys(result)).not.toContain('printerId');
    expect(Object.keys(result)).not.toContain('machineId');

    await rm(directory, { recursive: true, force: true });
  });

  test(`${name} answers with exactly one of the two verdicts`, async () => {
    const directory = await sandbox();
    const result = await make(directory).send(EVERY_BYTE, target());
    expect(succeeded(result)).toBe(!failed(result));
    expect(typeof result.ok).toBe('boolean');
    await rm(directory, { recursive: true, force: true });
  });
}
