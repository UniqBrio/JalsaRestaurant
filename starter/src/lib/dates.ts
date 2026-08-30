/**
 * CP-15 — one date standard: ENTRY, DISPLAY and STORAGE are three different things.
 *
 *   STORAGE  Always ISO 8601 with an explicit offset. A naive timestamp silently means
 *            "whatever timezone the writer happened to be in", which is a different instant on
 *            a different host — and the difference only shows up across a day boundary.
 *   DISPLAY  One canonical, unambiguous format everywhere. `03/04/2026` is April 3rd to half
 *            the world and March 4th to the other half; `03-Apr-2026` is not.
 *   ENTRY    Always through a picker. Free-typed dates produce ambiguity at the exact moment a
 *            user is least likely to notice.
 */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;

/** The ONE display format. Unambiguous in every locale. */
export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** For a date input element, which speaks only YYYY-MM-DD. */
export function toInputValue(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const toStorage = (d: Date): string => d.toISOString();

/**
 * A calendar day is a RANGE, not an instant.
 *
 * `created_at >= '2026-04-03'` silently means midnight UTC, so in a positive-offset timezone it
 * omits several hours of that local day and includes hours of the previous one. Every "the
 * report is missing today's records" bug is some version of this.
 */
export function dayRange(day: Date): { from: string; to: string } {
  const from = new Date(day); from.setHours(0, 0, 0, 0);
  const to = new Date(day); to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** The regex the test gate asserts rendered dates against. */
export const DISPLAY_DATE_PATTERN = /^\d{2}-[A-Z][a-z]{2}-\d{4}$/;
