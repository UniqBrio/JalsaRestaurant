/**
 * The restaurant's calendar day — the one place a `YYYY-MM-DD` becomes an instant.
 *
 * WHY THIS FILE EXISTS
 *   `new Date('2026-09-22T00:00:00')` carries no offset, so JavaScript reads it as the HOST's
 *   local time. On a developer's laptop in Hosur that is 18:30 UTC the previous day; on Vercel,
 *   which runs in UTC, it is midnight UTC. The same string therefore meant two different
 *   instants depending on where the code ran, and only the deployed one was wrong.
 *
 *   The damage is invisible until a day boundary. A bill settled at 00:16 on the 22nd is stored
 *   at 18:46Z on the 21st; a report for the 22nd built on UTC midnight starts five and a half
 *   hours too late and never sees it, while a report for the 21st claims it. A restaurant that
 *   serves past midnight loses its last sitting from one day and gains it in the wrong one.
 *
 *   This is CP-15 in `dates.ts` stated as code: a calendar day is a RANGE, and which range
 *   depends on whose calendar. `dates.ts` says so in prose and its own helper uses host-local
 *   time, which is right in the browser and wrong on the server — so the server reads this.
 *
 * WHY THE ZONE IS A CONSTANT AND NOT A SETTING
 *   There is no column for it. `restaurant` carries name, address and tax identifiers and has
 *   never had a timezone, so inventing a setting here would be a schema change smuggled in
 *   behind a bug fix. Jalsa serves one restaurant, in Hosur, and IST has no daylight saving.
 *   The constant is honest about being one value, and the functions below take the zone as an
 *   argument so that the day this becomes a per-restaurant setting, only the default moves.
 *
 * WHY THE OFFSET IS MEASURED RATHER THAN HARDCODED
 *   `+05:30` written as a number would be correct here and wrong in the first zone that observes
 *   daylight saving. `Intl` already knows every zone's rules; asking it what the offset was AT A
 *   GIVEN INSTANT costs nothing and cannot drift.
 */

/** Asia/Kolkata. One restaurant, one zone, no daylight saving. */
export const RESTAURANT_TIME_ZONE = 'Asia/Kolkata';

/**
 * How far `zone` was ahead of UTC at `at`, in milliseconds.
 *
 * Formats the instant in the zone, reads the resulting wall-clock back as though it were UTC,
 * and takes the difference. That is the offset, obtained from the same rules the platform uses
 * for display, so a zone with daylight saving is handled without this file knowing its rules.
 */
function offsetMs(zone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');

  // `hour` comes back as 24 at midnight under hour12: false in some engines; 24 % 24 is 0, and
  // the date parts already name the correct day, so the modulo cannot move it.
  const asIfUtc = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour') % 24, read('minute'), read('second'));
  return asIfUtc - at.getTime();
}

/**
 * The instant a calendar day BEGINS in the restaurant's zone.
 *
 * Two passes, deliberately. The offset is a property of an instant, not of a date, so the first
 * pass has to guess one to ask about. In a zone that changed offset overnight the guess can land
 * on the wrong side of the change; measuring again at the candidate instant lands it right. In
 * IST both passes agree, and the second costs one `Intl` call on a path that runs once a report.
 */
export function startOfDay(day: string, zone: string = RESTAURANT_TIME_ZONE): Date {
  const [y, m, d] = day.split('-').map(Number);
  const midnightAsUtc = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
  const firstPass = new Date(midnightAsUtc - offsetMs(zone, new Date(midnightAsUtc)));
  return new Date(midnightAsUtc - offsetMs(zone, firstPass));
}

/**
 * The half-open window covering `from`..`to` inclusive, as local calendar days.
 *
 * Half-open — `closed_at >= start and closed_at < end` — because the alternative is an end
 * stamped 23:59:59.999 that drops a bill settled in the last millisecond of the day. Nobody
 * would ever see that bug and everybody would have it.
 */
export function dayWindow(
  from: string,
  to: string,
  zone: string = RESTAURANT_TIME_ZONE
): { start: Date; end: Date } {
  const [y, m, d] = to.split('-').map(Number);
  const dayAfterTo = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1));
  const nextDay = `${dayAfterTo.getUTCFullYear()}-${String(dayAfterTo.getUTCMonth() + 1).padStart(2, '0')}-${String(dayAfterTo.getUTCDate()).padStart(2, '0')}`;
  return { start: startOfDay(from, zone), end: startOfDay(nextDay, zone) };
}

/**
 * Which calendar day `at` falls on, in the restaurant's zone.
 *
 * The server needs this for two things that used to read the host's clock: deciding whether a
 * requested range is in the future, and stamping which day a bill was settled on. Between
 * midnight and 05:30 IST the host's answer is yesterday, which made the server reject a range
 * the browser had just accepted.
 */
export function dayIn(at: Date, zone: string = RESTAURANT_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

/**
 * `new Date()` as the restaurant reads it, for the one argument `checkRange` takes.
 *
 * `checkRange` compares against a Date's LOCAL parts, so handing it the raw server clock asks
 * "is this range in UTC's future". This returns an instant whose local parts, on a UTC host,
 * spell the restaurant's date — the smallest change that makes the server and the browser agree
 * without `checkRange` itself learning about zones.
 */
export function nowForRangeCheck(now: Date = new Date(), zone: string = RESTAURANT_TIME_ZONE): Date {
  const [y, m, d] = dayIn(now, zone).split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}
