import type { BillStatus, FoodType, KotStatus, TableState } from '@/lib/status';

/**
 * The shapes the application works in.
 *
 * These are deliberately NOT generated from the database. Generated row types describe storage;
 * these describe the five identifiers, the rounds and the totals that every screen was designed
 * around. Keeping them separate is what lets `bill_table` be a join table in Postgres and a
 * plain `tables: string[]` here - the model rule ("a bill belongs to one or more tables") reads
 * the same in both, without every component learning the join.
 */

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  foodType: FoodType;
  category: string;
  categoryId: string;
  imageUrl: string;
  /** The dish's own printer (item 25). Null: the category's printer, or the default. */
  printerId: string | null;
  /** The dish's own station (item 26). Null: the station its printer is at, or the default. */
  station: string | null;
  /** False when a captain has switched it off, or a dated closure is still running. */
  available: boolean;
  closedReason: string;
  closedUntil: string | null;
  sort: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  sort: number;
  count: number;
}

export interface KotItem {
  id: string;
  name: string;
  unitPrice: number;
  qty: number;
  foodType: FoodType;
  qtyBefore: number | null;
  cancelledAt: string | null;
  cancelReason: string;
  /**
   * The menu category the dish was in WHEN THE ROUND WAS PLACED, snapshotted by `placeRound`
   * into `kot_item.menu_category_name`.
   *
   * Snapshot rather than joined, for the same reason the name and the price are: a category
   * renamed or deleted next month must not rewrite what last month sold. Empty on rounds
   * placed before the column existed, which the report shows as Uncategorised rather than
   * dropping the line - a sale that happened is not a sale that can be hidden.
   */
  category: string;
}

export interface Kot {
  id: string;
  code: string;
  status: KotStatus;
  /** guest | captain | owner - Standard 6.4, and it cannot be reconstructed later. */
  source: 'guest' | 'captain' | 'owner';
  placedBy: string;
  /** The table this round came from. On a group bill this is what tells the runner where to go. */
  tableName: string;
  note: string;
  /**
   * The pessimistic aggregate over this round's live print jobs — failed if any failed, printed
   * only once every one of them has. One badge for what may be several tickets.
   */
  printStatus: PrintJobStatus;
  printAttempts: number;
  reprintCount: number;
  /** One per machine this round is being printed at. Empty for a round placed before Phase 1. */
  printJobs: KotPrintJob[];
  createdAt: string;
  startedAt: string | null;
  readyAt: string | null;
  pickedUpAt: string | null;
  servedAt: string | null;
  items: KotItem[];
}

/**
 * The five identifiers, in the order they appear on every screen that touches an order and on
 * the printed ticket. Standard 6.3 - a stable spine means never hunting for the same reference
 * twice.
 */
export interface IdentitySpine {
  captain: string;
  table: string;
  bill: string;
  waiter: string;
  kot: string;
}

export interface Bill {
  id: string;
  code: string;
  status: BillStatus;
  /** Every table on this bill. One entry for an ordinary table; several for a group. */
  tables: string[];
  hostTable: string;
  groupCode: string | null;
  guests: number;
  captain: string;
  captainId: string | null;
  waiter: string;
  waiterId: string | null;
  occasion: { type: string; name: string; source: string } | null;
  discountPct: number;
  discountAmount: number;
  discountBy: string | null;
  taxRate: number;
  tip: number;
  paymentMode: string | null;
  paymentReference: string;
  paymentRequestedAt: string | null;
  closedAt: string | null;
  closedBy: string | null;
  openedAt: string;
  kots: Kot[];
}

export interface FloorTable {
  id: string;
  name: string;
  zone: string;
  seats: number;
  active: boolean;
  state: TableState;
  billId: string | null;
  billCode: string | null;
  groupCode: string | null;
  guests: number;
  captain: string;
  waiter: string;
  roundCount: number;
  readyCount: number;
  openRequests: number;
  hasOccasion: boolean;
  total: number;
  /** Phones still attached to this table. A cart nobody sent still counts as one. */
  phonesAttached: number;
  /** Released by a closure and not yet reset. Null once somebody marks it cleared. */
  clearing: { releasedAtIso: string; billCode: string; guests: number; waitedMinutes: number } | null;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  initials: string;
  mobile: string;
  active: boolean;
  onDuty: boolean;
  hasPin: boolean;
  standingTables: string[];
  liveTables: string[];
  /**
   * The employment record the HR documents merge from.
   *
   * Carried on the same row as the operational fields because it IS the same person, and a
   * second table keyed by staff_id would be a join that exists only to separate two kinds of
   * fact about one employee. What separates them is the permission: `staff.paperwork`, not
   * `staff.create`.
   *
   * Every field here starts empty and stays empty until somebody fills it. That is the design's
   * rule working — anything unfilled prints as a marked placeholder — not missing data.
   */
  employment: {
    employeeCode: string;
    designation: string;
    department: string;
    joinedOn: string;
    lastWorkingDay: string;
    gender: string;
    employmentType: string;
    monthlySalary: number | null;
    reportsTo: string;
    shift: string;
    email: string;
    homeAddress: string;
    pan: string;
    uan: string;
    /** Four digits, or ''. A payslip prints `XXXX XXXX 5093` and needs nothing more. */
    bankLast4: string;
  };
}

export interface TableRequest {
  id: string;
  kind: string;
  note: string;
  tableName: string;
  tableId: string;
  billCode: string | null;
  captain: string;
  createdAt: string;
  ageMinutes: number;
}

export interface Suggestion {
  id: string;
  body: string;
  tableName: string | null;
  createdAt: string;
  reply: string;
  repliedAt: string | null;
  repliedBy: string;
}

export interface AuditRow {
  id: number;
  at: string;
  action: string;
  detail: string;
  where: string;
  by: string;
  confidential: boolean;
}

export interface TipRow {
  id: string;
  billCode: string;
  tableName: string;
  amount: number;
  staffId: string | null;
  staffName: string;
  settledAt: string | null;
  createdAt: string;
}

export interface ExpenseRow {
  id: string;
  spentOn: string;
  category: string;
  note: string;
  amount: number;
  enteredBy: string;
}

export interface PrinterRow {
  id: string;
  machineId: string;
  name: string;
  purpose: string;
  /** Where in the building. What a fallback ticket is stamped with. */
  station: string;
  paperMm: number;
  /** Menu category NAMES this machine claims. Empty means "everything nobody else claims". */
  routes: string[];
  chefs: string[];
  connection: string;
  address: string;
  port: number;
  /**
   * `online` is whether it answered — a fault, and the fallback exists for it.
   * `enabled` is whether the owner wants it used — a decision. They are never the same word
   * on screen, because only one of them needs somebody to walk into the kitchen.
   */
  online: boolean;
  enabled: boolean;
  lastSeenAt: string | null;
  /** `printer.created_at` - when it was added to Jalsa. Never an update time (item 2, 25-Sep). */
  createdAt: string;
  /** When a bridge last reported a ticket PRINTED on it. Null when nothing has printed yet. */
  lastPrintedAt: string | null;
}

/**
 * Where a print job has got to.
 *
 * `processing` was added in Phase 2: a bridge has taken the job and the paper is imminent. It is
 * distinct from `queued` because a bridge that died mid-send has to be distinguishable from one
 * that never started — that difference is the whole job of the stale-claim sweeper.
 *
 * `printed` is still unwritable by anything on the ORDER path. Only a bridge report produces it,
 * and only for a job that bridge is holding.
 */
export type PrintJobStatus = 'queued' | 'processing' | 'printed' | 'failed';

/**
 * A print job's destination, as every screen that shows one needs it.
 *
 * THE PRINTER'S UUID IS PART OF THE SHAPE, and it was not before. A screen that knows only
 * `printerName` can show where a ticket went but cannot act on it — it cannot offer "retry on
 * THIS machine" or let an operator pick a different one, because it has nothing to name in the
 * request. Every retry therefore had to re-derive a target on the server, which is where the
 * reassignment bug lived.
 */
export interface PrintTarget {
  /** Null only when no machine could be assigned at all. */
  printerId: string | null;
  /** Snapshot taken when the job was created. Never re-joined. */
  printerName: string;
  /** The station the ticket is STAMPED for, which on a fallback is not the printer's own. */
  station: string;
  /** How the destination was decided. 'chosen' means a person did, via Print elsewhere. */
  routingRule: 'routed' | 'fallback' | 'unrouted' | 'none' | 'chosen' | '';
}

/**
 * One round's ticket, on the surfaces that show a KOT.
 *
 * A round can be several of these — one per machine — since a round spanning the tandoor and the
 * main kitchen is two pieces of paper in two rooms.
 */
export interface KotPrintJob extends PrintTarget {
  id: string;
  status: PrintJobStatus;
  attempts: number;
  isReprint: boolean;
  lastError: string;
}

/** One row of the print-history trail: what the system tried to print, and what happened. */
export interface PrintJobRow extends PrintTarget {
  id: string;
  kind: string;
  /** KOT-0042 or B-1048 — the identifier a person would look for, never the job's uuid. */
  reference: string;
  table: string;
  status: PrintJobStatus;
  attempts: number;
  isReprint: boolean;
  requestedBy: string;
  lastError: string;
  createdAt: string;
  lastAttemptAt: string | null;
  /** Set when this job exists because an operator redirected another one. */
  redirectedFromJobId: string | null;
}

/** What the guest's phone is shown. Never the whole bill row - only what their screen needs. */
export interface GuestView {
  tableName: string;
  tableId: string;
  restaurantName: string;
  bill: Bill | null;
  captain: string;
  waiter: string;
}

export type { BillStatus, FoodType, KotStatus, TableState };

/**
 * The two columns on `bill` that name a person — by their REAL names.
 *
 * Exported, and named as data rather than written inline, for one reason: the first version of
 * this guessed `captain_id` / `waiter_id` and would have thrown on every single use. A column
 * name is a string by the time PostgREST sees it, so `tsc` cannot check it, the build cannot
 * check it, and lint cannot check it — nothing in the pipeline was ever going to catch it.
 * Pulled out here so `tests/unit/schema-columns.unit.spec.ts` can check it against the schema
 * migration, which is the only thing that actually knows.
 */
export const BILL_STAFF_COLUMN = {
  captain: 'captain_staff_id',
  waiter: 'waiter_staff_id',
} as const;

/**
 * A party in the entrance queue. Only the WAITING ones are ever returned by `listWaitlist`;
 * seated and removed rows stay in the table for the wait-time report.
 */
export interface WaitlistRow {
  id: string;
  /** The token called across the room — W-18. */
  token: string;
  /** The spoken handle, because 4821 and 4831 sound identical over a full dining room. */
  pair: string;
  /** Four digits the guest reads back. Not a secret, and not derived from the id. */
  code: string;
  partySize: number;
  phone: string;
  /** How they joined. Recorded at insert; it cannot be reconstructed later. */
  source: 'scanned' | 'walk_in';
  joinedAtIso: string;
  /** Computed on the SERVER so every surface agrees how long this party has been standing. */
  waitedMinutes: number;
  notified: boolean;
}

/** One waiting party's own view of the queue — what pattern 6b and 6c draw. */
export interface QueueSelfView {
  id: string;
  token: string;
  code: string;
  partySize: number;
  joinedAtIso: string;
  /** Parties still waiting who joined earlier. 0 means next. */
  ahead: number;
  /** 1-based, so "2nd in line" is `position`. */
  position: number;
  /** Rounded to five minutes and shown with a tilde — an estimate, never a promise. */
  estimateMinutes: number;
  state: 'waiting' | 'ready' | 'seated' | 'left';
  /** Only once seated; the design's alert names the table. */
  tableName: string;
}

/** An owner's answer to something this table asked. Pattern 4f. */
export interface GuestReply {
  id: string;
  body: string;
  reply: string;
  repliedBy: string;
  repliedAtIso: string;
}

/**
 * A bridge, as the owner's console sees it (Gate 6).
 *
 * NOTE WHAT IS NOT HERE: the token, and the hash of the token. The token exists exactly once, in
 * the response to the call that issued it, and is never readable again — so a compromised console
 * session cannot harvest working credentials for the PCs in the building, only revoke them.
 */
export interface BridgeTokenRow {
  id: string;
  /** What a person calls the PC. This is what lands in `print_job.claimed_by`. */
  label: string;
  createdAt: string;
  /** When this bridge last called the API. Null means it has never connected. */
  lastSeenAt: string | null;
  revokedAt: string | null;
  /**
   * When this bridge last TOOK a ticket (`print_job.claimed_at` under its label). Distinct from
   * `lastSeenAt`, which moves on every idle poll - showing that as "Last collected" put a time on
   * screen at which nobody had printed anything (item 12, 25-Sep-2026).
   */
  lastTicketAt: string | null;
}

/**
 * A printing computer, as the owner's Printers screen sees it (23-Sep-2026).
 *
 * The same row as `BridgeTokenRow`, seen from the other side: what the PC reported about itself
 * and what Windows shows it. Never the token and never its hash.
 */
export interface PrintComputerRow {
  id: string;
  label: string;
  /** 'paired' came from a pairing code; 'manual' was issued by hand under Print setup → Bridges. */
  source: 'manual' | 'paired';
  /** The PC's own Windows name, as the bridge reported it. Empty for a hand-issued token. */
  hostname: string;
  bridgeVersion: string;
  lastSeenAt: string | null;
  createdAt: string;
  /** What `Get-Printer` found on it at the last sync — a snapshot, never typed by a person. */
  discovered: DiscoveredPrinterRow[];
}

export interface DiscoveredPrinterRow {
  queueName: string;
  driverName: string;
  portName: string;
  status: 'ready' | 'offline' | 'error' | 'unknown';
  isVirtual: boolean;
  reportedAt: string;
}

/** Jalsa printer → the computer that reaches it, and the Windows queue on that computer. */
export interface PrinterMappingRow {
  printerId: string;
  computerId: string;
  queueName: string;
}
