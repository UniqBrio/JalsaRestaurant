/**
 * Owner-readable printing spec — every technical fact becomes a sentence a restaurant owner can act on.
 *
 * FAIL-FIRST EVIDENCE (23-Sep-2026): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import {
  COMPUTER_STALE_MS,
  OWNER_PRINT_MESSAGES,
  computerState,
  ownerPrintError,
  printerReadiness,
  testPrintProgress,
} from '../../src/lib/print-computer';
import { hostedUrl, resolveBridgeDownload, DOWNLOAD_UNAVAILABLE, BRIDGE_DOWNLOAD_ROUTE } from '../../src/lib/print-bridge-download';

const NOW = new Date('2026-09-23T10:00:00Z');
const ago = (ms: number): string => new Date(NOW.getTime() - ms).toISOString();

test('a computer is connected while its heartbeat is fresh, not running once it is stale, waiting before it ever spoke', () => {
  expect(computerState(null, NOW)).toBe('waiting');
  expect(computerState(ago(1000), NOW)).toBe('connected');
  expect(computerState(ago(COMPUTER_STALE_MS), NOW)).toBe('connected');
  expect(computerState(ago(COMPUTER_STALE_MS + 1), NOW)).toBe('not-running');
});

test('the owner’s sentences exist for every case named in the brief, and name no technical thing', () => {
  const all = [
    OWNER_PRINT_MESSAGES.notInstalled,
    OWNER_PRINT_MESSAGES.notRunning,
    OWNER_PRINT_MESSAGES.notPaired,
    OWNER_PRINT_MESSAGES.notConfigured,
    OWNER_PRINT_MESSAGES.unavailable('TVS RP3160'),
    OWNER_PRINT_MESSAGES.offline,
    OWNER_PRINT_MESSAGES.stoppedMidTicket,
    OWNER_PRINT_MESSAGES.unprintableCharacter,
    OWNER_PRINT_MESSAGES.sending,
    OWNER_PRINT_MESSAGES.completed,
    OWNER_PRINT_MESSAGES.generic,
  ];
  expect(OWNER_PRINT_MESSAGES.notInstalled).toBe('Jalsa Print Bridge is not installed on this computer.');
  expect(OWNER_PRINT_MESSAGES.notRunning).toBe('Jalsa Print Bridge is not running.');
  expect(OWNER_PRINT_MESSAGES.notPaired).toBe('This computer is not connected to this Jalsa restaurant.');
  expect(OWNER_PRINT_MESSAGES.unavailable('TVS RP3160')).toBe('TVS RP3160 is not available on this computer.');
  expect(OWNER_PRINT_MESSAGES.notConfigured).toBe('This printer has not been configured for this computer.');
  expect(OWNER_PRINT_MESSAGES.offline).toContain('turned on and connected to this computer');
  for (const s of all) expect(s).not.toMatch(/token|queue|exit code|stack|spooler|winspool|env|machine_id/i);
});

test('READINESS walks the owner to the fix: setting, then computer, then the printer on it', () => {
  const base = { name: 'TVS RP3160', enabled: true, mapping: { queueName: 'TVS' }, computer: { lastSeenAt: ago(1000), revoked: false }, discovered: { status: 'ready' as const }, now: NOW };
  expect(printerReadiness(base)).toEqual({ word: 'Ready', tone: 'success', message: null });
  expect(printerReadiness({ ...base, enabled: false }).word).toBe('Switched off');
  expect(printerReadiness({ ...base, mapping: null }).message).toBe(OWNER_PRINT_MESSAGES.notConfigured);
  expect(printerReadiness({ ...base, computer: { lastSeenAt: ago(1000), revoked: true } }).message).toBe(OWNER_PRINT_MESSAGES.notConfigured);
  expect(printerReadiness({ ...base, computer: { lastSeenAt: null, revoked: false } }).message).toBe(OWNER_PRINT_MESSAGES.notInstalled);
  expect(printerReadiness({ ...base, computer: { lastSeenAt: ago(10 * 60_000), revoked: false } }).message).toBe(OWNER_PRINT_MESSAGES.notRunning);
  expect(printerReadiness({ ...base, discovered: null }).message).toBe('TVS RP3160 is not available on this computer.');
  expect(printerReadiness({ ...base, discovered: { status: 'offline' } }).message).toBe(OWNER_PRINT_MESSAGES.offline);
  expect(printerReadiness({ ...base, discovered: { status: 'error' } }).tone).toBe('error');
  expect(printerReadiness({ ...base, discovered: { status: 'unknown' } }).word).toBe('Ready');
});

test('ERROR MAPPING: the sentences this system writes into last_error become the owner’s, and nothing raw leaks', () => {
  const name = 'TVS RP3160';
  expect(ownerPrintError("The Windows spooler refused queue TVS (exit 2): No printer named 'TVS' on this computer.", name)).toBe('TVS RP3160 is not available on this computer.');
  expect(ownerPrintError("The Windows spooler refused queue TVS (exit 5): Windows reports the printer 'TVS' as Offline.", name)).toBe(OWNER_PRINT_MESSAGES.offline);
  expect(ownerPrintError('The Windows spooler did not answer within 30000 ms for queue TVS. Nothing can be said about whether it printed.', name)).toBe(OWNER_PRINT_MESSAGES.offline);
  expect(ownerPrintError('This bridge does not serve KOT-TANDOOR.', name)).toBe(OWNER_PRINT_MESSAGES.notConfigured);
  expect(ownerPrintError('The bridge that took this ticket stopped answering. Nobody can say whether paper came out — check the machine before retrying.', name)).toBe(OWNER_PRINT_MESSAGES.stoppedMidTicket);
  expect(ownerPrintError('Cannot encode "₹" (U+20B9) at line 4, column 12. It is not ASCII and the charset policy has no single-character replacement for it.', name)).toBe(OWNER_PRINT_MESSAGES.unprintableCharacter);
  expect(ownerPrintError('Windows spooler refused the queue name "\\\\x": it is not a printer share or a UNC path.', name)).toBe('TVS RP3160 is not available on this computer.');
  const generic = ownerPrintError('TypeError: Cannot read properties of undefined (reading "foo")\n    at loop.ts:12', name);
  expect(generic).toBe(OWNER_PRINT_MESSAGES.generic);
  expect(generic).not.toContain('TypeError');
});

test('TEST PRINT follows one job: sending, then completed, or the owner’s reading of the failure', () => {
  expect(testPrintProgress(null, 'TVS')).toBeNull();
  expect(testPrintProgress({ status: 'queued', lastError: '' }, 'TVS')).toEqual({ text: OWNER_PRINT_MESSAGES.sending, tone: 'info' });
  expect(testPrintProgress({ status: 'processing', lastError: '' }, 'TVS')).toEqual({ text: OWNER_PRINT_MESSAGES.sending, tone: 'info' });
  expect(testPrintProgress({ status: 'printed', lastError: '' }, 'TVS')).toEqual({ text: OWNER_PRINT_MESSAGES.completed, tone: 'success' });
  expect(testPrintProgress({ status: 'failed', lastError: "No printer named 'TVS'" }, 'TVS')).toEqual({ text: 'TVS is not available on this computer.', tone: 'error' });
  // "Completed" still sends the owner to look at paper — it is not a claim the paper is there.
  expect(OWNER_PRINT_MESSAGES.completed).toContain('Check the printer');
});

/* ── The download, which is never a fake link ──────────────────────────── */

test('the download resolves hosted, then local, then honestly none', () => {
  expect(resolveBridgeDownload({ hosted: 'https://cdn.example/jalsa-print-bridge.zip', localExists: true })).toEqual({ kind: 'hosted', url: 'https://cdn.example/jalsa-print-bridge.zip' });
  expect(resolveBridgeDownload({ hosted: undefined, localExists: true })).toEqual({ kind: 'local', path: 'bridge/dist/jalsa-print-bridge-windows.zip' });
  expect(resolveBridgeDownload({ hosted: '', localExists: false })).toEqual({ kind: 'none' });
  // A plain-http installer is a man-in-the-middle's gift; it is not a source.
  expect(hostedUrl('http://cdn.example/bridge.zip')).toBeNull();
  expect(hostedUrl('not a url')).toBeNull();
  expect(resolveBridgeDownload({ hosted: 'http://cdn.example/bridge.zip', localExists: false })).toEqual({ kind: 'none' });
  expect(DOWNLOAD_UNAVAILABLE).toContain('not been published');
  expect(BRIDGE_DOWNLOAD_ROUTE).toBe('/api/owner/print-bridge/download');
});
