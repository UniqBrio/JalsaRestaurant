/**
 * text-format - capitalisation for user-visible text (DR-1).
 *
 * THE RULE
 *   Every visible sentence, label, heading, cell and toast begins with a capital letter.
 *   Mixed capitalisation across screens is the cheapest possible way to look unfinished, and
 *   it is invisible to every mechanical gate - a string is a string.
 *
 * THE TRAP THIS AVOIDS, AND WHY IT IS THE WHOLE POINT
 *   The obvious implementation is `s[0].toUpperCase() + s.slice(1).toLowerCase()`. That
 *   lowercases the rest of the string, which turns "WhatsApp" into "Whatsapp", "PDF" into
 *   "Pdf", "iOS" into "Ios", and every customer's name into a typo. Sentence case means
 *   CAPITALISE THE FIRST LETTER. It never means "lowercase everything else".
 *
 *   So this function only ever raises the first letter, and leaves every other character
 *   exactly as the author wrote it. Anything more ambitious needs a dictionary, and a
 *   dictionary that is wrong about one product name is worse than no transformation at all.
 */

/**
 * True when the value already starts with a capital, a digit, or a symbol that cannot be cased
 * — **and also** when it is a deliberate lowercase-initial proper noun.
 *
 * "iOS", "iPhone", "eBay" all begin lowercase on purpose. Reporting them as uncased is worse
 * than useless: it teaches the reviewer to "correct" them into "IOS" and "EBay", which is the
 * exact corruption `sentenceCase` refuses to perform. A capital at the SECOND character is a
 * dictionary-free signal that the lowercase first letter was chosen, not missed.
 */
export function isSentenceCased(text: string): boolean {
  const t = text.trimStart();
  if (t === '') return true;                     // empty is vacuously fine
  if (!/[a-z]/.test(t.charAt(0))) return true;   // capital, digit, symbol, emoji
  return /^[a-z][A-Z]/.test(t);                  // iOS, eBay: deliberate, not missed
}

/**
 * Capitalise the first letter. Everything after it is untouched, on purpose (see header).
 * Leading whitespace and opening punctuation are skipped so "  hello" and "(hello" both work.
 */
export function sentenceCase(text: string): string {
  const i = text.search(/[A-Za-z]/);
  if (i === -1) return text;                     // no letters: a number, a symbol, an emoji
  return text.slice(0, i) + text.charAt(i).toUpperCase() + text.slice(i + 1);
}

/**
 * Apply to a table cell's display value. Numbers, dates and pre-formatted values pass through
 * untouched - capitalising "12:30" or "₹2.45L" is meaningless, and forcing it through a string
 * transform is how a formatted value silently loses its formatting.
 */
export function cellCase(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') return String(value);
  return sentenceCase(value);
}

/** Review helper: the visible strings that genuinely need a capital (see `isSentenceCased`). */
export function findUncased(strings: readonly string[]): string[] {
  return strings.filter((s) => s.trim() !== '' && !isSentenceCased(s));
}
