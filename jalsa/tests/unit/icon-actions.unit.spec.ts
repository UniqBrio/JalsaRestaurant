/**
 * Edit and Delete are icons only, across the app (13-Oct-2026).
 *
 * "Replace the edit and delete button with text with only edit and delete icon across app." The
 * one way is `IconAction` (src/components/ui/icon-action.tsx, canonical pattern JP-24). This file
 * READS every component with the TypeScript parser - not a regex over text, which a line break
 * inside the JSX defeats - and refuses any button, chip or link whose words begin with "Edit" or
 * "Delete": its text, nested text, and string literals in its expressions (widened 13-Oct-2026,
 * code review: the first scan saw only a bare "Edit"/"Delete" text child).
 *
 * The buttons that CARRY OUT a delete are not openers and keep their words: a ConfirmDialog's
 * `confirmLabel` is a prop, not a child text, so this scan does not see it by construction.
 *
 * FAIL-FIRST: recorded in the root TEST_SUMMARY.md (13-Oct-2026), run against `src/` before the change.
 */
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const APP = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(`${APP}${rel}`, 'utf8');

const walk = (dir: string): string[] =>
  readdirSync(`${APP}${dir}`).flatMap((f) => {
    const p = `${dir}/${f}`;
    return statSync(`${APP}${p}`).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });

/** What a person taps to open an edit or a delete: a button, a chip, a link. */
const OPENERS = new Set(['Button', 'button', 'Chip', 'Link', 'a']);

interface Found {
  /** Every JSX element the parse produced - the proof the parser read something. */
  elements: number;
  /** An opener whose words start with Edit or Delete: `file:line words`. */
  wordButtons: string[];
  /** `<IconAction kind=...>` uses. */
  iconActions: Array<{ file: string; kind: string }>;
}

function scan(files: string[], text: (file: string) => string = read): Found {
  const found: Found = { elements: 0, wordButtons: [], iconActions: [] };
  for (const file of files) {
    const src = ts.createSourceFile(file, text(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node)) {
        found.elements += 1;
        const tag = node.openingElement.tagName.getText(src);
        if (OPENERS.has(tag)) {
          // Every word the element shows: its text, nested elements' text, and string literals in
          // its expressions - `{'Delete'}`, `{isNew ? 'Add' : 'Edit'}` - but not its attributes.
          const words: string[] = [];
          const collect = (n: ts.Node) => {
            if (ts.isJsxAttributes(n)) return;
            if (ts.isJsxText(n)) words.push(n.getText(src).trim());
            else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) words.push(n.text.trim());
            ts.forEachChild(n, collect);
          };
          node.children.forEach(collect);
          const hit = words.find((w) => /^(Edit|Delete)\b/.test(w));
          if (hit) {
            const { line } = src.getLineAndCharacterOfPosition(node.getStart(src));
            found.wordButtons.push(`${file}:${line + 1} ${hit}`);
          }
        }
      }
      if (ts.isJsxSelfClosingElement(node)) {
        found.elements += 1;
        if (node.tagName.getText(src) === 'IconAction') {
          const kind = node.attributes.properties
            .filter(ts.isJsxAttribute)
            .find((a) => a.name.getText(src) === 'kind');
          const value = kind?.initializer && ts.isStringLiteral(kind.initializer) ? kind.initializer.text : '?';
          found.iconActions.push({ file, kind: value });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(src);
  }
  return found;
}

const FILES = walk('src');
const FOUND = scan(FILES);

test('the scan read the application - files, elements and the icon buttons themselves', () => {
  // A scan that parsed nothing would pass the next test on an empty list (binding rule 3).
  expect(FILES.length).toBeGreaterThan(50);
  expect(FOUND.elements).toBeGreaterThan(1000);
  // And it sees an offender when there is one - the word on its own line, as Prettier writes it -
  // while a button with other words, and an IconAction, pass.
  const probe = scan(['probe.tsx'], () =>
    [
      'const a = <Button data-testid="x" onClick={go}>',
      '  Delete',
      '</Button>;',
      'const b = <button type="button">Edit</button>;',
      'const c = <Button data-testid="y">Edit details</Button>;',
      "const d = <Button data-testid=\"w\">{isNew ? 'Add' : 'Edit'}</Button>;",
      'const e = <Button data-testid="v"><span>Delete</span></Button>;',
      "const f = <Chip data-testid=\"u\">{'Delete'}</Chip>;",
      'const g = <Button data-testid="t" aria-label="Delete A5">Remove</Button>;',
      'const h = <IconAction kind="edit" label="Edit A5" data-testid="z" />;',
    ].join('\n')
  );
  expect(probe.wordButtons).toEqual([
    'probe.tsx:1 Delete',
    'probe.tsx:4 Edit',
    'probe.tsx:5 Edit details',
    'probe.tsx:6 Edit',
    'probe.tsx:7 Delete',
    'probe.tsx:8 Delete',
  ]);
  expect(probe.iconActions).toEqual([{ file: 'probe.tsx', kind: 'edit' }]);
});

test('no Edit or Delete opener anywhere in the application carries the word instead of the icon', () => {
  expect(FOUND.wordButtons).toEqual([]);
});

test('every Edit and Delete opener is the shared IconAction - menu, tables, staff, expenses, printers', () => {
  const at = (file: string, kind: string) =>
    FOUND.iconActions.filter((a) => a.file === `src/features/owner/sections/${file}` && a.kind === kind).length;
  // The menu row's Edit and Delete, and the Delete on the off-menu strip.
  expect(at('MenuSection.tsx', 'edit')).toBe(1);
  expect(at('MenuSection.tsx', 'delete')).toBe(2);
  // A table's Edit, and the Delete in its sheet.
  expect(at('SettingsSection.tsx', 'edit')).toBe(1);
  expect(at('SettingsSection.tsx', 'delete')).toBe(1);
  expect(at('StaffSection.tsx', 'edit')).toBe(1);
  expect(at('LedgersSection.tsx', 'edit')).toBe(1);
  expect(at('LedgersSection.tsx', 'delete')).toBe(1);
  expect(at('PrintersSection.tsx', 'delete')).toBe(1);
  // The printer row's Delete and the one in its Configure sheet.
  expect(at('PrintSetupSection.tsx', 'delete')).toBe(2);
  // Nothing invented a third kind.
  expect(FOUND.iconActions.every((a) => a.kind === 'edit' || a.kind === 'delete')).toBe(true);
});

test('IconAction keeps the word as the name and tooltip, draws Lucide at the design stroke, and stays 44px', () => {
  const ui = read('src/components/ui/icon-action.tsx');
  expect(ui).toContain("import { Pencil, Trash2 } from 'lucide-react';");
  expect(ui).toContain('aria-label={label}');
  expect(ui).toContain('title={title ?? label}');
  expect(ui).toContain('strokeWidth={2.75}');
  expect(ui).toContain('size="icon"');
  // Button's icon size is the 44px floor.
  expect(read('src/components/ui/button.tsx')).toContain("icon: 'min-h-11 min-w-11 p-0 type-button',");
});

test('the off-menu strip deletes with the same confirmation as the table, under the edit grant', () => {
  const ui = read('src/features/owner/sections/MenuSection.tsx');
  expect(ui).toContain('data-testid={`owner-off-delete-${m.id}`}');
  // One delete path: both openers fill the same `deleting` state the one ConfirmDialog reads.
  expect(ui.match(/setDeleting\(\{ id: m\.id, name: m\.name, available: m\.available \}\)/g)?.length).toBe(2);
  expect(ui.match(/<ConfirmDialog/g)?.length).toBe(1);
  // The server already deletes a dish whatever its availability: no `available` filter on the delete.
  const del = read('src/lib/db/owner-mutations.ts');
  const body = del.slice(del.indexOf('export async function deleteMenuItem'), del.indexOf('export class MenuItemRefused'));
  expect(body).toMatch(/\.from\('menu_item'\)\s*\.delete\(\)/);
  expect(body).not.toContain('available');
});
