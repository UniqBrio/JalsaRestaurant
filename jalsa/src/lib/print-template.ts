import type { FoodType } from './status';

/**
 * print-template — a thermal ticket, composed as a character grid.
 *
 * WHY THIS IS A MODULE AND NOT A COMPONENT
 *   `Jalsa Print Setup.dc.html` states the rule the whole surface rests on: *"A thermal printer
 *   has no pixels — it has N character positions on this paper at this size."* Every control on
 *   that screen is a grid decision, not a styling one, and a grid decision produces a string. So
 *   the ticket is BUILT here, as an array of lines, and the screen's only job is to show the
 *   same strings a printer would receive.
 *
 *   That matters for one reason above all: **the preview and the paper must be the same thing**.
 *   A preview drawn with CSS would wrap on word boundaries the printer has never heard of, look
 *   correct at every width, and clip in the kitchen. Built here, what the owner reads in the
 *   preview pane is character-for-character the ticket, which is what makes the validation below
 *   worth anything.
 *
 * WHY 58 mm IS A SEPARATE LAYOUT AND NOT A SMALLER PICTURE
 *   The design is explicit: *"the two widths are separate layouts rather than one scaled
 *   picture"*. 80 mm at normal size is 48 characters; 58 mm is 32. An item line that fits the
 *   first does not shrink to fit the second — on a thermal printer an over-width line does not
 *   scale, **it disappears**. So the width is an input to every builder here, and
 *   `validateTemplate` refuses a configuration whose lines exceed it.
 *
 * NOTHING HERE TOUCHES THE DATABASE OR REACT.
 *   It is called from the owner's Print Setup screen (client) and would be called by a print
 *   worker (server) with identical results. That is the point of keeping it free of both.
 */

/* ── Paper ─────────────────────────────────────────────────────────────── */

export type PaperWidth = '58' | '80';
export type FontSize = 'small' | 'normal' | 'large';
export type TicketKind = 'kot' | 'bill';
export type Separator = 'dash' | 'equals' | 'dot';
export type Spacing = 'tight' | 'normal' | 'airy';
/** A = name left, quantity right · B = quantity first · C = name on its own line. */
export type ItemLayout = 'A' | 'B' | 'C';

export interface PaperSpec {
  /** The roll. */
  mm: number;
  /** What the head can actually mark — always a few mm narrower than the roll. */
  printable: number;
  /** Character positions across the printable area, per font size. */
  cols: Record<FontSize, number>;
}

export const PAPER: Record<PaperWidth, PaperSpec> = {
  '58': { mm: 58, printable: 48, cols: { small: 42, normal: 32, large: 21 } },
  '80': { mm: 80, printable: 72, cols: { small: 64, normal: 48, large: 32 } },
};

export const PAPER_WIDTHS: PaperWidth[] = ['58', '80'];

const SEPARATOR_CHAR: Record<Separator, string> = { dash: '-', equals: '=', dot: '.' };

/* ── The lines a ticket is made of ─────────────────────────────────────── */

/** `big` and `bold` are the printer's two emphasis modes. There is no third, and no colour. */
export type LineWeight = 'plain' | 'bold' | 'big';

export interface TicketLine {
  text: string;
  weight: LineWeight;
}

/* ── Which lines exist, and where they sit ─────────────────────────────── */

export interface FieldDef {
  key: string;
  label: string;
  /** The band it prints in. Reordering never moves a field out of its band. */
  band: 'Header' | 'Order' | 'Items' | 'Totals' | 'Footer';
  hint: string;
}

/**
 * The three fields that cannot be switched off, on either ticket.
 *
 * A KOT without a name and a quantity does not tell the kitchen what to cook; a bill without an
 * amount does not tell a guest what to pay. The design calls these "always on", and the toggle
 * refuses rather than silently ignoring the tap — a control that does nothing when pressed is
 * read as a broken screen, not as a rule.
 */
export const LOCKED_FIELDS = ['itemName', 'qty', 'amount', 'source'] as const;
/* `source` joined the locked fields on 24-Sep-2026 (C3): "every KOT must clearly identify its
   source - Captain, Owner or Guest phone". It exists only on the KOT, so the bill is unaffected. */

export const KOT_FIELDS: FieldDef[] = [
  { key: 'logo', label: 'Restaurant logo', band: 'Header', hint: 'prints as a block' },
  { key: 'name', label: 'Restaurant name', band: 'Header', hint: 'centred, bold' },
  { key: 'branch', label: 'Branch and address', band: 'Header', hint: '' },
  { key: 'phone', label: 'Phone', band: 'Header', hint: '' },
  { key: 'kot', label: 'KOT number', band: 'Order', hint: 'large' },
  { key: 'station', label: 'Station', band: 'Order', hint: 'where the round is cooked' },
  { key: 'order', label: 'Round number', band: 'Order', hint: '' },
  { key: 'table', label: 'Table', band: 'Order', hint: '' },
  { key: 'bill', label: 'Bill number', band: 'Order', hint: '' },
  { key: 'customer', label: 'Customer name', band: 'Order', hint: '' },
  { key: 'captain', label: 'Captain', band: 'Order', hint: '' },
  { key: 'source', label: 'Order source', band: 'Order', hint: 'always on' },
  { key: 'date', label: 'Date', band: 'Order', hint: '' },
  { key: 'time', label: 'Time', band: 'Order', hint: '' },
  { key: 'itemName', label: 'Item name', band: 'Items', hint: 'always on' },
  { key: 'qty', label: 'Quantity', band: 'Items', hint: 'always on' },
  { key: 'instr', label: 'Special instructions', band: 'Items', hint: '' },
  { key: 'cat', label: 'Item category', band: 'Items', hint: '' },
  { key: 'note', label: 'Round notes', band: 'Footer', hint: '' },
  { key: 'thanks', label: 'End-of-ticket line', band: 'Footer', hint: '' },
];

export const BILL_FIELDS: FieldDef[] = [
  { key: 'logo', label: 'Restaurant logo', band: 'Header', hint: '' },
  { key: 'name', label: 'Restaurant name', band: 'Header', hint: 'centred, bold' },
  { key: 'branch', label: 'Address', band: 'Header', hint: '' },
  { key: 'phone', label: 'Phone', band: 'Header', hint: '' },
  { key: 'gstin', label: 'GSTIN', band: 'Header', hint: '' },
  { key: 'bill', label: 'Bill number', band: 'Order', hint: '' },
  { key: 'table', label: 'Table', band: 'Order', hint: '' },
  { key: 'customer', label: 'Customer name', band: 'Order', hint: '' },
  { key: 'captain', label: 'Captain', band: 'Order', hint: '' },
  { key: 'date', label: 'Date', band: 'Order', hint: '' },
  { key: 'time', label: 'Time', band: 'Order', hint: '' },
  { key: 'itemName', label: 'Item name', band: 'Items', hint: 'always on' },
  { key: 'qty', label: 'Quantity', band: 'Items', hint: 'always on' },
  { key: 'rate', label: 'Rate', band: 'Items', hint: '' },
  { key: 'amount', label: 'Amount', band: 'Items', hint: 'always on' },
  { key: 'subtotal', label: 'Subtotal', band: 'Totals', hint: '' },
  { key: 'discount', label: 'Discount', band: 'Totals', hint: '' },
  { key: 'tax', label: 'CGST and SGST', band: 'Totals', hint: '' },
  { key: 'total', label: 'Total', band: 'Totals', hint: 'large, bold' },
  { key: 'payment', label: 'Payment mode', band: 'Totals', hint: '' },
  { key: 'qr', label: 'UPI QR block', band: 'Footer', hint: '' },
  { key: 'thanks', label: 'Thank you line', band: 'Footer', hint: '' },
];

export const fieldsFor = (kind: TicketKind): FieldDef[] => (kind === 'kot' ? KOT_FIELDS : BILL_FIELDS);

/* ── The configuration a template IS ───────────────────────────────────── */

export interface TemplateConfig {
  width: PaperWidth;
  font: FontSize;
  separator: Separator;
  spacing: Spacing;
  layout: ItemLayout;
  /** Group items under VEG / NON-VEG / EGG headings. KOT only — a guest's bill is one list. */
  group: boolean;
  /** Drop a group heading when no item in the round belongs to it. */
  hideEmpty: boolean;
  groupOrder: FoodType[];
  /** Field key → printed. A key absent from the map is treated as on. */
  on: Record<string, boolean>;
  /** Field keys, in print order. Keys absent from this list print in their declared order. */
  order: string[];
  /** What the head can mark, in mm. Defaults to the paper's own printable width. */
  printableMm: number;
  marginLeftMm: number;
  feedLines: number;
}

export const DEFAULT_OFF: Record<TicketKind, string[]> = {
  // A kitchen ticket is read standing up in a hurry: the logo, the source and the category are
  // true but not useful, and every line they cost is a line of food pushed down the paper.
  //
  // `station` IS DELIBERATELY ABSENT FROM THIS LIST (22-Sep-2026), so it prints by default.
  //   Routing already carried the station on every decision and every job for one stated reason:
  //   *"A tandoor ticket on the main kitchen machine has to say TANDOOR or the wrong cook picks
  //   it up."* It was never rendered, so a fallback ticket and a main-kitchen ticket were
  //   byte-identical. Shipping it switched off would leave the mechanism costing everything and
  //   delivering nothing. It is a visible change to every kitchen ticket and is recorded as one.
  kot: ['logo', 'order', 'customer', 'cat'],
  // A guest's bill omits the logo (it is the restaurant's own paper), the captain (named on the
  // tip line instead) and the per-unit rate (the amount is what is owed).
  bill: ['logo', 'captain', 'rate'],
};

export function defaultTemplate(kind: TicketKind, width: PaperWidth = '80'): TemplateConfig {
  const defs = fieldsFor(kind);
  const off = DEFAULT_OFF[kind];
  return {
    width,
    font: 'normal',
    separator: 'dash',
    spacing: 'normal',
    layout: 'A',
    group: kind === 'kot',
    hideEmpty: true,
    groupOrder: ['veg', 'non_veg', 'egg'],
    on: defs.reduce<Record<string, boolean>>((a, f) => ({ ...a, [f.key]: !off.includes(f.key) }), {}),
    order: defs.map((f) => f.key),
    printableMm: PAPER[width].printable,
    marginLeftMm: 4,
    feedLines: 3,
  };
}

export const columnsFor = (config: TemplateConfig): number => PAPER[config.width].cols[config.font];

/* ── The ticket's content ──────────────────────────────────────────────── */

export interface TicketItem {
  name: string;
  qty: number;
  foodType: FoodType;
  /** Unit price in whole rupees. Zero on a KOT, which carries no money. */
  rate: number;
  category: string;
  instruction: string;
}

export interface TicketData {
  restaurant: string;
  branch: string;
  phone: string;
  gstin: string;
  kotCode: string;
  /**
   * The station the round is MEANT for - never the station of the machine it comes out of.
   * On a fallback or a redirect those differ, and the one the cook needs is this one.
   */
  station: string;
  roundCode: string;
  billCode: string;
  table: string;
  customer: string;
  captain: string;
  date: string;
  time: string;
  source: string;
  note: string;
  items: TicketItem[];
  /** Bill only. Already computed by `money.ts` — this module never totals anything. */
  totals?: { subtotal: number; discount: number; tax: number; payable: number; paymentMode: string };
  upiId?: string;
}

export const GROUP_LABEL: Record<FoodType, string> = { veg: 'VEG', non_veg: 'NON-VEG', egg: 'EGG' };

/* ── The grid primitives ───────────────────────────────────────────────── */

/** Centre within `cols`, truncating rather than overflowing. A wider line would be lost. */
export function centre(text: string, cols: number): string {
  const s = String(text).slice(0, cols);
  return ' '.repeat(Math.max(0, Math.floor((cols - s.length) / 2))) + s;
}

/**
 * Left value, right value, the gap between them padded out to `cols`.
 *
 * When the two together already exceed the width there is no honest layout, so they are joined
 * by a single space and truncated. The right-hand value is the one that loses characters — it is
 * the quantity or the amount, and a clipped label is legible where a clipped figure is a lie.
 */
export function leftRight(left: string, right: string, cols: number): string {
  const l = String(left);
  const r = String(right);
  const gap = cols - l.length - r.length;
  if (gap < 1) return `${l} ${r}`.slice(0, cols);
  return l + ' '.repeat(gap) + r;
}

/** Wrap on spaces; a single word longer than the line is cut, because the paper cuts it. */
export function wrap(text: string, cols: number): string[] {
  const width = Math.max(1, cols);
  const out: string[] = [];
  let line = '';
  String(text)
    .split(/\s+/)
    .filter(Boolean)
    .forEach((word) => {
      if (!line.length) {
        line = word.slice(0, width);
        return;
      }
      if (`${line} ${word}`.length <= width) line += ` ${word}`;
      else {
        out.push(line);
        line = word.slice(0, width);
      }
    });
  if (line.length) out.push(line);
  return out.length ? out : [''];
}

export const separatorLine = (config: TemplateConfig, cols: number): string =>
  SEPARATOR_CHAR[config.separator].repeat(Math.max(0, cols));

/** `---- VEG ----`, padded to exactly `cols` so the band reads as a band. */
export function groupHeading(label: string, config: TemplateConfig, cols: number): string {
  const tag = ` ${label} `;
  const ch = SEPARATOR_CHAR[config.separator];
  const side = Math.max(1, Math.floor((cols - tag.length) / 2));
  let out = ch.repeat(side) + tag + ch.repeat(side);
  while (out.length < cols) out += ch;
  return out.slice(0, cols);
}

/**
 * One item, as the one to four lines it actually occupies.
 *
 * The three layouts are not decoration. A long dish name on 58 mm paper leaves so few characters
 * beside it that layout A ("Chicken Tandoori Half            1") wraps the name three times and
 * strands the quantity at the bottom; layout B puts the quantity first, where it survives.
 * Choosing between them is the owner's call, and `validateTemplate` tells them when A has stopped
 * working rather than letting the kitchen find out.
 */
export function itemLines(item: TicketItem, config: TemplateConfig, cols: number, withAmount: boolean): string[] {
  const qty = String(item.qty);
  const amount = withAmount ? String(item.qty * item.rate) : '';
  const out: string[] = [];

  if (config.layout === 'C') {
    wrap(item.name, cols).forEach((l) => out.push(l));
    out.push(withAmount ? leftRight(`  x${qty}`, amount, cols) : `  x${qty}`);
    return out;
  }

  if (config.layout === 'B') {
    const prefix = `${qty} x `;
    const nameCols = cols - prefix.length - (withAmount ? amount.length + 2 : 0);
    wrap(item.name, Math.max(6, nameCols)).forEach((l, i) => {
      if (i === 0) out.push(withAmount ? leftRight(prefix + l, amount, cols) : prefix + l);
      else out.push(' '.repeat(prefix.length) + l);
    });
    return out;
  }

  const right = withAmount ? `${qty}   ${amount}` : qty;
  const wrapped = wrap(item.name, Math.max(6, cols - right.length - 2));
  wrapped.forEach((l, i) => {
    if (i === wrapped.length - 1) out.push(leftRight(l, right, cols));
    else out.push(l);
  });
  return out;
}

/* ── The two tickets ───────────────────────────────────────────────────── */

// A locked field prints whatever a stored template says: the lock used to live only in the
// editor, so a template saved with one switched off (the live KOT had `source: false`) kept it
// off on paper while the screen called it "always on" (C3).
const isOn = (config: TemplateConfig, key: string): boolean =>
  (LOCKED_FIELDS as readonly string[]).includes(key) || config.on[key] !== false;

/**
 * Field keys in print order: the configured order first, then any key the configuration has
 * never heard of, in its declared position.
 *
 * The second half is what makes a stored template survive this file gaining a field. Without it,
 * every restaurant that had saved a template would silently stop printing the new line, and the
 * only symptom would be a ticket missing something nobody remembered adding.
 */
export function printOrder(config: TemplateConfig, kind: TicketKind): string[] {
  const declared = fieldsFor(kind).map((f) => f.key);
  const known = config.order.filter((k) => declared.includes(k));
  return [...known, ...declared.filter((k) => !known.includes(k))];
}

export function buildKot(data: TicketData, config: TemplateConfig, opts?: { reprint?: boolean }): TicketLine[] {
  const cols = columnsFor(config);
  const lines: TicketLine[] = [];
  const push = (text: string, weight: LineWeight = 'plain'): void => {
    lines.push({ text: text === '' ? ' ' : text, weight });
  };

  /**
   * THE ONE MARK THAT COSTS REAL FOOD IF IT IS MISSING.
   *
   * A reprinted kitchen ticket looks exactly like a new round. Without this band a cook reads
   * the same round twice and the table gets two of everything. It is printed before anything
   * else, at the largest size, and it is not configurable.
   */
  if (opts?.reprint) {
    push(centre('*** REPRINT ***', cols), 'big');
    push(separatorLine(config, cols));
  }

  printOrder(config, 'kot').forEach((key) => {
    if (!isOn(config, key)) return;
    switch (key) {
      case 'logo':
        push(centre(`[ ${data.restaurant.split(/\s+/)[0] ?? ''} ]`, cols), 'big');
        break;
      case 'name':
        push(centre(data.restaurant, cols), 'big');
        break;
      case 'branch':
        wrap(data.branch, cols).forEach((l) => push(centre(l, cols)));
        break;
      case 'phone':
        push(centre(data.phone, cols));
        break;
      case 'kot':
        push('');
        push(centre(data.kotCode, cols), 'big');
        push(separatorLine(config, cols));
        break;
      case 'station':
        // Skipped when empty, in the idiom `note` already uses: a blank STATION line costs a line
        // of paper and tells the kitchen nothing. Bold because the whole point of the field is
        // that it is noticed on a ticket that otherwise looks like every other ticket - bold is
        // an existing weight in this vocabulary, not a new one.
        if (!data.station) break;
        push(leftRight('STATION', data.station, cols), 'bold');
        break;
      case 'order':
        push(leftRight('ROUND', data.roundCode, cols));
        break;
      case 'table':
        push(leftRight('TABLE', data.table, cols));
        break;
      case 'bill':
        push(leftRight('BILL NO', data.billCode, cols));
        break;
      case 'customer':
        push(leftRight('GUEST', data.customer, cols));
        break;
      case 'captain':
        push(leftRight('CAPTAIN', data.captain, cols));
        break;
      case 'source':
        push(leftRight('SOURCE', data.source, cols));
        break;
      case 'date':
        push(leftRight('DATE', data.date, cols));
        break;
      case 'time':
        push(leftRight('TIME', data.time, cols));
        break;
      case 'itemName': {
        const groups: Array<FoodType | 'all'> = config.group ? config.groupOrder : ['all'];
        groups.forEach((g) => {
          const items = g === 'all' ? data.items : data.items.filter((i) => i.foodType === g);
          if (!items.length && config.hideEmpty) return;
          if (config.group && g !== 'all') push(groupHeading(GROUP_LABEL[g], config, cols), 'bold');
          else push(separatorLine(config, cols));
          items.forEach((it) => {
            itemLines(it, config, cols, false).forEach((l) => push(l));
            if (isOn(config, 'cat') && it.category) wrap(`  (${it.category})`, cols).forEach((l) => push(l));
            if (isOn(config, 'instr') && it.instruction) wrap(`  * ${it.instruction}`, cols).forEach((l) => push(l));
          });
        });
        push(separatorLine(config, cols));
        break;
      }
      case 'note':
        if (!data.note) break;
        push('NOTES:');
        wrap(data.note, cols).forEach((l) => push(l));
        push(separatorLine(config, cols));
        break;
      case 'thanks':
        push(centre('-- END OF KOT --', cols));
        break;
      default:
        break;
    }
  });

  for (let i = 0; i < config.feedLines; i += 1) push('');
  return lines;
}

export function buildBill(data: TicketData, config: TemplateConfig): TicketLine[] {
  const cols = columnsFor(config);
  const t = data.totals ?? { subtotal: 0, discount: 0, tax: 0, payable: 0, paymentMode: '' };
  const lines: TicketLine[] = [];
  const push = (text: string, weight: LineWeight = 'plain'): void => {
    lines.push({ text: text === '' ? ' ' : text, weight });
  };

  printOrder(config, 'bill').forEach((key) => {
    if (!isOn(config, key)) return;
    switch (key) {
      case 'logo':
        push(centre(`[ ${data.restaurant.split(/\s+/)[0] ?? ''} ]`, cols), 'big');
        break;
      case 'name':
        push(centre(data.restaurant, cols), 'big');
        break;
      case 'branch':
        wrap(data.branch, cols).forEach((l) => push(centre(l, cols)));
        break;
      case 'phone':
        push(centre(data.phone, cols));
        break;
      case 'gstin':
        push(centre(`GSTIN ${data.gstin}`, cols));
        push(separatorLine(config, cols));
        break;
      case 'bill':
        push(leftRight('BILL NO', data.billCode, cols));
        break;
      case 'table':
        push(leftRight('TABLE', data.table, cols));
        break;
      case 'customer':
        push(leftRight('GUEST', data.customer, cols));
        break;
      case 'captain':
        push(leftRight('CAPTAIN', data.captain, cols));
        break;
      case 'date':
        push(leftRight('DATE', data.date, cols));
        break;
      case 'time':
        push(leftRight('TIME', data.time, cols));
        break;
      case 'itemName':
        push(separatorLine(config, cols));
        push(leftRight('ITEM', 'QTY   AMT', cols), 'bold');
        push(separatorLine(config, cols));
        data.items.forEach((it) => {
          itemLines(it, config, cols, true).forEach((l) => push(l));
          if (isOn(config, 'rate')) push(`  @ ${it.rate}`);
        });
        push(separatorLine(config, cols));
        break;
      case 'subtotal':
        push(leftRight('SUBTOTAL', String(t.subtotal), cols));
        break;
      case 'discount':
        // A discount of nothing is not a line. Printing "DISCOUNT 0" invites the question.
        if (t.discount > 0) push(leftRight('DISCOUNT', `-${t.discount}`, cols));
        break;
      case 'tax': {
        // GST is levied as one rate and PRINTED as two halves, because that is what the
        // return asks for. Splitting an odd number gives the paise to CGST, so the two
        // printed halves always add back to the tax `money.ts` computed.
        const cgst = Math.round((t.tax / 2) * 100) / 100;
        const sgst = Math.round((t.tax - cgst) * 100) / 100;
        push(leftRight('CGST', cgst.toFixed(2), cols));
        push(leftRight('SGST', sgst.toFixed(2), cols));
        break;
      }
      case 'total':
        push(separatorLine(config, cols));
        push(leftRight('TOTAL', String(t.payable), cols), 'big');
        push(separatorLine(config, cols));
        break;
      case 'payment':
        if (t.paymentMode) push(leftRight('PAID BY', t.paymentMode, cols));
        break;
      case 'qr':
        if (!data.upiId) break;
        push('');
        push(centre('[ UPI QR ]', cols));
        push(centre(data.upiId, cols));
        break;
      case 'thanks':
        push('');
        push(centre('THANK YOU', cols), 'big');
        break;
      default:
        break;
    }
  });

  for (let i = 0; i < config.feedLines; i += 1) push('');
  return lines;
}

export const buildTicket = (
  kind: TicketKind,
  data: TicketData,
  config: TemplateConfig,
  opts?: { reprint?: boolean }
): TicketLine[] => (kind === 'kot' ? buildKot(data, config, opts) : buildBill(data, config));

/* ── Validation ────────────────────────────────────────────────────────── */

export interface TemplateCheck {
  label: string;
  ok: boolean;
}

export interface TemplateVerdict {
  cols: number;
  lineCount: number;
  checks: TemplateCheck[];
  /** Every failed check, as one sentence each. Empty means the template may be saved. */
  failures: string[];
  canSave: boolean;
}

/**
 * Can this template be saved?
 *
 * THE ANSWER IS A VERDICT, NOT A WARNING. The design says validation *"blocks a save that would
 * print clipped"*, and it has to block rather than warn for the reason the failure note gives:
 * an over-width line does not shrink on a thermal printer, it disappears. A warning on a screen
 * that still saves means the first person to notice is a cook holding half a dish name.
 *
 * The checks run against the ticket THIS configuration actually produces, with this data — not
 * against the settings. A width and a font size are not wrong on their own; they are wrong when
 * the longest dish on the menu no longer fits beside its quantity.
 */
export function validateTemplate(kind: TicketKind, data: TicketData, config: TemplateConfig): TemplateVerdict {
  const cols = columnsFor(config);
  const lines = buildTicket(kind, data, config);
  const withAmount = kind === 'bill';

  const over = lines.filter((l) => l.text.length > cols);
  const bigOnNarrow = config.width === '58' && config.font === 'large';
  const crowded = data.items.some((it) => {
    if (config.layout !== 'A') return false;
    const right = withAmount ? `${it.qty}   ${it.qty * it.rate}` : String(it.qty);
    return wrap(it.name, Math.max(6, cols - right.length - 2)).length > 2;
  });
  const emphasisFits = lines.filter((l) => l.weight === 'big').every((l) => l.text.length <= cols);
  const printableFits = config.printableMm > 0 && config.printableMm <= PAPER[config.width].mm;

  const checks: TemplateCheck[] = [
    { label: `Every line fits ${cols} characters`, ok: over.length === 0 },
    { label: 'Long item names wrap without swallowing the quantity', ok: !crowded },
    { label: 'Header and total fit at the chosen size', ok: emphasisFits },
    { label: 'Font size is workable for this paper', ok: !bigOnNarrow },
    { label: 'Printable width is inside the paper width', ok: printableFits },
  ];

  const failures: string[] = [];
  if (over.length) failures.push(`${over.length} ${over.length === 1 ? 'line' : 'lines'} exceed ${cols} characters`);
  if (crowded) failures.push('long item names wrap more than twice');
  if (!emphasisFits) failures.push('a large line is wider than the paper');
  if (bigOnNarrow) failures.push(`large text on 58 mm leaves only ${cols} characters a line`);
  if (!printableFits) failures.push(`printable width must be between 1 mm and ${PAPER[config.width].mm} mm`);

  return { cols, lineCount: lines.length, checks, failures, canSave: failures.length === 0 };
}

/**
 * The smallest change that makes a failing template printable.
 *
 * Deliberately narrow. It moves the two settings that are wrong in a knowable direction — large
 * text on 58 mm paper, and layout A where the names no longer fit — and stops. It never edits
 * which FIELDS print: dropping a line to make the ticket fit is a decision about what the kitchen
 * is told, and the machine does not get to make it.
 */
export function autoFit(kind: TicketKind, data: TicketData, config: TemplateConfig): TemplateConfig {
  const verdict = validateTemplate(kind, data, config);
  if (verdict.canSave) return config;

  let next: TemplateConfig = { ...config };
  if (next.width === '58' && next.font === 'large') next = { ...next, font: 'normal' };
  if (!validateTemplate(kind, data, next).canSave && next.layout === 'A') next = { ...next, layout: 'B' };
  if (!validateTemplate(kind, data, next).canSave && next.font === 'normal') next = { ...next, font: 'small' };
  if (next.printableMm <= 0 || next.printableMm > PAPER[next.width].mm) {
    next = { ...next, printableMm: PAPER[next.width].printable };
  }
  return next;
}
