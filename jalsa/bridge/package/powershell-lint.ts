/**
 * powershell-lint — what must be true of a script before it is put in a restaurant's download.
 *
 * THE DEFECT THIS EXISTS FOR (23-Sep-2026, first real Windows run)
 *   `install.ps1` contained `→` and `—`. The file had no byte-order mark, so Windows PowerShell 5.1
 *   read it in the machine's ANSI code page (Windows-1252). In that decoding the UTF-8 byte 0x92
 *   of `→` is `’`, and PowerShell accepts the typographic quotes ‘ ’ ‚ ‛ as string delimiters —
 *   so a `'…Jalsa → Printers…'` string CLOSED at the arrow, the real `'` opened an unterminated
 *   one, and every enclosing `{` was reported unclosed: "The string is missing the terminator"
 *   at 125:97, then 124, 77, 73. PowerShell 7 on Linux reproduced the same four errors from the
 *   same bytes decoded as Windows-1252, and none when decoded as UTF-8.
 *
 * TWO RULES, BOTH ENFORCED HERE AND BOTH REQUIRED
 *   1. ASCII ONLY. No character above 0x7F anywhere in a script the package ships. There is no
 *      arrow, dash or quote a customer needs to see that ASCII cannot spell.
 *   2. A BYTE-ORDER MARK, CRLF. `prepareForWindows` writes `EF BB BF` first and normalises line
 *      endings, so even a future non-ASCII character is decoded as UTF-8 by every PowerShell.
 *   Either alone would have prevented the defect. Both are cheap, and the second is invisible.
 *
 * THE TOKENIZER
 *   A deliberately small model of PowerShell's lexer: line and block comments, single- and
 *   double-quoted strings with their escapes, here-strings, and brace/paren balance outside all
 *   of those — enough to catch an unterminated string or an unclosed block, which is the class
 *   this file exists for. It treats the typographic quotes exactly as PowerShell does, so it also
 *   fails on the ANSI-decoded view of the old file (that is the regression test). It is not the
 *   real parser: when `pwsh` or `powershell` is on the PATH the packager runs that too.
 */

export interface LintError {
  line: number;
  column: number;
  message: string;
}

export type LintResult = { ok: true } | { ok: false; errors: LintError[] };

/** PowerShell accepts these as `'` and `"` respectively. */
const SINGLE_QUOTES = new Set(["'", '\u2018', '\u2019', '\u201a', '\u201b']);
const DOUBLE_QUOTES = new Set(['"', '\u201c', '\u201d', '\u201e']);

function position(text: string, index: number): { line: number; column: number } {
  let line = 1;
  let last = -1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
      last = i;
    }
  }
  return { line, column: index - last };
}

/** Rule 1, on its own: every non-ASCII character, by position. */
export function nonAscii(text: string): LintError[] {
  const out: LintError[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code > 0x7e && code !== 0x0d) {
      const at = position(text, i);
      out.push({
        ...at,
        message: `non-ASCII character U+${code.toString(16).toUpperCase().padStart(4, '0')} — Windows PowerShell 5.1 reads a script without a BOM in the ANSI code page, where this may become a quote.`,
      });
    }
  }
  return out;
}

/** The tokenizer. Returns the structural errors PowerShell's own parser would report first. */
export function tokenizeErrors(text: string): LintError[] {
  const errors: LintError[] = [];
  const stack: Array<{ ch: string; index: number }> = [];
  let i = 0;
  const n = text.length;

  const err = (index: number, message: string): void => {
    errors.push({ ...position(text, index), message });
  };

  while (i < n) {
    const c = text[i] as string;
    const next = text[i + 1] ?? '';

    // Block comment.
    if (c === '<' && next === '#') {
      const end = text.indexOf('#>', i + 2);
      if (end < 0) {
        err(i, 'block comment is never closed (<# without #>)');
        return errors;
      }
      i = end + 2;
      continue;
    }
    // Line comment.
    if (c === '#') {
      const end = text.indexOf('\n', i);
      i = end < 0 ? n : end + 1;
      continue;
    }
    // Here-strings: @' … '@ and @" … "@, terminator at the start of a line.
    if (c === '@' && (SINGLE_QUOTES.has(next) || DOUBLE_QUOTES.has(next))) {
      const single = SINGLE_QUOTES.has(next);
      const terminator = single ? /\r?\n'@/g : /\r?\n"@/g;
      terminator.lastIndex = i + 2;
      const m = terminator.exec(text);
      if (!m) {
        err(i, `here-string is never closed (${single ? "'@" : '"@'} must start a line)`);
        return errors;
      }
      i = m.index + m[0].length;
      continue;
    }
    // Single-quoted string: '' escapes a quote; nothing else is special.
    if (SINGLE_QUOTES.has(c)) {
      let j = i + 1;
      for (;;) {
        if (j >= n) {
          err(i, "The string is missing the terminator: '");
          return errors;
        }
        const d = text[j] as string;
        if (SINGLE_QUOTES.has(d)) {
          if (SINGLE_QUOTES.has(text[j + 1] ?? '')) {
            j += 2;
            continue;
          }
          break;
        }
        j += 1;
      }
      i = j + 1;
      continue;
    }
    // Double-quoted string: `" and "" escape a quote; $( ) may nest braces/quotes but a subexpression
    // inside a string is rare in these scripts and is skipped as text.
    if (DOUBLE_QUOTES.has(c)) {
      let j = i + 1;
      for (;;) {
        if (j >= n) {
          err(i, 'The string is missing the terminator: "');
          return errors;
        }
        const d = text[j] as string;
        if (d === '`') {
          j += 2;
          continue;
        }
        if (DOUBLE_QUOTES.has(d)) {
          if (DOUBLE_QUOTES.has(text[j + 1] ?? '')) {
            j += 2;
            continue;
          }
          break;
        }
        j += 1;
      }
      i = j + 1;
      continue;
    }
    // Backtick outside a string escapes the next character (a line continuation, mostly).
    if (c === '`') {
      i += 2;
      continue;
    }
    if (c === '{' || c === '(' || c === '[') {
      stack.push({ ch: c, index: i });
    } else if (c === '}' || c === ')' || c === ']') {
      const open = c === '}' ? '{' : c === ')' ? '(' : '[';
      const top = stack.pop();
      if (!top || top.ch !== open) {
        err(i, `unexpected '${c}'`);
        return errors;
      }
    }
    i += 1;
  }

  for (const open of stack.reverse()) {
    err(open.index, open.ch === '{' ? "Missing closing '}' in statement block or type definition." : `'${open.ch}' is never closed`);
  }
  return errors;
}

/** Both rules. The ASCII rule first, because it is the one that was actually broken. */
export function lintPowerShell(text: string): LintResult {
  const errors = [...nonAscii(text), ...tokenizeErrors(text)];
  return errors.length ? { ok: false, errors } : { ok: true };
}

/**
 * What Windows PowerShell 5.1 sees when it opens these bytes without a BOM: the same bytes,
 * decoded as Windows-1252. Linting THIS view is what would have caught the defect before it
 * shipped, and is what the regression test exercises.
 */
export function ansiView(utf8: Uint8Array): string {
  // Decoded by hand, not by `TextDecoder('windows-1252')`: what that returns for 0x80-0x9F
  // depends on the Node build's ICU (Node 20 / ICU 76 gives C1 controls, Node 22 / ICU 78 the
  // cp1252 glyphs), which made this view - and the regression test over it - differ between
  // the CI runner and a developer's machine (26-Sep-2026). Bytes below 0x80 and from 0xA0 are
  // the same code point in both; only the 32 in between differ, and they are spelled out here.
  let out = '';
  for (const b of utf8) out += b >= 0x80 && b <= 0x9f ? (CP1252_HIGH[b] ?? String.fromCharCode(b)) : String.fromCharCode(b);
  return out;
}

/** Windows-1252, 0x80-0x9F, per the WHATWG index. The five undefined bytes map to themselves. */
const CP1252_HIGH: Record<number, string> = {
  0x80: '\u20ac', 0x82: '\u201a', 0x83: '\u0192', 0x84: '\u201e', 0x85: '\u2026', 0x86: '\u2020', 0x87: '\u2021',
  0x88: '\u02c6', 0x89: '\u2030', 0x8a: '\u0160', 0x8b: '\u2039', 0x8c: '\u0152', 0x8e: '\u017d',
  0x91: '\u2018', 0x92: '\u2019', 0x93: '\u201c', 0x94: '\u201d', 0x95: '\u2022', 0x96: '\u2013', 0x97: '\u2014',
  0x98: '\u02dc', 0x99: '\u2122', 0x9a: '\u0161', 0x9b: '\u203a', 0x9c: '\u0153', 0x9e: '\u017e', 0x9f: '\u0178',
};

export const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/**
 * Rule 2: CRLF for every script, and a BOM for PowerShell ONLY.
 *
 * `cmd.exe` does not understand a byte-order mark: the three bytes become part of the first line,
 * and `@echo off` fails as "'ï»¿@echo' is not recognized". So a `.cmd` (and the README) go out as
 * plain ASCII with CRLF, which every Windows reads one way, and only `.ps1` carries the mark.
 */
export function prepareForWindows(text: string, kind: 'ps1' | 'plain'): Buffer {
  const crlf = Buffer.from(text.replace(/\r?\n/g, '\r\n'), 'utf8');
  return kind === 'ps1' ? Buffer.concat([BOM, crlf]) : crlf;
}

export const formatErrors = (name: string, errors: LintError[]): string =>
  errors.map((e) => `${name}:${e.line}:${e.column} ${e.message}`).join('\n');
