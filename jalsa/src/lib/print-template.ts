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
  /**
   * The printable width in head dots (8 dots/mm on a 203 dpi head: 72 mm = 576, 48 mm = 384).
   * The encoder sets the print area to exactly this, so the paper is used edge to edge of what
   * the head can mark and no wider (item 7, 25-Sep-2026).
   */
  dots: number;
  /** Character positions across the printable area, per font size. */
  cols: Record<FontSize, number>;
}

export const PAPER: Record<PaperWidth, PaperSpec> = {
  '58': { mm: 58, printable: 48, dots: 384, cols: { small: 42, normal: 32, large: 21 } },
  '80': { mm: 80, printable: 72, dots: 576, cols: { small: 64, normal: 48, large: 32 } },
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

/**
 * How many characters a `big` line holds.
 *
 * `big` is sent as GS ! 0x11 - double WIDTH and double height - so every character, spaces
 * included, takes two positions. Big lines used to be centred and padded against the full column
 * count, which on paper is twice as wide as the roll: "JALSA" centred on 58 mm became 13 doubled
 * spaces plus 10 doubled letters, 36 positions on a 32-position line, and wrapped (item 5,
 * 25-Sep-2026). Every big line is now laid out against half the columns.
 */
export const bigColsFor = (cols: number): number => Math.floor(cols / 2);

/* ── Row modes (item 14, 25-Sep-2026) ───────────────────────────────────── */

/**
 * Off - never printed. On - printed when it has a value (an empty line costs paper and tells
 * nobody anything). Always on - printed on every ticket, with "-" when the value is empty, so
 * the line is always in the same place for whoever reads the paper.
 *
 * The locked fields are always on and cannot be changed; see LOCKED_FIELDS.
 */
export type RowMode = 'off' | 'on' | 'always';
export const ROW_MODES: RowMode[] = ['off', 'on', 'always'];
export const ROW_MODE_LABEL: Record<RowMode, string> = { off: 'Off', on: 'On', always: 'Always on' };

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
  /**
   * Field key → row mode (item 14). Wins over `on` for any key it names; a template saved before
   * row modes existed has none, and reads exactly as it did: on → 'on', off → 'off'.
   */
  modes?: Record<string, RowMode>;
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
  //
  // `branch` and `phone` joined this list on 25-Sep-2026 (item 13): the restaurant's own address
  // and phone number on a ticket that never leaves the kitchen is two lines of paper the cook
  // does not read. Switchable back on per row.
  kot: ['logo', 'order', 'customer', 'cat', 'branch', 'phone'],
  // A guest's bill omits the logo (it is the restaurant's own paper) and the captain (named on the
  // tip line instead). The per-unit RATE prints by default since 25-Sep-2026 (item 4): it is a
  // column of the item table now, not a line of its own under every item.
  bill: ['logo', 'captain'],
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
    // No left margin of our own (item 7): the print area is set to the head's printable width,
    // which already has the hardware's own safe edge. A margin on top of that was padding.
    marginLeftMm: 0,
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
  totals?: {
    subtotal: number;
    discount: number;
    tax: number;
    payable: number;
    paymentMode: string;
    /** The bill's GST rate, so the two halves print their rate. Optional: older callers omit it. */
    taxRate?: number;
  };
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
export function rowMode(config: TemplateConfig, key: string): RowMode {
  if ((LOCKED_FIELDS as readonly string[]).includes(key)) return 'always';
  const mode = config.modes?.[key];
  if (mode === 'off' || mode === 'on' || mode === 'always') return mode;
  return config.on[key] === false ? 'off' : 'on';
}

const isOn = (config: TemplateConfig, key: string): boolean => rowMode(config, key) !== 'off';

/**
 * A labelled value row, honouring its row mode: skipped when off; skipped when empty and merely
 * on; printed with "-" when empty and always on.
 */
function valueRow(
  config: TemplateConfig,
  key: string,
  label: string,
  value: string,
  cols: number,
  push: (text: string, weight?: LineWeight) => void,
  weight: LineWeight = 'plain'
): void {
  const mode = rowMode(config, key);
  if (mode === 'off') return;
  const v = String(value ?? '').trim();
  if (!v && mode === 'on') return;
  push(leftRight(label, v || '-', cols), weight);
}

/** Big text, wrapped and centred on the half-width grid a doubled character actually has. */
function bigCentred(text: string, cols: number, push: (text: string, weight?: LineWeight) => void): void {
  const half = bigColsFor(cols);
  wrap(text, half).forEach((l) => push(centre(l, half), 'big'));
}

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
    bigCentred('*** REPRINT ***', cols, push);
    push(separatorLine(config, cols));
  }

  printOrder(config, 'kot').forEach((key) => {
    if (!isOn(config, key)) return;
    const always = rowMode(config, key) === 'always';
    switch (key) {
      case 'logo':
        bigCentred(`[ ${data.restaurant.split(/\s+/)[0] ?? ''} ]`, cols, push);
        break;
      case 'name':
        bigCentred(data.restaurant, cols, push);
        break;
      case 'branch':
        if (!data.branch && !always) break;
        wrap(data.branch || '-', cols).forEach((l) => push(centre(l, cols)));
        break;
      case 'phone':
        if (!data.phone && !always) break;
        push(centre(data.phone || '-', cols));
        break;
      case 'kot':
        push('');
        bigCentred(data.kotCode, cols, push);
        push(separatorLine(config, cols));
        break;
      case 'station':
        // Skipped when empty (unless always on): a blank STATION line costs a line of paper and
        // tells the kitchen nothing. Bold because the whole point of the field is that it is
        // noticed on a ticket that otherwise looks like every other ticket.
        valueRow(config, key, 'STATION', data.station, cols, push, 'bold');
        break;
      case 'order':
        valueRow(config, key, 'ROUND', data.roundCode, cols, push);
        break;
      case 'table':
        valueRow(config, key, 'TABLE', data.table, cols, push);
        break;
      case 'bill':
        valueRow(config, key, 'BILL NO', data.billCode, cols, push);
        break;
      case 'customer':
        valueRow(config, key, 'GUEST', data.customer, cols, push);
        break;
      case 'captain':
        valueRow(config, key, 'CAPTAIN', data.captain, cols, push);
        break;
      case 'source':
        valueRow(config, key, 'SOURCE', data.source, cols, push);
        break;
      case 'date':
        valueRow(config, key, 'DATE', data.date, cols, push);
        break;
      case 'time':
        valueRow(config, key, 'TIME', data.time, cols, push);
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
        if (!data.note && !always) break;
        push('NOTES:');
        wrap(data.note || '-', cols).forEach((l) => push(l));
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

/**
 * A whole-rupee amount with Indian digit grouping, in ASCII: 124750 -> "1,24,750".
 *
 * Spelled by hand rather than by `toLocaleString`, because this string is laid out on a fixed
 * grid and printed: a runtime whose ICU groups differently would move every amount on the bill.
 */
export function amountText(n: number): string {
  const neg = n < 0;
  const digits = String(Math.round(Math.abs(n)));
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${rest ? `${rest},` : ''}${last3}`;
}

/**
 * The bill's item table: ITEM | QTY | RATE | AMOUNT, fixed right-aligned columns.
 *
 * WHY FIXED COLUMNS (item 5, 25-Sep-2026). The old line was `name ... qty   amount`, padded as
 * one string, so a "12" quantity or a four-digit amount pushed everything left of it and no two
 * amounts lined up; the rate was a separate "@ 240" line under every item. Each figure now has a
 * column of its own width, right-aligned, so every amount ends in the same position as the
 * subtotal and total below it.
 */
export interface BillColumns {
  name: number;
  qty: number;
  rate: number;
  amount: number;
}

export function billColumns(cols: number, withRate: boolean): BillColumns {
  const narrow = cols < 40;
  const qty = 4;
  const rate = withRate ? (narrow ? 7 : 8) : 0;
  const amount = narrow ? 8 : 9;
  return { name: cols - qty - rate - amount, qty, rate, amount };
}

const rightIn = (text: string, width: number): string => (width <= 0 ? '' : String(text).slice(-width).padStart(width));

export function billItemLines(item: TicketItem, c: BillColumns): string[] {
  const names = wrap(item.name, Math.max(6, c.name - 1));
  const figures =
    rightIn(String(item.qty), c.qty) +
    (c.rate ? rightIn(amountText(item.rate), c.rate) : '') +
    rightIn(amountText(item.qty * item.rate), c.amount);
  return names.map((n, i) => (i === 0 ? n.padEnd(c.name) + figures : n));
}

export function buildBill(data: TicketData, config: TemplateConfig): TicketLine[] {
  const cols = columnsFor(config);
  const half = bigColsFor(cols);
  const t = data.totals ?? { subtotal: 0, discount: 0, tax: 0, payable: 0, paymentMode: '' };
  const lines: TicketLine[] = [];
  const push = (text: string, weight: LineWeight = 'plain'): void => {
    lines.push({ text: text === '' ? ' ' : text, weight });
  };
  const money = (n: number): string => amountText(n);

  printOrder(config, 'bill').forEach((key) => {
    if (!isOn(config, key)) return;
    const always = rowMode(config, key) === 'always';
    switch (key) {
      case 'logo':
        bigCentred(`[ ${data.restaurant.split(/\s+/)[0] ?? ''} ]`, cols, push);
        break;
      case 'name':
        bigCentred(data.restaurant, cols, push);
        break;
      case 'branch':
        if (!data.branch && !always) break;
        wrap(data.branch || '-', cols).forEach((l) => push(centre(l, cols)));
        break;
      case 'phone':
        if (!data.phone && !always) break;
        push(centre(data.phone || '-', cols));
        break;
      case 'gstin': {
        const g = data.gstin && data.gstin !== '—' ? data.gstin : '';
        if (!g && !always) break;
        push(centre(`GSTIN ${g || '-'}`, cols));
        break;
      }
      case 'bill':
        // The invoice band opens with its own rule and title, so the restaurant's header and the
        // invoice's facts read as two blocks rather than one run of centred text.
        push(separatorLine(config, cols));
        push(centre(data.gstin && data.gstin !== '—' ? 'TAX INVOICE' : 'INVOICE', cols), 'bold');
        valueRow(config, key, 'BILL NO', data.billCode, cols, push);
        break;
      case 'table':
        valueRow(config, key, 'TABLE', data.table, cols, push);
        break;
      case 'customer':
        valueRow(config, key, 'GUEST', data.customer, cols, push);
        break;
      case 'captain':
        valueRow(config, key, 'CAPTAIN', data.captain, cols, push);
        break;
      case 'date':
        valueRow(config, key, 'DATE', data.date, cols, push);
        break;
      case 'time':
        valueRow(config, key, 'TIME', data.time, cols, push);
        break;
      case 'itemName': {
        const c = billColumns(cols, isOn(config, 'rate'));
        push(separatorLine(config, cols));
        push(
          'ITEM'.padEnd(c.name) + rightIn('QTY', c.qty) + (c.rate ? rightIn('RATE', c.rate) : '') + rightIn('AMOUNT', c.amount),
          'bold'
        );
        push(separatorLine(config, cols));
        data.items.forEach((it) => billItemLines(it, c).forEach((l) => push(l)));
        push(separatorLine(config, cols));
        break;
      }
      case 'subtotal':
        push(leftRight('SUBTOTAL', money(t.subtotal), cols));
        break;
      case 'discount':
        // A discount of nothing is not a line, unless the owner asked for it always.
        if (t.discount > 0 || always) push(leftRight('DISCOUNT', t.discount > 0 ? `-${money(t.discount)}` : '0', cols));
        break;
      case 'tax': {
        // GST is levied as one rate and PRINTED as two halves, because that is what the
        // return asks for. Splitting an odd number gives the paise to CGST, so the two
        // printed halves always add back to the tax `money.ts` computed.
        const cgst = Math.round((t.tax / 2) * 100) / 100;
        const sgst = Math.round((t.tax - cgst) * 100) / 100;
        const rate = typeof t.taxRate === 'number' && t.taxRate > 0 ? ` @${t.taxRate / 2}%` : '';
        push(leftRight(`CGST${rate}`, cgst.toFixed(2), cols));
        push(leftRight(`SGST${rate}`, sgst.toFixed(2), cols));
        break;
      }
      case 'total':
        push(separatorLine(config, cols));
        // Big, so on the half-width grid a doubled character really has.
        push(leftRight('TOTAL', `Rs.${money(t.payable)}`, half), 'big');
        push(separatorLine(config, cols));
        break;
      case 'payment':
        if (t.paymentMode || always) push(leftRight('PAID BY', t.paymentMode || '-', cols));
        break;
      case 'qr':
        if (!data.upiId) break;
        push('');
        push(centre('[ UPI QR ]', cols));
        push(centre(data.upiId, cols));
        break;
      case 'thanks':
        push('');
        bigCentred('THANK YOU', cols, push);
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

  // A big line is measured against the half-width grid it actually prints on (item 5).
  const half = bigColsFor(cols);
  const over = lines.filter((l) => l.text.length > (l.weight === 'big' ? half : cols));
  const bigOnNarrow = config.width === '58' && config.font === 'large';
  const crowded = data.items.some((it) => {
    if (withAmount) {
      // The bill's item table: the name column is what is left beside QTY | RATE | AMOUNT.
      const c = billColumns(cols, isOn(config, 'rate'));
      return wrap(it.name, Math.max(6, c.name - 1)).length > 2;
    }
    if (config.layout !== 'A') return false;
    return wrap(it.name, Math.max(6, cols - String(it.qty).length - 2)).length > 2;
  });
  const emphasisFits = lines.filter((l) => l.weight === 'big').every((l) => l.text.length <= half);
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
