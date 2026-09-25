/**
 * The Google review link (item 40, 25-Sep-2026) - what makes one usable.
 *
 * Nothing here names a restaurant: the link is whatever the owner saves. Empty is allowed and
 * hides the review card. Anything else must be a complete https address, or a happy guest is sent
 * nowhere - refused, with the reason. A working https link that is not on a Google address is
 * allowed but said out loud, because a review link on somebody else's site is the likeliest typo.
 */

const GOOGLE_HOSTS = [/(^|\.)google\.[a-z.]+$/, /(^|\.)g\.page$/, /(^|\.)goo\.gl$/, /(^|\.)g\.co$/];

export type ReviewLinkCheck =
  | { state: 'empty' }
  | { state: 'invalid'; reason: string }
  | { state: 'ok'; url: string; warning: string | null };

export function checkReviewLink(input: string): ReviewLinkCheck {
  const raw = (input ?? '').trim();
  if (!raw) return { state: 'empty' };
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { state: 'invalid', reason: 'That is not a web address. Paste the whole link, starting https://' };
  }
  if (u.protocol !== 'https:') return { state: 'invalid', reason: 'The review link must start with https://' };
  if (!u.hostname.includes('.')) return { state: 'invalid', reason: 'That address has no website in it. Paste the link Google gave you.' };
  const google = GOOGLE_HOSTS.some((re) => re.test(u.hostname.toLowerCase()));
  return {
    state: 'ok',
    url: u.toString(),
    warning: google ? null : `This link is on ${u.hostname}, not a Google address. Check it opens your Google review page.`,
  };
}
