import { PAPER, type LineWeight, type PaperWidth, type TicketLine } from './print-template';

/**
 * escpos — a composed ticket, as the bytes a thermal printer eats.
 *
 * WHERE THIS SITS, AND WHAT IT IS NOT
 *   `print-template.ts` decides WHAT the paper says and how wide the grid is. This file decides
 *   only how those exact strings become bytes. It has no idea what a KOT is, cannot route, cannot
 *   total, and never re-wraps: hand it a sixty-character line on a forty-eight-column roll and it
 *   emits sixty characters, because deciding that line was too long was somebody else's job and
 *   `validateTemplate` already refuses to save such a configuration. An encoder that silently
 *   trimmed would turn a caught layout fault into a quietly clipped figure on a bill.
 *
 *   No Windows API, no printer handle, no database, no clock, no randomness. Same lines and same
 *   config produce the same bytes, every time, which is the only reason golden-byte tests mean
 *   anything.
 *
 * THE CODEPAGE IS DECLARED, NOT VERIFIED
 *   `ESC t n` selects a character table, and this module emits one. That is a STATEMENT OF INTENT
 *   until a real TVS RP3160 has printed from it — no device has confirmed which table it holds,
 *   or that it honours the selection at all. So the encoder does not emit high bytes on the
 *   strength of a table nobody has checked: ASCII passes through, and anything else must be named
 *   explicitly in the charset map or the job fails loudly. Adding a verified CP437 upper half is
 *   Gate 7 work, after hardware says so.
 */

/* ── The command vocabulary ────────────────────────────────────────────── */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** ESC @ — reset every mode the last job may have left set. */
const INIT = [ESC, 0x40] as const;
/** ESC t n — select the character code table. */
const CODEPAGE = (n: number) => [ESC, 0x74, n];
/** ESC E n — emphasis. */
const BOLD = (on: boolean) => [ESC, 0x45, on ? 0x01 : 0x00];
/** GS ! n — character size; the high nibble is width, the low nibble height, each 0-based. */
const SIZE = (doubled: boolean) => [GS, 0x21, doubled ? 0x11 : 0x00];
/** ESC d n — feed n lines. */
const FEED = (lines: number) => [ESC, 0x64, lines];
/** GS V m — 0 full, 1 partial. */
const CUT = (partial: boolean) => [GS, 0x56, partial ? 0x01 : 0x00];

/* ── The charset policy ────────────────────────────────────────────────── */

export interface CharsetPolicy {
  /**
   * The `ESC t` table this encoder DECLARES. 0 is CP437. Declared, not verified — see the header.
   */
  codepage: number;
  /**
   * Characters outside ASCII that may be printed, and the single ASCII character each becomes.
   *
   * REPLACEMENTS ARE LENGTH-PRESERVING, AND THAT IS NOT A STYLE RULE. The template laid this line
   * out against a fixed column count and padded it to align. Turning one character into three
   * shifts everything after it, so a right-aligned amount stops being right-aligned and a
   * separator runs onto the next line. One character in, one character out, or nothing.
   */
  map: Readonly<Record<string, string>>;
}

/**
 * The replacements Jalsa declares today.
 *
 * These are the typographic characters a person actually types into a dish name or a round note —
 * curly quotes a phone keyboard produces by itself, dashes pasted from a document. Each has an
 * unambiguous single-character ASCII equivalent, which is the only reason it is here.
 *
 * ₹ (U+20B9) IS DELIBERATELY ABSENT. Its honest ASCII rendering is "Rs.", which is three
 * characters where the grid budgeted one, and a rupee symbol quietly becoming "R" on a bill is
 * worse than a job that refuses and says why. `print-template.ts` never emits it — every printed
 * figure goes through `String(n)` — so a ₹ reaching this encoder means it came from data, and the
 * person who put it there should hear about it rather than have it guessed at.
 */
export const DEFAULT_CHARSET: CharsetPolicy = {
  codepage: 0,
  map: {
    '—': '-', // em dash
    '–': '-', // en dash
    '‘': "'", // left single quote
    '’': "'", // right single quote / apostrophe
    '“': '"', // left double quote
    '”': '"', // right double quote
    '·': '.', // middle dot
    ' ': ' ', // non-breaking space
    '…': '.', // ellipsis — one dot, because three would shift the line
  },
};

export interface EncoderConfig {
  /** Which roll. Read from `print-template`'s PAPER rather than restated here. */
  width: PaperWidth;
  charset: CharsetPolicy;
  /** Blank lines fed after the last line, so the tear edge clears the print head. */
  feedLines: number;
  /** `none` leaves the paper attached — the honest default where cut support is unproven. */
  cut: 'none' | 'full' | 'partial';
}

export const DEFAULT_ENCODER: EncoderConfig = {
  width: '80',
  charset: DEFAULT_CHARSET,
  feedLines: 4,
  cut: 'none',
};

/**
 * The columns the composed text was laid out against.
 *
 * Read from `PAPER`, never redeclared: two copies of "80 mm is 48 columns" is two numbers that
 * can disagree, and the one that drifts is always the one the kitchen finds.
 */
export const columnsFor = (config: Pick<EncoderConfig, 'width'>): number => PAPER[config.width].cols.normal;

/** The printable width in millimetres — 72 mm on an 80 mm roll. Also read from PAPER. */
export const printableMmFor = (config: Pick<EncoderConfig, 'width'>): number => PAPER[config.width].printable;

/* ── The failure ───────────────────────────────────────────────────────── */

/**
 * A character the policy has no byte for.
 *
 * Carries WHERE, not just what. "Cannot encode U+20B9" sends somebody reading the whole ticket;
 * "line 7, column 34" sends them to the dish name with a rupee sign in it.
 */
export class EncodeError extends Error {
  readonly char: string;
  readonly codepoint: number;
  /** `U+20B9` — the form a person can paste into a search. */
  readonly codepointHex: string;
  /** 1-based, counting the lines as they were handed in. */
  readonly line: number;
  /** 1-based, counting characters in that line. */
  readonly column: number;

  constructor(input: { char: string; codepoint: number; line: number; column: number }) {
    const hex = `U+${input.codepoint.toString(16).toUpperCase().padStart(4, '0')}`;
    super(
      `Cannot encode ${JSON.stringify(input.char)} (${hex}) at line ${input.line}, column ${input.column}. ` +
        `It is not ASCII and the charset policy has no single-character replacement for it. ` +
        `Add one to the charset map, or take the character out of the data.`
    );
    this.name = 'EncodeError';
    this.char = input.char;
    this.codepoint = input.codepoint;
    this.codepointHex = hex;
    this.line = input.line;
    this.column = input.column;
  }
}

/* ── The encoder ───────────────────────────────────────────────────────── */

/**
 * One line's text as bytes, or a failure naming the character that stopped it.
 *
 * Iterates by code POINT, not by UTF-16 unit, so an astral character reports its real codepoint
 * rather than a lone surrogate — and the column a person counts to matches the column reported.
 */
function encodeText(text: string, charset: CharsetPolicy, line: number, out: number[]): void {
  let column = 0;
  for (const char of text) {
    column += 1;
    const codepoint = char.codePointAt(0) ?? 0;

    if (codepoint <= 0x7f) {
      out.push(codepoint);
      continue;
    }

    const replacement = charset.map[char];
    if (replacement === undefined) throw new EncodeError({ char, codepoint, line, column });

    // A map entry that is not one ASCII character is a configuration fault, and it is caught here
    // rather than silently shifting the line it lands in.
    const replacementPoint = replacement.codePointAt(0) ?? 0;
    if ([...replacement].length !== 1 || replacementPoint > 0x7f) {
      throw new EncodeError({ char, codepoint, line, column });
    }
    out.push(replacementPoint);
  }
}

/**
 * A composed ticket as a byte stream.
 *
 * WEIGHT IS A TRANSITION, NOT A WRAPPER. The stream carries `ESC E 1` only when a line is bolder
 * than the one before it, and `GS ! 0` only when it stops being big. Re-stating the mode on every
 * line would work and would also triple the control bytes, and a stream nobody can read by eye is
 * a stream nobody checks. The modes are reset once at the end, so the next job starts clean
 * whatever this one did.
 */
export function encodeTicket(lines: readonly TicketLine[], config: EncoderConfig = DEFAULT_ENCODER): Uint8Array {
  const out: number[] = [];

  out.push(...INIT);
  out.push(...CODEPAGE(config.charset.codepage));

  let bold = false;
  let big = false;

  lines.forEach((line, index) => {
    const weight: LineWeight = line.weight;
    const wantBold = weight === 'bold';
    const wantBig = weight === 'big';

    if (wantBold !== bold) {
      out.push(...BOLD(wantBold));
      bold = wantBold;
    }
    if (wantBig !== big) {
      out.push(...SIZE(wantBig));
      big = wantBig;
    }

    encodeText(line.text, config.charset, index + 1, out);
    out.push(LF);
  });

  // Leave the printer as we found it. A job that ends mid-emphasis makes the NEXT job wrong, and
  // that one prints in a different room from the person who could connect the two.
  if (bold) out.push(...BOLD(false));
  if (big) out.push(...SIZE(false));

  if (config.feedLines > 0) out.push(...FEED(config.feedLines));
  if (config.cut !== 'none') out.push(...CUT(config.cut === 'partial'));

  return Uint8Array.from(out);
}

/** Bytes as `1B 40 1B 74 00` — the form a golden test and a bug report can both read. */
export const hex = (bytes: Uint8Array): string =>
  [...bytes].map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
