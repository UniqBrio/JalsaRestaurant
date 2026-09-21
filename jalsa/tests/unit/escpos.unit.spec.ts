/**
 * escpos unit spec — golden bytes, and the charset policy's refusal to guess.
 *
 * WHY GOLDEN BYTES AND NOT "IT LOOKS RIGHT"
 *   The encoder's whole contract is that a given ticket produces a given byte stream. Nothing
 *   downstream can check that: a spooler accepts whatever it is handed, and a printer that
 *   receives `1B 45 00` where `1B 45 01` was meant prints a line that is merely not bold — legible,
 *   plausible, and wrong. Pinning the exact bytes is the only place that class of defect can be
 *   caught before paper.
 *
 * FAIL-FIRST EVIDENCE (21-Sep-2026): recorded in TEST_SUMMARY.md. Each guarantee was checked by
 * injecting its own defect into the finished encoder and re-running.
 */
import { test, expect } from '@playwright/test';
import {
  DEFAULT_CHARSET,
  DEFAULT_ENCODER,
  EncodeError,
  columnsFor,
  encodeTicket,
  hex,
  printableMmFor,
  type EncoderConfig,
} from '../../src/lib/escpos';
import { PAPER, type TicketLine } from '../../src/lib/print-template';

const plain = (text: string): TicketLine => ({ text, weight: 'plain' });
const bold = (text: string): TicketLine => ({ text, weight: 'bold' });
const big = (text: string): TicketLine => ({ text, weight: 'big' });

const cfg = (over: Partial<EncoderConfig> = {}): EncoderConfig => ({ ...DEFAULT_ENCODER, ...over });

/* ── Initialisation ────────────────────────────────────────────────────── */

test('every stream opens by resetting the printer and declaring a codepage', () => {
  // ESC @ then ESC t 0. The reset matters because the previous job may have died mid-emphasis.
  const bytes = encodeTicket([], cfg({ feedLines: 0 }));
  expect(hex(bytes)).toBe('1B 40 1B 74 00');
});

test('the declared codepage is the one configured, not a constant', () => {
  const bytes = encodeTicket([], cfg({ feedLines: 0, charset: { ...DEFAULT_CHARSET, codepage: 16 } }));
  expect(hex(bytes)).toBe('1B 40 1B 74 10');
});

/* ── Text and weights ──────────────────────────────────────────────────── */

test('plain text is its ASCII bytes, one line, one LF', () => {
  const bytes = encodeTicket([plain('HI')], cfg({ feedLines: 0 }));
  //             ESC @   ESC t 0   H  I  LF
  expect(hex(bytes)).toBe('1B 40 1B 74 00 48 49 0A');
});

test('BOLD IS ESC E 1, AND IT IS TURNED BACK OFF', () => {
  const bytes = encodeTicket([bold('A'), plain('B')], cfg({ feedLines: 0 }));
  expect(hex(bytes)).toBe(
    '1B 40 1B 74 00 ' + // init + codepage
      '1B 45 01 ' + //      bold on
      '41 0A ' + //         "A" LF
      '1B 45 00 ' + //      bold off — the transition back
      '42 0A' //            "B" LF
  );
});

test('BIG IS GS ! 11 — double width AND double height', () => {
  const bytes = encodeTicket([big('A'), plain('B')], cfg({ feedLines: 0 }));
  expect(hex(bytes)).toBe('1B 40 1B 74 00 ' + '1D 21 11 ' + '41 0A ' + '1D 21 00 ' + '42 0A');
});

test('a mode is stated once, not re-stated per line', () => {
  // Three bold lines carry ONE `ESC E 1`. Re-stating it would work and would also triple the
  // control bytes, and a stream nobody can read by eye is a stream nobody checks.
  const bytes = encodeTicket([bold('A'), bold('B'), bold('C')], cfg({ feedLines: 0 }));
  expect(hex(bytes)).toBe('1B 40 1B 74 00 1B 45 01 41 0A 42 0A 43 0A 1B 45 00');
  expect([...bytes].filter((_, i) => hex(bytes.slice(i, i + 3)) === '1B 45 01')).toHaveLength(1);
});

test('THE STREAM NEVER ENDS MID-EMPHASIS — the next job starts clean', () => {
  // A job that ends bold makes the NEXT job wrong, and that one prints in a different room from
  // the person who could connect the two.
  const boldEnd = hex(encodeTicket([bold('X')], cfg({ feedLines: 0 })));
  expect(boldEnd.endsWith('1B 45 00')).toBe(true);

  const bigEnd = hex(encodeTicket([big('X')], cfg({ feedLines: 0 })));
  expect(bigEnd.endsWith('1D 21 00')).toBe(true);
});

test('going straight from big to bold emits both transitions', () => {
  const bytes = encodeTicket([big('A'), bold('B')], cfg({ feedLines: 0 }));
  expect(hex(bytes)).toBe(
    '1B 40 1B 74 00 ' + '1D 21 11 ' + '41 0A ' + '1B 45 01 ' + '1D 21 00 ' + '42 0A ' + '1B 45 00'
  );
});

/* ── Feed and cut ──────────────────────────────────────────────────────── */

test('feed is ESC d n, with n the configured line count', () => {
  expect(hex(encodeTicket([], cfg({ feedLines: 4 })))).toBe('1B 40 1B 74 00 1B 64 04');
  expect(hex(encodeTicket([], cfg({ feedLines: 1 })))).toBe('1B 40 1B 74 00 1B 64 01');
  // Zero means zero: no command at all, rather than `ESC d 0`.
  expect(hex(encodeTicket([], cfg({ feedLines: 0 })))).toBe('1B 40 1B 74 00');
});

test('cut is an explicit operation, and its default is to leave the paper attached', () => {
  // `none` is the honest default while cut support on the RP3160 is unproven (Gate 7).
  expect(DEFAULT_ENCODER.cut).toBe('none');
  expect(hex(encodeTicket([], cfg({ feedLines: 0, cut: 'none' })))).toBe('1B 40 1B 74 00');
  expect(hex(encodeTicket([], cfg({ feedLines: 0, cut: 'full' })))).toBe('1B 40 1B 74 00 1D 56 00');
  expect(hex(encodeTicket([], cfg({ feedLines: 0, cut: 'partial' })))).toBe('1B 40 1B 74 00 1D 56 01');
});

test('the cut comes after the feed, so the tear edge clears the head', () => {
  expect(hex(encodeTicket([plain('X')], cfg({ feedLines: 3, cut: 'full' })))).toBe(
    '1B 40 1B 74 00 58 0A 1B 64 03 1D 56 00'
  );
});

/* ── The paper contract ────────────────────────────────────────────────── */

test('the paper spec is READ from print-template, never restated', () => {
  // Two copies of "80 mm is 48 columns" is two numbers that can disagree.
  expect(columnsFor({ width: '80' })).toBe(PAPER['80'].cols.normal);
  expect(printableMmFor({ width: '80' })).toBe(PAPER['80'].printable);
  expect(columnsFor({ width: '80' })).toBe(48);
  expect(printableMmFor({ width: '80' })).toBe(72);
});

test('58 mm carries its own column count, from the same source', () => {
  expect(columnsFor({ width: '58' })).toBe(PAPER['58'].cols.normal);
  expect(columnsFor({ width: '58' })).toBe(32);
  expect(columnsFor({ width: '58' })).not.toBe(columnsFor({ width: '80' }));
});

test('a full 48-column line survives byte for byte', () => {
  const ruler = '123456789012345678901234567890123456789012345678';
  expect(ruler).toHaveLength(48);
  const bytes = encodeTicket([plain(ruler)], cfg({ feedLines: 0 }));
  // Everything between the header and the trailing LF is the line, unaltered.
  expect(bytes.slice(5, -1)).toEqual(Uint8Array.from([...ruler].map((c) => c.charCodeAt(0))));
});

test('THE ENCODER NEVER TRUNCATES AND NEVER WRAPS', () => {
  // Sixty characters on a forty-eight-column roll. Deciding that was too long is the template's
  // job, and `validateTemplate` already refuses to save such a configuration — an encoder that
  // trimmed here would turn a caught layout fault into a quietly clipped figure on a bill.
  const over = 'X'.repeat(60);
  const bytes = encodeTicket([plain(over)], cfg({ width: '80', feedLines: 0 }));
  const body = bytes.slice(5, -1);
  expect(body).toHaveLength(60);
  expect([...body].every((b) => b === 0x58)).toBe(true);
  // One LF, at the end — no wrap was injected.
  expect([...bytes].filter((b) => b === 0x0a)).toHaveLength(1);
});

/* ── Determinism ───────────────────────────────────────────────────────── */

test('SAME LINES AND SAME CONFIG PRODUCE THE SAME BYTES', () => {
  // The property every golden test above rests on. No clock, no randomness, no I/O.
  const lines = [bold('JALSA'), plain('Table 4'), big('KOT-113'), plain('x2 Biryani')];
  const a = encodeTicket(lines, cfg({ feedLines: 4, cut: 'full' }));
  const b = encodeTicket(lines, cfg({ feedLines: 4, cut: 'full' }));
  expect(hex(a)).toBe(hex(b));
  // And a different config is a different stream — the config is genuinely an input.
  expect(hex(encodeTicket(lines, cfg({ cut: 'none' })))).not.toBe(hex(a));
});

test('a realistic ticket, pinned whole', () => {
  const bytes = encodeTicket(
    [bold('JALSA'), plain('--------'), big('KOT-113'), plain('x2 Biryani')],
    cfg({ feedLines: 2, cut: 'full' })
  );
  expect(hex(bytes)).toBe(
    '1B 40 1B 74 00 ' +
      '1B 45 01 4A 41 4C 53 41 0A ' + // bold "JALSA"
      '1B 45 00 2D 2D 2D 2D 2D 2D 2D 2D 0A ' + // plain "--------"
      '1D 21 11 4B 4F 54 2D 31 31 33 0A ' + // big "KOT-113"
      '1D 21 00 78 32 20 42 69 72 79 61 6E 69 0A ' + // plain "x2 Biryani"
      '1B 64 02 1D 56 00' // feed 2, full cut
  );
});

/* ── The charset policy ────────────────────────────────────────────────── */

test('ASCII passes through untouched, including the awkward end of it', () => {
  const bytes = encodeTicket([plain(' !~\t')], cfg({ feedLines: 0 }));
  expect(hex(bytes)).toBe('1B 40 1B 74 00 20 21 7E 09 0A');
});

test('a MAPPED character becomes its declared single ASCII equivalent', () => {
  const bytes = encodeTicket([plain('A—B')], cfg({ feedLines: 0 })); // em dash
  expect(hex(bytes)).toBe('1B 40 1B 74 00 41 2D 42 0A'); // A - B
  // And the line is exactly as long as it was: one character in, one out.
  expect(bytes.slice(5, -1)).toHaveLength(3);
});

test('every declared replacement is length-preserving and ASCII', () => {
  // The rule the map itself must satisfy. A three-character replacement shifts everything after
  // it, so a right-aligned amount stops being right-aligned.
  for (const [from, to] of Object.entries(DEFAULT_CHARSET.map)) {
    expect([...to], `${JSON.stringify(from)} → ${JSON.stringify(to)} must be ONE character`).toHaveLength(1);
    expect((to.codePointAt(0) ?? 0), `${JSON.stringify(to)} must be ASCII`).toBeLessThanOrEqual(0x7f);
    expect([...from]).toHaveLength(1);
  }
});

test('AN UNMAPPED CHARACTER FAILS — it is never silently replaced', () => {
  // The whole point of the policy. A '?' on a bill is a character nobody can trace.
  let thrown: EncodeError | null = null;
  try {
    encodeTicket([plain('ok'), plain('Crème brûlée')], cfg());
  } catch (err) {
    thrown = err as EncodeError;
  }
  expect(thrown, 'an unencodable character must throw').not.toBeNull();
  expect(thrown).toBeInstanceOf(EncodeError);
});

test('THE ERROR NAMES THE CODEPOINT, THE LINE AND THE COLUMN', () => {
  // "Cannot encode U+20B9" sends somebody reading the whole ticket. "line 3, column 12" sends
  // them to the dish name with a rupee sign in it.
  let thrown: EncodeError | null = null;
  try {
    encodeTicket([plain('one'), plain('two'), plain('Total: ₹250')], cfg());
  } catch (err) {
    thrown = err as EncodeError;
  }

  expect(thrown).toBeInstanceOf(EncodeError);
  expect(thrown?.char).toBe('₹');
  expect(thrown?.codepoint).toBe(0x20b9);
  expect(thrown?.codepointHex).toBe('U+20B9');
  expect(thrown?.line, 'third line, 1-based').toBe(3);
  expect(thrown?.column, '"Total: " is seven characters, so the rupee is the eighth').toBe(8);
  // And the message a person reads carries all three.
  expect(thrown?.message).toContain('U+20B9');
  expect(thrown?.message).toContain('line 3');
  expect(thrown?.message).toContain('column 8');
});

test('THE RUPEE SIGN IS DELIBERATELY UNMAPPED', () => {
  // Its honest rendering is "Rs." — three characters where the grid budgeted one. Mapping it to
  // "R" would be a guess printed on a bill. `print-template` never emits it, so a ₹ arriving here
  // came from data and somebody should hear about it.
  expect(DEFAULT_CHARSET.map['₹']).toBeUndefined();
  expect(() => encodeTicket([plain('₹')], cfg())).toThrow(EncodeError);
});

test('a map entry that is NOT length-preserving is caught, not applied', () => {
  // A configuration fault, refused at the point it would shift a line.
  const bad = cfg({ charset: { codepage: 0, map: { '₹': 'Rs.' } } });
  expect(() => encodeTicket([plain('₹')], bad)).toThrow(EncodeError);

  const alsoBad = cfg({ charset: { codepage: 0, map: { '₹': '£' } } }); // non-ASCII replacement
  expect(() => encodeTicket([plain('₹')], alsoBad)).toThrow(EncodeError);
});

test('the column reported counts CODE POINTS, not UTF-16 units', () => {
  // An emoji is one character to a person and two units to JavaScript. Reporting column 3 for
  // what they see as character 2 sends them to the wrong place.
  let thrown: EncodeError | null = null;
  try {
    encodeTicket([plain('\u{1F600}\u{1F600}')], cfg());
  } catch (err) {
    thrown = err as EncodeError;
  }
  expect(thrown?.codepoint, 'the real codepoint, not a lone surrogate').toBe(0x1f600);
  expect(thrown?.column).toBe(1);
});

test('an extended charset can be declared without touching the encoder', () => {
  // The policy is data. Adding a character is a config change, not a code change — which is what
  // makes Gate 7 able to widen it once hardware says what the printer actually holds.
  const withDegree = cfg({ feedLines: 0, charset: { codepage: 0, map: { ...DEFAULT_CHARSET.map, '°': 'o' } } });
  expect(hex(encodeTicket([plain('30°')], withDegree))).toBe('1B 40 1B 74 00 33 30 6F 0A');
});
