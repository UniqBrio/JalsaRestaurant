/**
 * A `+` on every picker that can add, and a "Not listed?" hint before anything is typed
 * (30-Sep list, item 1: "Coming due to my favorite menu – Add + icon to type and add new").
 *
 * THE DEFECT
 *   The guest's "How did you hear about us?" box could always take a new answer, but only once
 *   something had been typed: the Add row appeared for a query that named nothing in the list, and
 *   not before. The closed box showed a chevron and the open list showed four fixed answers, so a
 *   guest who wanted to say "Coming due to my favourite menu" saw no way to. The capability was
 *   there; nothing on the screen said so.
 *
 * AND THE ONE THE REVIEW FOUND
 *   The box, the `+` and the chevron sit in the popover's Anchor, which Radix counts as OUTSIDE
 *   the list. A press on any of them dismissed the list on pointer-down and `close()` emptied the
 *   query before the click landed: type an answer, tap `+`, and nothing was added and the box was
 *   empty. Observed in a browser before the fix (TEST_SUMMARY.md).
 *
 * WHAT IS ASSERTED
 *   The rule, as the pure function `comboboxAddRow` the component renders from, and the markup
 *   as source text, element by element. Pointer and focus behaviour needs the component mounted;
 *   the browser check this change was verified with is in TEST_SUMMARY.md.
 *
 * FAIL-FIRST: run against the pre-fix `src/` — recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import * as combobox from '../../src/components/ui/combobox';
import type { ComboboxOption } from '../../src/components/ui/combobox';

const SOURCES: ComboboxOption[] = ['Google review', 'Friend recommended', 'Ordered earlier', 'Regular customer'].map(
  (v) => ({ value: v, label: v })
);

/* Looked up rather than imported by name, so that against the pre-fix tree — where it does not
   exist — each case fails on its own assertion instead of the whole file failing to load. */
const addRow = (options: readonly ComboboxOption[], query: string, allowCreate: boolean): unknown => {
  const fn = (combobox as Record<string, unknown>).comboboxAddRow;
  expect(typeof fn, 'comboboxAddRow is exported').toBe('function');
  return (fn as (o: readonly ComboboxOption[], q: string, a: boolean) => unknown)(options, query, allowCreate);
};

/** Source with comments removed, so a sentence in a comment can never satisfy an assertion. */
const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const SRC = code('src/components/ui/combobox.tsx');

/** The whole JSX element carrying `marker`, from its opening tag to its matching close. */
function elementWith(src: string, marker: string): { el: string; start: number } {
  const at = src.indexOf(marker);
  expect(at, `${marker} is in the component`).toBeGreaterThan(-1);
  // The tag whose attributes the marker sits among: the last `<tag` with no `<` after it.
  const open = src.slice(0, at).match(/<([a-zA-Z.]+)[^<]*$/);
  expect(open, `an opening tag precedes ${marker}`).not.toBeNull();
  const tag = open![1]!;
  const from = src.lastIndexOf(`<${tag}`, at);
  const close = src.indexOf(`</${tag}>`, at);
  expect(close, `</${tag}> closes it`).toBeGreaterThan(-1);
  return { el: src.slice(from, close + tag.length + 3), start: from };
}

/** The condition the element is rendered under: the nearest `{... ? (` before it. */
function conditionOf(src: string, start: number): string {
  const before = src.slice(0, start);
  const m = before.match(/\{([^{}]*?)\s\?\s\(\s*$/);
  return m ? m[1]!.trim() : '';
}

test('nothing typed on a data-entry field: the list invites a new one', () => {
  expect(addRow(SOURCES, '', true)).toEqual({ kind: 'invite' });
  expect(addRow(SOURCES, '   ', true), 'whitespace is not a name').toEqual({ kind: 'invite' });
  expect(addRow([], '', true), 'an empty list still invites').toEqual({ kind: 'invite' });
});

test("the requester's own words become the Add row, trimmed", () => {
  expect(addRow(SOURCES, '  Coming due to my favorite menu ', true)).toEqual({
    kind: 'add',
    name: 'Coming due to my favorite menu',
  });
});

test('an answer already in the list offers no Add row, whatever its case', () => {
  expect(addRow(SOURCES, 'google review', true)).toBeNull();
  expect(addRow(SOURCES, ' Regular customer ', true)).toBeNull();
});

test('a search-only picker offers nothing to add, typed or not', () => {
  expect(addRow(SOURCES, '', false)).toBeNull();
  expect(addRow(SOURCES, 'Something new', false)).toBeNull();
});

test('the + is rendered only on a field that can create, and is a +', () => {
  const { el, start } = elementWith(SRC, 'data-testid={`${testId}-add`}');
  expect(conditionOf(SRC, start), 'its enclosing condition').toBe('showPlus');
  expect(SRC).toMatch(/const creatable = allowCreate && onCreate !== undefined;/);
  // Only on a field that can create; and on such a field, whenever there is something to add
  // into - an empty box or an open list - so a closed box keeps its width for its choice.
  expect(SRC).toMatch(/const showPlus = creatable && \(open \|\| !selected\);/);
  expect(SRC).toContain("showPlus ? 'pr-[4.75rem]' : 'pr-10'");
  expect(el).toMatch(/<span[^>]*>\s*\+\s*<\/span>/);
  expect(el).toContain('aria-label="Add a new one"');
});

test('the + adds what has been typed, and otherwise opens the list to type', () => {
  const { el } = elementWith(SRC, 'data-testid={`${testId}-add`}');
  expect(el, 'with something new typed, it creates').toMatch(/if \(open && canCreate\) return void create\(\);/);
  expect(el, 'otherwise it opens').toMatch(/setOpen\(true\);\s*inputRef\.current\?\.focus\(\);/);
});

test('a press on the box, the + or the chevron is not a press outside the list', () => {
  const { el } = elementWith(SRC, 'onInteractOutside=');
  expect(el, 'on the popover content').toMatch(/^<PopoverPrimitive\.Content/);
  expect(el).toMatch(/onInteractOutside=\{\(e\) => \{\s*if \(anchorRef\.current\?\.contains\(e\.target as Node\)\) e\.preventDefault\(\);/);
  expect(SRC, 'the anchor carries the ref').toMatch(/<PopoverPrimitive\.Anchor asChild>\s*<div ref=\{anchorRef\}/);
  // With the chevron no longer dismissed from outside, it must close through `close()` itself,
  // so an open list still closes and still drops its query.
  const chevron = elementWith(SRC, 'data-testid={`${testId}-toggle`}').el;
  expect(chevron).toMatch(/if \(open\) return close\(\);/);
});

test('the hint shows only before anything is typed, never while loading, and describes the box', () => {
  expect(SRC).toMatch(/const inviting = open && !loading && addRow\?\.kind === 'invite';/);
  const { el, start } = elementWith(SRC, 'data-testid={`${testId}-add-hint`}');
  expect(conditionOf(SRC, start)).toBe('inviting');
  expect(el, 'not an option').not.toContain('role=');
  expect(el, 'not a button').not.toMatch(/^<button/);
  expect(el).toContain('id={hintId}');
  expect(el).toContain('{addHint}');
  expect(el).toContain('onPointerDown={(e) => e.preventDefault()}');
  expect(el).toContain('onMouseDown={(e) => e.preventDefault()}');
  expect(SRC, 'the box is described by it').toContain("{...(inviting ? { 'aria-describedby': hintId } : {})}");
  // Outside the listbox: after the list closes, inside the popover content.
  expect(start).toBeGreaterThan(SRC.lastIndexOf('</ul>'));
  expect(start).toBeLessThan(SRC.indexOf('</PopoverPrimitive.Content>'));
});

test('the empty label gives way to the hint, and only to the hint', () => {
  expect(SRC).toContain("{rows === 0 && addRow?.kind !== 'invite' ? (");
});

test('rows inside the list keep the design\'s ⊕', () => {
  const { el } = elementWith(SRC, 'data-testid={`${testId}-create`}');
  expect(el).toContain('<span aria-hidden>⊕</span>');
  expect(elementWith(SRC, 'data-testid={`${testId}-add-hint`}').el).toContain('⊕');
});

test('the owner hint names the thing; the guest is answering, so theirs says so', () => {
  expect(SRC).toContain("addHint = 'Not listed? Type the name to add it.',");
  const welcome = code('src/features/guest/GuestOrdering.tsx');
  const at = welcome.indexOf('testId="guest-heard"');
  const field = welcome.slice(at, welcome.indexOf('/>', at));
  expect(field).toContain('addHint="Not listed? Type your own answer."');
  expect(field, 'still a data-entry field, so it gets the +').toContain('allowCreate');
  expect(field).toContain('onCreate=');
});
