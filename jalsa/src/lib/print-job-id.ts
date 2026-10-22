import { createHash } from 'node:crypto';

/**
 * The id of a bill's FIRST invoice job, the same every time it is asked for (22-Oct-2026).
 *
 * Every first invoice - closeBill's automatic one and the one-time Print Invoice - is inserted
 * under this id, so a second copy (a double tap, a request retried after its answer was lost,
 * two screens at once) fails on `print_job`'s primary key instead of printing twice. Reprints,
 * retries and Print elsewhere keep their own ids: they are separate, deliberate tickets.
 *
 * Its own module, not `mutations.ts`, so the database spec can compute the id the server writes.
 */
export function firstInvoiceJobId(billId: string): string {
  const h = createHash('sha256').update(`jalsa:print_job:first-invoice:${billId}`).digest('hex').slice(0, 32).split('');
  h[12] = '8'; // RFC 9562 version 8: a name-derived id with a custom hash
  h[16] = ((parseInt(h[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  const x = h.join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
