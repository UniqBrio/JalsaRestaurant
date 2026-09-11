/**
 * Reference UNIT spec. No page, no server, no credentials - so it runs everywhere, always.
 *
 * WHAT MAKES THIS A BEHAVIOUR TEST RATHER THAN A RESTATEMENT OF THE DESIGN
 *   Each case COMPUTES the rule's answer for a REAL input, including the input an earlier
 *   version got wrong. A test that only asserts "the function returns what the function
 *   returns" confirms the implementation, not the requirement.
 */
import { test, expect } from '@playwright/test';
import { classifyError, userMessageFor, retryPolicyFor } from '../../src/lib/errors.taxonomy';

test.describe('classifyError - ORDER is the contract', () => {
  test('403 is forbidden, never unauthenticated', () => {
    // The bug this pins: a permission denial classified as an auth failure triggers a refresh
    // loop, or worse, signs the user out for opening a page they cannot see.
    expect(classifyError({ status: 403, message: 'permission denied for table invoices' })).toBe('forbidden');
    expect(classifyError({ code: '42501' })).toBe('forbidden');
  });

  test('a duplicate key is a conflict, not a server error', () => {
    expect(classifyError({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe('conflict');
  });

  test('an expired token is recoverable; a dead refresh token is not', () => {
    expect(classifyError({ status: 401, message: 'JWT expired' })).toBe('unauthenticated');
    expect(classifyError({ message: 'Invalid Refresh Token: Already Used' })).toBe('session-dead');
  });

  test('a missing server function means a stale client, not a 404', () => {
    expect(classifyError({ code: 'PGRST202', message: 'Could not find the function' })).toBe('stale-client');
  });

  test('a fetch TypeError is network, not unknown', () => {
    expect(classifyError({ name: 'TypeError', message: 'Failed to fetch' })).toBe('network');
  });

  test('the api-client timeout abort is network, not unknown', () => {
    // The bug this pins: the client's own AbortController timeout was the one failure the
    // taxonomy could not name, so a timeout showed the generic fallback and never retried.
    expect(classifyError({ name: 'AbortError', message: 'The operation was aborted.' })).toBe('network');
    expect(classifyError({ message: 'signal is aborted without reason' })).toBe('network');
    // ...while a database transaction abort must NOT be mistaken for a network problem.
    expect(classifyError({ code: '25P02', message: 'current transaction is aborted, commands ignored' })).toBe('unknown');
  });

  test('an unrecognised shape is unknown - never silently swallowed', () => {
    expect(classifyError({ weird: true })).toBe('unknown');
    expect(classifyError(null)).toBe('unknown');
    expect(classifyError(undefined)).toBe('unknown');
  });
});

test.describe('userMessageFor', () => {
  test('auth classes show NO toast - the recovery UI is the message', () => {
    expect(userMessageFor('session-dead')).toBeNull();
    expect(userMessageFor('unauthenticated')).toBeNull();
  });

  test('no user-facing message leaks machine detail', () => {
    const LEAKS = ['sql', 'constraint', 'null', 'undefined', 'exception', 'stack', 'jwt', 'pgrst'];
    const classes = ['forbidden', 'conflict', 'validation', 'not-found', 'rate-limited',
                     'stale-client', 'offline', 'network', 'server', 'unknown'] as const;
    for (const c of classes) {
      const msg = userMessageFor(c);
      expect(msg, `${c} must have a message`).toBeTruthy();
      for (const leak of LEAKS) {
        expect(msg!.toLowerCase(), `${c} leaks "${leak}"`).not.toContain(leak);
      }
      // Every message must end a sentence: a fragment reads as a truncation bug to a user.
      expect(msg!.trim().endsWith('.'), `${c} message must be a complete sentence`).toBe(true);
    }
  });
});

test.describe('retryPolicyFor', () => {
  test('never auto-retries a permission denial or a validation failure', () => {
    // Retrying these cannot change the outcome; it only multiplies the load and the log noise.
    expect(retryPolicyFor('forbidden').retry).toBe(false);
    expect(retryPolicyFor('validation').retry).toBe(false);
    expect(retryPolicyFor('conflict').retry).toBe(false);
  });

  test('backs off hardest on rate limiting', () => {
    expect(retryPolicyFor('rate-limited').backoffMs).toBeGreaterThan(retryPolicyFor('network').backoffMs);
  });
});
