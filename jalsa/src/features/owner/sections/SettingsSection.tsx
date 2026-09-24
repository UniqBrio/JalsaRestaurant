'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/cn';
import { CHIP_NAV_WRAP, CHIP_NAV_STICKY_MD } from '@/lib/chip-nav';
import { Button } from '@/components/ui/button';
import { Card, Chip, Pill, SectionLabel } from '@/components/ui/atoms';
import { Field, Input, Select, Textarea, Toggle } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { rupees } from '@/lib/money';
import { DEFAULT_FEATURES, resolveFeatures } from '@/lib/guest-features';
import { PrintSetupSection } from './PrintSetupSection';
import { TableStandSheet } from '../TableStandSheet';
import type { OwnerSectionProps } from '../OwnerConsole';
import { readWelcomeDrinks } from '@/lib/welcome-drinks';

/**
 * Screen 33 — Settings, split into named sub-tabs rather than one long scroll.
 *
 * Standard 1.3: past about six independent cards, promote them to named sub-tabs. A nine-card
 * settings page has no landmarks, and people scroll hunting a heading they half remember.
 *
 * EVERY VALUE HERE IS CONFIGURATION BECAUSE THE ANSWER TO "would a customer have to ask us to
 * change this?" IS YES for all of them — the tax rate, the words a guest reads, which buttons
 * appear on their phone, how long a paid bill stays reachable. Baked into a build, each one is a
 * support ticket the day the business changes (Standard 2.x).
 */

type Panel =
  'hours' | 'identity' | 'tax' | 'invoice' | 'tables' | 'features' | 'copy' | 'replies' | 'engage' | 'printers';

const PANELS: Array<{ key: Panel; label: string; permission: string }> = [
  { key: 'hours', label: 'Opening hours', permission: 'set.hours' },
  { key: 'identity', label: 'Restaurant details', permission: 'set.identity' },
  { key: 'tax', label: 'Tax & GST', permission: 'set.tax' },
  { key: 'invoice', label: 'Invoice', permission: 'set.invoice' },
  { key: 'tables', label: 'Tables & QR', permission: 'set.tables' },
  { key: 'features', label: 'What the customer sees', permission: 'set.features' },
  { key: 'copy', label: 'Words the guest sees', permission: 'set.copy' },
  // The two the design set has and this console did not. Neither needed a schema change:
  // writeSetting already routed `replies` to set.copy and `engagement` to set.review, and
  // guest-view already READ engagement.reviewUrl and engagement.callNumber. The guest's Call
  // button and review link were therefore configurable by everything except a person.
  { key: 'replies', label: 'Replies to suggestions', permission: 'set.copy' },
  { key: 'engage', label: 'Customer engagement', permission: 'set.review' },
  // Five sections of its own — the design's "Printing and paperwork" surface, reached from
  // Settings where the flowchart's ten sub-sections put it.
  { key: 'printers', label: 'Printers & machines', permission: 'set.printer' },
];

export function SettingsSection(props: OwnerSectionProps) {
  const { data } = props;
  const allowed = PANELS.filter((p) => data.grants.includes(p.permission));
  const [panel, setPanel] = React.useState<Panel>(allowed[0]?.key ?? 'tables');

  return (
    <div className="flex flex-col gap-4" data-testid="owner-settings">
      {/* TEN DESTINATIONS, AND EVERY ONE OF THEM ON THE SCREEN.
          This was a `flex` row with no `flex-wrap`, inside `overflow-x: auto`, with the
          scrollbar hidden on both engines — so `Printers & machines`, the tenth and longest
          label, was present in the DOM and reachable only by a scroll gesture nothing on the
          screen suggested was available. A filter strip may scroll sideways; a NAVIGATION may
          not, because each chip is a different destination and one nobody can see is one
          nobody can reach. See `src/lib/chip-nav.ts`.
          AND IT STAYS PUT WHILE THE PAGE MOVES, from `md` up. Settings panels run to several
          screens, and a sub-navigation that has scrolled off the top is one the owner has to
          scroll BACK to before they can change their mind — so in practice they do not change
          their mind, they give up and scroll. `CHIP_NAV_STICKY_MD` pins it beneath the Owner
          header at `calc(7rem + 1px)`: the header's two rem-derived rows plus its own 1px
          `border-b`, which a first attempt forgot, tucking the row a pixel underneath it. The
          offset is a constant rather than a literal because
          `settings-sticky-subnav.render.spec.ts` measures the REAL header and asserts they
          agree — a spec carrying its own copy would measure the copy.

          BELOW `md` NOTHING CHANGES. The row stays in normal flow exactly as it shipped: pinning
          a ten-chip row on a 320x568 phone leaves 28px of content, measured. `z-20` is below the
          header's `z-30` and far below sheets (`z-50`) and toasts (`z-60`), so nothing overlays
          them. */}
      <nav className={cn(CHIP_NAV_WRAP, CHIP_NAV_STICKY_MD)} aria-label="Settings sections">
        {allowed.map((p) => (
          <Chip
            key={p.key}
            on={panel === p.key}
            onClick={() => setPanel(p.key)}
            data-testid={`owner-settings-${p.key}`}
          >
            {p.label}
          </Chip>
        ))}
      </nav>

      {panel === 'hours' ? <HoursPanel {...props} /> : null}
      {panel === 'identity' ? <IdentityPanel {...props} /> : null}
      {panel === 'tax' ? <TaxPanel {...props} /> : null}
      {panel === 'invoice' ? <InvoicePanel {...props} /> : null}
      {panel === 'tables' ? <TablesPanel {...props} /> : null}
      {panel === 'features' ? (
        <>
          <FeaturesPanel {...props} />
          <WelcomeDrinksPanel {...props} />
        </>
      ) : null}
      {panel === 'copy' ? <CopyPanel {...props} /> : null}
      {panel === 'replies' ? <RepliesPanel {...props} /> : null}
      {panel === 'engage' ? <EngagementPanel {...props} /> : null}
      {panel === 'printers' ? <PrintSetupSection {...props} /> : null}
    </div>
  );
}

/* ── Hours ─────────────────────────────────────────────────────────────── */

interface DayRow {
  day: string;
  open: string;
  close: string;
  shut: boolean;
}

function HoursPanel({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const stored = (data.settings.hours ?? {}) as {
    days?: DayRow[];
    breakOn?: boolean;
    breakFrom?: string;
    breakTo?: string;
    lastOrderMins?: number;
    note?: string;
  };
  const [days, setDays] = React.useState<DayRow[]>(stored.days ?? []);
  const [note, setNote] = React.useState(stored.note ?? '');
  const [lastOrder, setLastOrder] = React.useState(String(stored.lastOrderMins ?? 30));

  return (
    <Card className="flex flex-col gap-4">
      <SectionLabel>Seven day rows, a break window and the last-order rule</SectionLabel>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {days.map((d, i) => (
          <li key={d.day} className="flex flex-wrap items-center gap-2">
            <span className="w-24 type-body font-semibold">{d.day}</span>
            <Input
              type="time"
              value={d.open}
              disabled={d.shut}
              aria-label={`${d.day} opening time`}
              onChange={(e) => setDays(days.map((x, j) => (i === j ? { ...x, open: e.target.value } : x)))}
              data-testid={`owner-hours-open-${d.day}`}
              className="w-32"
            />
            <span className="type-caption text-[var(--text-muted)]">to</span>
            <Input
              type="time"
              value={d.close}
              disabled={d.shut}
              aria-label={`${d.day} closing time`}
              onChange={(e) => setDays(days.map((x, j) => (i === j ? { ...x, close: e.target.value } : x)))}
              data-testid={`owner-hours-close-${d.day}`}
              className="w-32"
            />
            <label className="flex min-h-11 items-center gap-2 type-caption">
              <input
                data-testid={`owner-hours-shut-${d.day}`}
                type="checkbox"
                checked={d.shut}
                onChange={(e) => setDays(days.map((x, j) => (i === j ? { ...x, shut: e.target.checked } : x)))}

                className="h-4 w-4 accent-[var(--primary)]"
              />
              Closed
            </label>
          </li>
        ))}
      </ul>

      <Field
        label="Last order"
        htmlFor="owner-last-order"
        hint="Minutes before closing that the menu stops accepting orders. The guest sees a closed menu, not a failed send."
      >
        <Input
          id="owner-last-order"
          type="number"
          inputMode="numeric"
          min={0}
          value={lastOrder}
          onChange={(e) => setLastOrder(e.target.value)}
          data-testid="owner-last-order"
          className="w-32"
        />
      </Field>

      <Field label="Note shown under the hours" htmlFor="owner-hours-note">
        <Textarea
          id="owner-hours-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          data-testid="owner-hours-note"
        />
      </Field>

      <Button
        data-testid="owner-hours-save"
        disabled={busy}
        className="self-start"
        onClick={() =>
          runBusy(async () => {
            await send('/api/owner/action', {
              action: 'write-setting',
              key: 'hours',
              value: { days, note, lastOrderMins: Number(lastOrder) || 0 },
            });
            toast.show('Opening hours saved — every guest phone reads these', { tone: 'success' });
          })
        }
      >
        Save hours
      </Button>
    </Card>
  );
}

/* ── Identity ──────────────────────────────────────────────────────────── */

/**
 * Restaurant details — the one identity block every screen and every printed document reads.
 *
 * WHAT CHANGED ON 18-Sep-2026, AND WHAT DID NOT
 *   Presentation only. The same ten fields, the same `form` state, the same `set()`, the same
 *   test ids, and the same one `write-identity` call carrying the same patch. `writeIdentity`
 *   sends `form` straight to `restaurant` as a column patch, so every key here IS a column —
 *   dropping one from this object would silently stop saving it. None was dropped.
 *
 * WHY IT IS NO LONGER ONE LONG FORM
 *   It was a desktop form: eleven controls in one card, three abreast, read top to bottom with
 *   no indication that "PAN" and "Who signs" answer completely different questions. On a phone
 *   that is a column of unlabelled boxes. Grouped into four cards, each with the heading that
 *   says what it is for, the page can be scanned rather than read.
 *
 * THE BRAND BLOCK IS NOT DECORATION
 *   It shows the badge that actually prints, above the name guests actually see — and the name
 *   is bound to the field below it, so an owner editing "Name guests see" watches the thing
 *   their customers will read change as they type. It borrows the customer welcome screen's
 *   composition and none of its content: no greeting, no table, no captain, no ordering.
 *
 * `--primary` / `--on-primary`, not a literal. That pair is maroon in the light theme and the
 * amber the owner console actually runs in the dark one, and the contrast gate measures both.
 */
function IdentityPanel({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const r = data.restaurant as Record<string, string>;
  const [form, setForm] = React.useState({
    legal_name: r.legal_name ?? '',
    display_name: r.display_name ?? '',
    address: r.address ?? '',
    email: r.email ?? '',
    phone: r.phone ?? '',
    signatory_name: r.signatory_name ?? '',
    signatory_role: r.signatory_role ?? '',
    fssai: r.fssai ?? '',
    pan: r.pan ?? '',
    hr_email: r.hr_email ?? '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  /* One column on a phone, two from `md` up. `minmax(0,1fr)` rather than `1fr`: a grid track's
     default min-width is auto, so a long unbroken value — an address line, an email — would
     otherwise widen its column and push the other one off the card. */
  const pair = 'grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]';

  return (
    <div className="flex flex-col gap-3" data-testid="owner-identity">
      {/* THE BRAND BLOCK */}
      <div className="flex items-center gap-4 rounded-[var(--radius-xl)] bg-[var(--primary)] px-5 py-6 text-[var(--on-primary)]">
        <Image
          src="/brand/jalsa-badge.png"
          alt="The Jalsa badge as it prints"
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-[var(--radius-lg)] bg-[var(--surface)] object-contain"
        />
        <div className="min-w-0">
          <p className="m-0 type-h3 leading-tight">{form.display_name || 'Your restaurant'}</p>
          <p className="m-0 mt-1 type-caption leading-relaxed opacity-85">
            What every screen and every printed document reads.
          </p>
        </div>
      </div>

      <Card className="flex flex-col gap-3">
        <SectionLabel>Restaurant identity</SectionLabel>
        <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
          These details appear on the bill, on offer letters and experience certificates, and in the header of the
          guest&rsquo;s phone. Changing them here changes them everywhere — nothing retypes them (Standard 2.2).
        </p>
        <div className={pair}>
          <Field label="Registered name" required htmlFor="owner-legal">
            <Input
              id="owner-legal"
              value={form.legal_name}
              onChange={set('legal_name')}
              data-testid="owner-legal-name"
            />
          </Field>
          <Field label="Name guests see" required htmlFor="owner-display">
            <Input
              id="owner-display"
              value={form.display_name}
              onChange={set('display_name')}
              data-testid="owner-display-name"
            />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionLabel>Contact &amp; location</SectionLabel>
        <Field label="Address" required htmlFor="owner-address">
          <Textarea id="owner-address" value={form.address} onChange={set('address')} data-testid="owner-address" />
        </Field>
        <div className={pair}>
          <Field label="Email" htmlFor="owner-email">
            <Input id="owner-email" type="email" value={form.email} onChange={set('email')} data-testid="owner-email" />
          </Field>
          <Field label="Phone" htmlFor="owner-phone">
            <Input id="owner-phone" type="tel" value={form.phone} onChange={set('phone')} data-testid="owner-phone" />
          </Field>
        </div>
        <Field label="HR email" htmlFor="owner-hr" hint="Where offer letters and experience certificates come from.">
          <Input
            id="owner-hr"
            type="email"
            value={form.hr_email}
            onChange={set('hr_email')}
            data-testid="owner-hr-email"
          />
        </Field>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionLabel>Business details</SectionLabel>
        <div className={pair}>
          <Field label="FSSAI licence" htmlFor="owner-fssai">
            <Input id="owner-fssai" value={form.fssai} onChange={set('fssai')} data-testid="owner-fssai" />
          </Field>
          <Field label="PAN" htmlFor="owner-pan">
            <Input id="owner-pan" value={form.pan} onChange={set('pan')} data-testid="owner-pan" />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionLabel>Who signs</SectionLabel>
        <div className={pair}>
          <Field label="Who signs" required htmlFor="owner-sign">
            <Input
              id="owner-sign"
              value={form.signatory_name}
              onChange={set('signatory_name')}
              data-testid="owner-signatory"
            />
          </Field>
          <Field label="Their designation" required htmlFor="owner-sign-role">
            <Input
              id="owner-sign-role"
              value={form.signatory_role}
              onChange={set('signatory_role')}
              data-testid="owner-signatory-role"
            />
          </Field>
        </div>
      </Card>

      <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
        The badge printed on the QR stands, the bill and every HR document. Replacing the artwork is a file change
        rather than a settings field in this release.
      </p>

      {/* Full width on a phone, where it is the thumb's target; its own size on a desk. */}
      <Button
        data-testid="owner-identity-save"
        disabled={busy}
        size="lg"
        className="md:w-auto md:self-start"
        onClick={() =>
          runBusy(async () => {
            await send('/api/owner/action', { action: 'write-identity', patch: form });
            toast.show('Restaurant details saved — every document follows', { tone: 'success' });
          })
        }
      >
        Save details
      </Button>
    </div>
  );
}

/* ── Tax ───────────────────────────────────────────────────────────────── */

function TaxPanel({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const tax = (data.settings.tax ?? {}) as { rate?: number; gstin?: string; inclusive?: boolean };
  const [rate, setRate] = React.useState(String(tax.rate ?? 5));
  const [gstin, setGstin] = React.useState(tax.gstin ?? '');
  const [inclusive, setInclusive] = React.useState(Boolean(tax.inclusive));

  const example = 1000;
  const rateNum = Number(rate) || 0;

  return (
    <Card className="flex flex-col gap-4">
      <SectionLabel>The rate is configuration, never a constant</SectionLabel>

      <div className="flex flex-wrap gap-3">
        <Field label="GST rate %" required htmlFor="owner-gst-rate" className="min-w-[10rem] flex-1">
          <Input
            id="owner-gst-rate"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.5"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            data-testid="owner-gst-rate"
          />
        </Field>
        <Field label="GSTIN" htmlFor="owner-gstin" className="min-w-[14rem] flex-1">
          <Input
            id="owner-gstin"
            value={gstin}
            onChange={(e) => setGstin(e.target.value)}
            data-testid="owner-gstin"
          />
        </Field>
      </div>

      <Toggle
        checked={inclusive}
        onCheckedChange={setInclusive}
        label="Menu prices already include GST"
        consequence="When on, the tax line is shown as included rather than added on top."
        testId="owner-gst-inclusive"
      />

      {/* The worked example under the field (Standard 2.3): a rate nobody can picture is a rate
          that gets typed wrong. */}
      <p className="m-0 rounded-[var(--radius-md)] bg-[var(--warning-surface)] px-4 py-3 type-caption leading-relaxed text-[var(--on-warning-surface)]">
        At {rateNum}%, a {rupees(example)} bill carries {rupees(Math.round((example * rateNum) / 100))} of GST and
        comes to {rupees(example + Math.round((example * rateNum) / 100))}. Changing the rate re-computes every open
        bill and every bill from here on — confirm the figure with your accountant before service.
      </p>

      <Button
        data-testid="owner-tax-save"
        disabled={busy}
        className="self-start"
        onClick={() =>
          runBusy(async () => {
            await send('/api/owner/action', {
              action: 'write-setting',
              key: 'tax',
              value: { rate: rateNum, gstin, inclusive },
            });
            toast.show(`GST set to ${rateNum}% — recorded in the audit log`, { tone: 'success' });
          })
        }
      >
        Save tax settings
      </Button>
    </Card>
  );
}

/* ── Invoice ───────────────────────────────────────────────────────────── */

function InvoicePanel({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const inv = (data.settings.invoice ?? {}) as {
    prefix?: string;
    reset?: string;
    rounding?: string;
    showCaptain?: boolean;
    showKot?: boolean;
  };
  const [prefix, setPrefix] = React.useState(inv.prefix ?? 'JAL');
  const [reset, setReset] = React.useState(inv.reset ?? 'Every financial year');
  const [rounding, setRounding] = React.useState(inv.rounding ?? 'Nearest rupee');
  const [showCaptain, setShowCaptain] = React.useState(inv.showCaptain !== false);
  const [showKot, setShowKot] = React.useState(inv.showKot !== false);

  return (
    <Card className="flex flex-col gap-4">
      <SectionLabel>Numbering, rounding and what prints on the bill</SectionLabel>

      <div className="flex flex-wrap gap-3">
        <Field label="Bill number prefix" htmlFor="owner-prefix" className="min-w-[10rem] flex-1">
          <Input
            id="owner-prefix"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            data-testid="owner-prefix"
          />
        </Field>
        <Field label="Numbering restarts" htmlFor="owner-reset" className="min-w-[12rem] flex-1">
          <Select id="owner-reset" value={reset} onChange={(e) => setReset(e.target.value)} data-testid="owner-reset">
            <option>Never</option>
            <option>Every financial year</option>
            <option>Every month</option>
          </Select>
        </Field>
        <Field label="Rounding on the payable" htmlFor="owner-rounding" className="min-w-[12rem] flex-1">
          <Select
            id="owner-rounding"
            value={rounding}
            onChange={(e) => setRounding(e.target.value)}
            data-testid="owner-rounding"
          >
            <option>Nearest rupee</option>
            <option>Round up</option>
            <option>No rounding</option>
          </Select>
        </Field>
      </div>

      <Toggle
        checked={showCaptain}
        onCheckedChange={setShowCaptain}
        label="Print captain and waiter names on the bill"
        consequence="Guests see who looked after them; disputes have a name attached."
        testId="owner-show-captain"
      />
      <Toggle
        checked={showKot}
        onCheckedChange={setShowKot}
        label="List KOT numbers on the bill"
        consequence="Useful when reconciling a bill against the kitchen's tickets."
        testId="owner-show-kot"
      />

      <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
        Bill numbers are allocated in the database, not in the app, so two closures in the same second cannot produce
        the same number. The prefix and reset rule change what the NEXT number looks like; nothing already issued
        moves.
      </p>

      <Button
        data-testid="owner-invoice-save"
        disabled={busy}
        className="self-start"
        onClick={() =>
          runBusy(async () => {
            await send('/api/owner/action', {
              action: 'write-setting',
              key: 'invoice',
              value: { prefix, reset, rounding, showCaptain, showKot },
            });
            toast.show('Invoice settings saved', { tone: 'success' });
          })
        }
      >
        Save invoice settings
      </Button>
    </Card>
  );
}

/* ── Tables and QR ─────────────────────────────────────────────────────── */

function IndoorQueueCard({
  data,
  send,
  runBusy,
  busy,
}: Pick<OwnerSectionProps, 'data' | 'send' | 'runBusy' | 'busy'>) {
  const toast = useToast();
  const [showQr, setShowQr] = React.useState(false);

  const queue = (data.settings.queue ?? {}) as { open?: boolean };
  // Open unless somebody closed it — the same default `/q` and `guestJoinQueue` both apply.
  const open = queue.open !== false;
  const canClose = data.grants.includes('queue.close');
  const canSeeCode = data.grants.includes('tables.qr');
  const waiting = data.waitlist.length;
  const guests = data.waitlist.reduce((a, w) => a + w.partySize, 0);

  return (
    <Card className="flex flex-col gap-3" data-testid="owner-entrance-qr">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <SectionLabel className="mb-0">Indoor queue code</SectionLabel>
        <Pill tone={open ? 'success' : 'warning'} data-testid="owner-entrance-status">
          {open ? 'Open · taking parties' : 'Closed · not taking parties'}
        </Pill>
      </div>

      <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
        One code for the door, not for a table. It encodes <code>{data.qrOrigin}/q</code> and nothing
        else — no party, no token, no table — so the same card stands at the entrance every night.
        Print it and put it where somebody waiting can reach it without asking.
      </p>

      {waiting ? (
        <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]" data-testid="owner-entrance-waiting">
          Right now: <strong className="text-[var(--text-body)]">{waiting === 1 ? '1 request' : `${waiting} requests`}</strong>{' '}
          · <strong className="text-[var(--text-body)]">{guests === 1 ? '1 guest' : `${guests} guests`}</strong> waiting
          outside.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canSeeCode ? (
          <Button data-testid="owner-entrance-qr-open" variant="secondary" onClick={() => setShowQr(true)}>
            Show the code
          </Button>
        ) : null}
        {canClose ? (
          <Button
            data-testid="owner-entrance-toggle"
            variant={open ? 'ghost' : 'primary'}
            disabled={busy}
            onClick={() =>
              runBusy(async () => {
                await send('/api/owner/action', {
                  action: 'write-setting',
                  key: 'queue',
                  value: { open: !open },
                });
                toast.show(
                  open
                    ? 'Queue closed — the door code says so, and everybody already waiting keeps their place'
                    : 'Queue open — the door code is taking parties again',
                  { tone: 'success' }
                );
              })
            }
          >
            {open ? 'Close the queue' : 'Open the queue'}
          </Button>
        ) : null}
      </div>

      <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
        Closing stops NEW parties only. Everybody already waiting keeps their token and their place,
        and the code starts taking parties again the moment you open it — it never has to be
        reprinted.
      </p>

      <Sheet
        open={showQr}
        onOpenChange={setShowQr}
        posture="modal"
        title="The code at the door"
        description="Printed once and stood at the entrance. It does not change when the queue opens or closes."
        testId="owner-entrance-qr-sheet"
        footer={
          <Button data-testid="owner-entrance-qr-print" asChild>
            {/* The anchor carries its own id as well as the button: `asChild` means the anchor IS
                the element that handles the click, and the table-code sheet beside this one has
                carried both since it was written. */}
            <a
              data-testid="owner-entrance-qr-print-link"
              href="/api/owner/qr"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open the image to print
            </a>
          </Button>
        }
      >
        <div className="flex flex-col items-center gap-3">
          {/* Unoptimised for the same reason the table codes are: generated per request, already
              the size it prints at, and must never be served from a stale cache. */}
          <Image
            src="/api/owner/qr"
            alt="QR code for the entrance queue"
            width={260}
            height={260}
            unoptimized
            className="rounded-[var(--radius-md)]"
          />
          <code className="type-caption text-[var(--text-muted)]">{data.qrOrigin}/q</code>
        </div>
      </Sheet>
    </Card>
  );
}

function TablesPanel({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const [editing, setEditing] = React.useState<{
    id?: string;
    name: string;
    zone: string;
    seats: string;
    active: boolean;
  } | null>(null);
  const [qrFor, setQrFor] = React.useState<string | null>(null);
  /* The printable stand: both faces, from the same code the QR sheet shows. Its own
     selection rather than a mode on `qrFor`, because the two sheets are different objects
     - one is an image to save, the other is a print with two pages. */
  const [standFor, setStandFor] = React.useState<string | null>(null);

  const zones = [...new Set(data.floor.map((t) => t.zone))];

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <SectionLabel>The tabletop code</SectionLabel>
        <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
          Each code is fixed to its table and encodes one thing: <code>{data.qrOrigin}/t/&lt;table&gt;</code>. Nothing
          about a bill or a guest is in it, so the same laminated card serves every party forever — and renaming a
          table below does not break it.
        </p>
      </Card>

      <IndoorQueueCard data={data} send={send} runBusy={runBusy} busy={busy} />

      {zones.map((zone) => (
        <Card key={zone} className="flex flex-col gap-2">
          <SectionLabel>
            {zone} · {data.floor.filter((t) => t.zone === zone).length} tables
          </SectionLabel>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {data.floor
              .filter((t) => t.zone === zone)
              .map((t) => (
                <li key={t.id}>
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-full py-1.5 pl-3 pr-1.5 type-caption',
                      t.active ? 'bg-[var(--surface-sunken)]' : 'bg-[var(--surface-sunken)] opacity-60'
                    )}
                  >
                    <span className="font-semibold">{t.name}</span>
                    <span className="type-caption text-[var(--text-muted)]">{t.seats} seats</span>
                    {!t.active ? <Pill tone="neutral">Off</Pill> : null}
                    <Button
                      data-testid={`owner-qr-${t.name}`}
                      size="sm"
                      variant="ghost"
                      onClick={() => setQrFor(t.name)}
                    >
                      QR
                    </Button>
                    <Button
                      data-testid={`owner-stand-${t.name}`}
                      size="sm"
                      variant="ghost"
                      onClick={() => setStandFor(t.name)}
                    >
                      Stand
                    </Button>
                    <Button
                      data-testid={`owner-edit-table-${t.name}`}
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditing({ id: t.id, name: t.name, zone: t.zone, seats: String(t.seats), active: t.active })
                      }
                    >
                      Edit
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        </Card>
      ))}

      <Button
        data-testid="owner-add-table"
        className="self-start"
        onClick={() => setEditing({ name: '', zone: zones[0] ?? 'AC', seats: '4', active: true })}
      >
        Add a table
      </Button>

      <Sheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        posture="modal"
        title={editing?.id ? `Table ${editing.name}` : 'Add a table'}
        description="The seat count is what the floor reads when it suggests where to put a party — a wrong number sends four people to a two-seater."
        testId="owner-table-sheet"
        footer={
          <>
            <Button data-testid="owner-table-cancel" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              data-testid="owner-table-save"
              disabled={busy || !editing?.name.trim()}
              onClick={() =>
                editing &&
                runBusy(async () => {
                  await send('/api/owner/action', {
                    action: 'upsert-table',
                    ...(editing.id ? { id: editing.id } : {}),
                    name: editing.name.trim().toUpperCase(),
                    zone: editing.zone,
                    seats: Number(editing.seats) || 4,
                    active: editing.active,
                  });
                  toast.show(`Table ${editing.name.toUpperCase()} saved`, { tone: 'success' });
                  setEditing(null);
                })
              }
            >
              Save table
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="flex flex-wrap gap-3">
            <Field label="Name" required htmlFor="owner-table-name" className="min-w-[8rem] flex-1">
              <Input
                id="owner-table-name"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                data-testid="owner-table-name"
              />
            </Field>
            <Field label="Zone" required htmlFor="owner-table-zone" className="min-w-[8rem] flex-1">
              <Input
                id="owner-table-zone"
                value={editing.zone}
                onChange={(e) => setEditing({ ...editing, zone: e.target.value })}
                data-testid="owner-table-zone"
              />
            </Field>
            <Field label="Seats" required htmlFor="owner-table-seats" className="min-w-[6rem] flex-1">
              <Input
                id="owner-table-seats"
                type="number"
                inputMode="numeric"
                min={1}
                max={40}
                value={editing.seats}
                onChange={(e) => setEditing({ ...editing, seats: e.target.value })}
                data-testid="owner-table-seats"
              />
            </Field>
            <div className="basis-full">
              <Toggle
                checked={editing.active}
                onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                label="On the floor"
                consequence="Switching a table off takes it out of service without deleting its history. Its code shows a friendly 'not in service' screen."
                testId="owner-table-active"
              />
            </div>
          </div>
        ) : null}
      </Sheet>

      <Sheet
        open={qrFor !== null}
        onOpenChange={(o) => !o && setQrFor(null)}
        posture="modal"
        title={qrFor ? `Table ${qrFor}` : 'Table code'}
        description="Printed on the tabletop stand. Fixed to this table, valid forever."
        testId="owner-qr-sheet"
        footer={
          <Button data-testid="owner-qr-open" asChild>
            <a
              data-testid="owner-qr-open-link"
              href={`/api/owner/qr?table=${encodeURIComponent(qrFor ?? '')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open the image to print
            </a>
          </Button>
        }
      >
        {qrFor ? (
          <div className="flex flex-col items-center gap-3">
            {/* Unoptimised on purpose: this image is generated per request and is already the
                exact size it is printed at. Running it through the image pipeline would cache a
                second copy of something that must never go stale. */}
            <Image
              src={`/api/owner/qr?table=${encodeURIComponent(qrFor)}`}
              alt={`QR code for table ${qrFor}`}
              width={260}
              height={260}
              unoptimized
              className="rounded-[var(--radius-md)]"
            />
            <code className="type-caption text-[var(--text-muted)]">
              {data.qrOrigin}/t/{qrFor}
            </code>
          </div>
        ) : null}
      </Sheet>

      <TableStandSheet
        table={standFor}
        onClose={() => setStandFor(null)}
        qrOrigin={data.qrOrigin}
        restaurant={data.restaurant}
        settings={data.settings}
      />
    </div>
  );
}

/* ── What the customer sees ────────────────────────────────────────────── */

const FEATURE_GROUPS: Array<{ name: string; items: Array<[string, string, string]> }> = [
  {
    name: 'What the bill shows them',
    items: [
      [
        'orderTotal',
        'Show the order total on the guest’s phone',
        'The running total before GST. Off means they start without it and tick a box in the bottom bar when they want it — per-dish prices are shown either way.',
      ],
    ],
  },
  {
    name: 'Who is serving them',
    items: [
      ['captainName', "Show the captain's name", 'The welcome screen names them.'],
      ['waiterName', "Show the waiter's name", 'A second name on the welcome screen.'],
      ['askForPerson', 'Let them ask for someone by name', 'Adds a chip to the ask sheet.'],
    ],
  },
  {
    name: 'Quick buttons',
    items: [
      ['water', 'Need water', 'One tap raises it on every captain phone.'],
      ['waterBottle', 'Water bottle', 'A sealed bottle, added to the bill.'],
      ['callCaptain', 'Call captain', 'Rings on the captain’s Requests tab.'],
      ['plates', 'Extra plates or cutlery', ''],
      ['parcelRest', 'Parcel the rest of the food', ''],
      ['askBill', 'Ask for the bill', 'Separate from Request payment — a nudge rather than a closure.'],
    ],
  },
  {
    name: 'At the end',
    items: [
      ['upsell', 'Dessert and drink offer at payment', 'Adds a fresh round if taken.'],
      ['takeaway', 'Offer to parcel a favourite', 'Billed separately as a takeaway.'],
      ['tip', 'Tip options', 'Tips stay out of income either way.'],
      ['whatsapp', 'Send the bill to WhatsApp', 'Needs a provider before it can actually send.'],
      ['suggestion', 'Suggestion box', 'Lands on your dashboard, privately.'],
      ['review', 'Google review prompt', 'Only clicks are measurable, never submissions.'],
    ],
  },
  {
    name: 'While they eat',
    items: [
      ['heart', 'Loved-it heart once the food is served', ''],
      ['occasion', 'Ask if they are celebrating', 'Nothing is added to the bill.'],
      ['hoursBtn', 'Hours and holidays button', ''],
    ],
  },
];

function FeaturesPanel({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const stored = (data.settings.customerFeatures ?? {}) as Record<string, boolean>;
  /* Every switch starts from the SAME defaults the guest's phone fills its gaps with. This panel
     used to read an unsaved key as "on", which is right for twenty-two of these and wrong for
     the twenty-third: a feature that is off by default would have drawn itself on here while
     every phone drew it off, and the owner would have had no way to tell. */
  const [values, setValues] = React.useState<Record<string, boolean>>(() => ({ ...resolveFeatures(stored) }));

  const onCount = Object.values(values).filter(Boolean).length;

  return (
    <Card className="flex flex-col gap-4">
      <SectionLabel>{onCount} of the optional things are on</SectionLabel>
      <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
        Switch off anything you have not the hands for tonight and it disappears from every guest&rsquo;s phone within
        seconds. No other screen changes. A feature you cannot honour is worse than a missing one, because it makes a
        promise (Standard 2.4).
      </p>

      {FEATURE_GROUPS.map((g) => (
        <div key={g.name}>
          <SectionLabel>{g.name}</SectionLabel>
          <div className="divide-y divide-[var(--border)]">
            {g.items.map(([key, label, consequence]) => (
              <Toggle
                key={key}
                checked={values[key] ?? DEFAULT_FEATURES[key as keyof typeof DEFAULT_FEATURES]}
                onCheckedChange={(v) => setValues({ ...values, [key]: v })}
                label={label}
                {...(consequence ? { consequence } : {})}
                testId={`owner-feature-${key}`}
              />
            ))}
          </div>
        </div>
      ))}

      <Button
        data-testid="owner-features-save"
        disabled={busy}
        className="self-start"
        onClick={() =>
          runBusy(async () => {
            await send('/api/owner/action', { action: 'write-setting', key: 'customerFeatures', value: values });
            toast.show(`${onCount} optional features on — every open phone follows within seconds`, {
              tone: 'success',
            });
          })
        }
      >
        Save what the customer sees
      </Button>
    </Card>
  );
}

/* ── Welcome drinks (24-Sep list, D1) ──────────────────────────────────── */

/**
 * Which menu items are the welcome drinks, and whether they are offered at all.
 *
 * Offered on a table's FIRST order only, on the captain's phone and the owner's new-round
 * sheet, as one tap that puts them in the round being built. They are ordinary menu items -
 * priced, printed and billed like anything else; complimentary means priced at ₹0 in the menu.
 */
function WelcomeDrinksPanel({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const stored = readWelcomeDrinks(data.settings.welcomeDrinks);
  const [enabled, setEnabled] = React.useState(stored.enabled);
  const [itemIds, setItemIds] = React.useState<string[]>(stored.itemIds);
  const [query, setQuery] = React.useState('');

  const chosen = itemIds
    .map((id) => data.menu.find((m) => m.id === id))
    .filter((m): m is (typeof data.menu)[number] => !!m);
  const q = query.trim().toLowerCase();
  const matches = data.menu.filter((m) => !q || `${m.name} ${m.category}`.toLowerCase().includes(q)).slice(0, 30);
  const toggle = (id: string): void =>
    setItemIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Card className="flex flex-col gap-4" data-testid="owner-welcome-drinks">
      <SectionLabel>Welcome drinks</SectionLabel>
      <Toggle
        checked={enabled}
        onCheckedChange={setEnabled}
        label="Offer welcome drinks on a table's first order"
        consequence="Captains and the owner see one button that adds them to the first round. Never offered on a later round, and never added without that tap."
        testId="owner-welcome-enabled"
      />
      <div>
        <p className="m-0 mb-2 type-caption text-[var(--text-muted)]" data-testid="owner-welcome-chosen">
          {chosen.length
            ? `Chosen: ${chosen.map((m) => `${m.name} (${m.priceLabel})`).join(', ')}`
            : 'No drinks chosen yet. Pick them from the menu below.'}
        </p>
        <Input
          value={query}
          placeholder="Search the menu for the drinks"
          onChange={(e) => setQuery(e.target.value)}
          data-testid="owner-welcome-search"
          aria-label="Search the menu for the welcome drinks"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {matches.map((m) => (
            <Chip key={m.id} on={itemIds.includes(m.id)} onClick={() => toggle(m.id)} data-testid={`owner-welcome-item-${m.id}`}>
              {m.name}
            </Chip>
          ))}
        </div>
      </div>
      <Button
        data-testid="owner-welcome-save"
        disabled={busy || (enabled && itemIds.length === 0)}
        className="self-start"
        onClick={() =>
          runBusy(async () => {
            await send('/api/owner/action', {
              action: 'write-setting',
              key: 'welcomeDrinks',
              value: { enabled, itemIds },
            });
            toast.show(
              enabled ? `Welcome drinks on — ${chosen.map((m) => m.name).join(', ')}` : 'Welcome drinks off',
              { tone: 'success' }
            );
          })
        }
      >
        Save welcome drinks
      </Button>
    </Card>
  );
}

/* ── Words the guest sees ──────────────────────────────────────────────── */

const COPY_FIELDS: Array<[string, string, string]> = [
  ['name', 'Restaurant name', 'Shown at the top of the guest’s phone.'],
  ['subline', 'Sub-line', 'Under the name on the welcome screen.'],
  ['greetMorning', 'Greeting — morning', 'Before noon, on the guest’s own clock.'],
  ['greetAfternoon', 'Greeting — afternoon', ''],
  ['greetEvening', 'Greeting — evening', ''],
  ['greetLate', 'Greeting — late', ''],
  ['welcome', 'Welcome paragraph', 'The one explanation of how ordering works.'],
  ['startBtn', 'Start button', ''],
  ['payBtn', 'Request payment button', ''],
  ['cookingLine', 'After an order is sent', 'Use {captain} for the captain’s name.'],
  ['servedHeading', 'When the food is served', ''],
  ['heartHint', 'Heart hint', ''],
  ['tipPrompt', 'Tip prompt', 'Use {captain} for the captain’s name.'],
  ['reviewHeading', 'Review prompt heading', ''],
  ['reviewSub', 'Review prompt sub-line', ''],
  ['suggestPrompt', 'Suggestion box prompt', ''],
  ['footer', 'Footer', ''],
];

function CopyPanel({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const stored = (data.settings.copy ?? {}) as Record<string, string>;
  const [values, setValues] = React.useState<Record<string, string>>(stored);

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_20rem] lg:items-start">
      <Card className="flex flex-col gap-3">
        <SectionLabel>Every string a guest reads, editable without a release</SectionLabel>
        <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
          Clearing a field falls back to the shipped wording rather than blanking the screen — the default is the
          placeholder, so an empty box is never an empty phone (Standard 2.1).
        </p>

        {COPY_FIELDS.map(([key, label, hint]) => (
          <Field key={key} label={label} htmlFor={`owner-copy-${key}`} {...(hint ? { hint } : {})}>
            <Input
              id={`owner-copy-${key}`}
              value={values[key] ?? ''}
              placeholder={stored[key] ?? ''}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
              data-testid={`owner-copy-${key}`}
            />
          </Field>
        ))}

        <Button
          data-testid="owner-copy-save"
          disabled={busy}
          className="self-start"
          onClick={() =>
            runBusy(async () => {
              await send('/api/owner/action', { action: 'write-setting', key: 'copy', value: values });
              toast.show('Wording saved — it reaches every guest phone on their next tap', { tone: 'success' });
            })
          }
        >
          Save wording
        </Button>
      </Card>

      <Card className="lg:sticky lg:top-32">
        <SectionLabel>As the guest sees it</SectionLabel>
        <div className="rounded-[var(--radius-lg)] bg-[var(--background)] p-4">
          <p className="m-0 type-caption font-bold uppercase tracking-[0.14em] text-[var(--primary)]">
            {values.greetEvening || 'Good evening'}
          </p>
          <p className="m-0 mt-1 type-h3 font-semibold">{values.name || 'Jalsa Restaurant'}</p>
          <p className="m-0 type-caption text-[var(--text-muted)]">{values.subline || 'Hosur · since 2016'}</p>
          <p className="m-0 mt-3 type-caption leading-relaxed">
            {values.welcome || 'The full menu is on your phone.'}
          </p>
          <span className="mt-3 inline-flex min-h-11 items-center rounded-full bg-[var(--primary)] px-5 type-body font-semibold text-[var(--on-primary)]">
            {values.startBtn || 'Start ordering'}
          </span>
        </div>
        <p className="m-0 mt-2 type-caption leading-relaxed text-[var(--text-muted)]">
          Anything typed on the left shows here, and on every guest phone once you save.
        </p>
      </Card>
    </div>
  );
}

/* ── Printers ──────────────────────────────────────────────────────────── */
/*
 * The panel that used to live here listed the machines and then explained, honestly, that
 * routing, the character-grid templates and the print-history trail were not built and that
 * building half of them would read as a finished feature. They are built now, as the design's
 * five sections, and the panel is `PrintSetupSection`. The paragraph is not preserved: it
 * described an absence that no longer exists, and a note about a gap that has been filled is
 * the kind of stale prose that teaches the wrong thing with confidence.
 */

/* ── Replies to suggestions ────────────────────────────────────────────── */

/**
 * The canned replies the owner sends from the Dashboard's suggestion thread.
 *
 * WHY THE TEMPLATES ARE CONFIGURATION AND THE REPLY IS NOT
 *   A reply to a guest is written by a person, every time — the design never offers to send one
 *   automatically, and neither does this. What is configured here is the SHORTLIST: the three or
 *   four sentences this restaurant actually uses, so the common answer is one tap and the
 *   unusual one is still typed. Baked into a build, changing "we have fixed it" costs a release.
 */
function RepliesPanel({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  /* The shape is NOT ours to choose: Dashboard.tsx already reads settings.replies.items and
     draws a chip per entry as { name, text } — the name on the chip, the text into the box.
     Writing a plain string[] here would have type-checked, saved, and silently emptied the
     canned replies on the screen that uses them. */
  const stored = (data.settings.replies ?? {}) as {
    heading?: string;
    items?: Array<{ name: string; text: string }>;
  };
  const [heading, setHeading] = React.useState(stored.heading ?? '');
  const [items, setItems] = React.useState<Array<{ name: string; text: string }>>(stored.items ?? []);
  const [draftName, setDraftName] = React.useState('');
  const [draftText, setDraftText] = React.useState('');

  return (
    <Card className="flex flex-col gap-4">
      <SectionLabel>{items.length === 1 ? '1 reply' : `${items.length} replies`} the team can send in one tap</SectionLabel>

      <Field
        label="Heading above the buttons"
        htmlFor="owner-replies-heading"
        hint="What the person replying sees above the shortlist. Empty falls back to the shipped wording."
      >
        <Input
          id="owner-replies-heading"
          value={heading}
          placeholder="Send a quick reply"
          onChange={(e) => setHeading(e.target.value)}
          data-testid="owner-replies-heading"
        />
      </Field>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((r, i) => (
          <li key={`${r.name}-${i}`} className="flex flex-wrap items-center gap-2">
            <span className="shrink-0 rounded-full bg-[var(--primary-surface)] px-3 py-1 type-caption font-semibold text-[var(--on-primary-surface)]">
              {r.name}
            </span>
            <span className="min-w-0 flex-1 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-3 py-2 type-body">
              {r.text}
            </span>
            <Button
              data-testid={`owner-reply-remove-${i}`}
              size="sm"
              variant="ghost"
              onClick={() => setItems(items.filter((_, j) => j !== i))}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-3">
        <Field label="Button label" htmlFor="owner-replies-name" className="min-w-[10rem] flex-1">
          <Input
            id="owner-replies-name"
            value={draftName}
            placeholder="Thanks"
            onChange={(e) => setDraftName(e.target.value)}
            data-testid="owner-replies-name"
          />
        </Field>
        <Field label="What it writes" htmlFor="owner-replies-text" className="min-w-[16rem] flex-[2]">
          <Input
            id="owner-replies-text"
            value={draftText}
            placeholder="Thank you — we have passed this to the kitchen."
            onChange={(e) => setDraftText(e.target.value)}
            data-testid="owner-replies-text"
          />
        </Field>
      </div>
      <Button
        data-testid="owner-replies-add"
        variant="secondary"
        className="self-start"
        disabled={!draftName.trim() || !draftText.trim()}
        onClick={() => {
          setItems([...items, { name: draftName.trim(), text: draftText.trim() }]);
          setDraftName('');
          setDraftText('');
        }}
      >
        Add a reply
      </Button>

      <Button
        data-testid="owner-replies-save"
        disabled={busy}
        className="self-start"
        onClick={() =>
          runBusy(async () => {
            await send('/api/owner/action', { action: 'write-setting', key: 'replies', value: { heading, items } });
            toast.show(
              items.length === 1 ? '1 quick reply saved' : `${items.length} quick replies saved`,
              { tone: 'success' }
            );
          })
        }
      >
        Save replies
      </Button>
    </Card>
  );
}

/* ── Customer engagement ───────────────────────────────────────────────── */

/**
 * The phone number behind the guest's Call button, the review link, and how the bill travels.
 *
 * THESE WERE ALREADY LIVE AND ALREADY UNEDITABLE
 *   `guest-view.ts` has read `engagement.reviewUrl` and `engagement.callNumber` since the guest
 *   surface was built — the Call button and "Write a review" are gated on them being non-empty.
 *   With no panel, the only way to set either was a hand-written row in the settings table. A
 *   value the product depends on and no screen can change is configuration in name only.
 */
function EngagementPanel({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const stored = (data.settings.engagement ?? {}) as {
    callNumber?: string;
    reviewUrl?: string;
    askPhotos?: boolean;
    whatsappProvider?: string;
    invoiceSentWhen?: string;
  };
  const [values, setValues] = React.useState({
    callNumber: stored.callNumber ?? '',
    reviewUrl: stored.reviewUrl ?? '',
    askPhotos: stored.askPhotos ?? false,
    whatsappProvider: stored.whatsappProvider ?? '',
    invoiceSentWhen: stored.invoiceSentWhen ?? 'closed',
  });

  return (
    <Card className="flex flex-col gap-4">
      <SectionLabel>What the phone offers after the meal</SectionLabel>

      <Field
        label="Phone number behind the Call button"
        htmlFor="owner-engage-call"
        hint="Empty hides the button rather than dialling nothing — Standard 2.4."
      >
        <Input
          id="owner-engage-call"
          type="tel"
          inputMode="tel"
          value={values.callNumber}
          onChange={(e) => setValues({ ...values, callNumber: e.target.value })}
          data-testid="owner-engage-call"
        />
      </Field>

      <Field
        label="Google review link"
        htmlFor="owner-engage-review"
        hint="Empty hides the review card. A wrong link sends a happy guest to somebody else's page, so it is typed, never guessed."
      >
        <Input
          id="owner-engage-review"
          type="url"
          value={values.reviewUrl}
          placeholder="https://g.page/r/..."
          onChange={(e) => setValues({ ...values, reviewUrl: e.target.value })}
          data-testid="owner-engage-review"
        />
      </Field>

      <Toggle
        checked={values.askPhotos}
        onCheckedChange={(v) => setValues({ ...values, askPhotos: v })}
        label="Ask for photos before the review redirect"
        consequence="A photo taken at the table is worth more than a line of text, and asking first is the only moment the guest still has the plate in front of them."
        testId="owner-engage-photos"
      />

      <Field
        label="WhatsApp provider"
        htmlFor="owner-engage-provider"
        hint="Named here so the bill-to-WhatsApp button can say which service is not connected yet, rather than failing silently."
      >
        <Input
          id="owner-engage-provider"
          value={values.whatsappProvider}
          onChange={(e) => setValues({ ...values, whatsappProvider: e.target.value })}
          data-testid="owner-engage-provider"
        />
      </Field>

      <Field label="Invoice is sent when" htmlFor="owner-engage-when">
        <Select
          id="owner-engage-when"
          value={values.invoiceSentWhen}
          onChange={(e) => setValues({ ...values, invoiceSentWhen: e.target.value })}
          data-testid="owner-engage-when"
        >
          <option value="closed">The bill is closed</option>
          <option value="asked">The guest asks for it</option>
          <option value="never">Never — printed only</option>
        </Select>
      </Field>

      <Button
        data-testid="owner-engage-save"
        disabled={busy}
        className="self-start"
        onClick={() =>
          runBusy(async () => {
            await send('/api/owner/action', { action: 'write-setting', key: 'engagement', value: values });
            toast.show('Engagement settings saved — every guest phone picks them up on its next tap', {
              tone: 'success',
            });
          })
        }
      >
        Save engagement
      </Button>
    </Card>
  );
}
