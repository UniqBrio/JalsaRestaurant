'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { CHIP_NAV_WRAP } from '@/lib/chip-nav';
import { Card, Chip, Pill, SectionLabel } from '@/components/ui/atoms';
import { Combobox } from '@/components/ui/combobox';
import { Field, Input, Select, Toggle } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { FirstRunState } from '@/components/ui/states';
import { PRINT_STATUS } from '@/components/ui/print';
import { useToast } from '@/components/ui/toast';
import {
  PAPER,
  autoFit,
  buildTicket,
  columnsFor,
  defaultTemplate,
  fieldsFor,
  LOCKED_FIELDS,
  printOrder,
  validateTemplate,
  type FontSize,
  type ItemLayout,
  type PaperWidth,
  type Separator,
  type TemplateConfig,
  type TicketData,
  type TicketKind,
} from '@/lib/print-template';
import { mainPrinter, printerShortName, resolvePrinter, type RoutablePrinter } from '@/lib/print-routing';
import type { PrintJobRow } from '@/lib/db/types';
import type { OwnerSectionProps } from '../OwnerConsole';
import { MetricTile } from '../OwnerConsole';

/**
 * Print setup — Overview · Printers · Templates · Routing · History.
 *
 * `Jalsa Navigation Flowchart.dc.html`, section six: *"Print setup — five sections."* Until now
 * this console had a Printers list and an honest paragraph saying the rest was not built. The
 * paragraph was true and is now obsolete; what replaces it is the five sections, the character
 * grid they configure, and the routing the order path actually reads.
 *
 * WHY THE PREVIEW IS BUILT BY `print-template`, NOT DRAWN IN CSS
 *   A CSS preview wraps on word boundaries no thermal printer has ever heard of. It looks right
 *   at every width and clips in the kitchen. Every line below comes from the module that a print
 *   worker would call, so what the owner reads here is character-for-character the ticket — which
 *   is the only thing that makes the validation worth blocking a save over.
 *
 * WHAT IS STILL NOT TRUE, AND IS SAID ON THE SCREEN
 *   The TVS machines remain an unvalidated dependency. "Check connection" records an attempt and
 *   its result; it does not open a socket, because there is nothing in this deployment that can.
 *   Test print queues a job exactly as a round does and shows what came back. Both say so where
 *   they are used rather than in a note somebody has to go and find.
 */

type Tab = 'overview' | 'printers' | 'templates' | 'routing' | 'history';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'printers', label: 'Printers' },
  { key: 'templates', label: 'Templates' },
  { key: 'routing', label: 'Routing' },
  { key: 'history', label: 'History' },
];

/**
 * The round the preview is drawn with — taken from THIS restaurant's own menu.
 *
 * WHY NOT A HAND-WRITTEN SPECIMEN
 *   A preview built from an invented round proves only that the invented round fits. The
 *   question the owner is actually asking is "does MY menu fit on 58 mm paper", and the item
 *   that answers it is whichever dish here has the longest name. A fixed sample would pass
 *   validation on a menu whose longest name is eleven characters longer — and the first person
 *   to find out would be a cook holding half a dish name.
 *
 *   So the round is composed from the real menu, deliberately awkwardly: the longest name
 *   first, then one item of each food type so the grouping bands are all exercised, then
 *   whatever fills five lines. A double quantity and a special instruction are attached to the
 *   first item, because both widen the line and neither is stored on a menu row.
 */
function previewRound(
  menu: OwnerSectionProps['data']['menu']
): Array<{ name: string; qty: number; foodType: 'veg' | 'non_veg' | 'egg'; rate: number; category: string; instruction: string }> {
  if (menu.length === 0) return [];
  const longest = [...menu].sort((a, b) => b.name.length - a.name.length)[0]!;
  const picked = [longest];
  (['veg', 'non_veg', 'egg'] as const).forEach((t) => {
    const found = menu.find((m) => m.foodType === t && !picked.some((p) => p.id === m.id));
    if (found) picked.push(found);
  });
  menu.forEach((m) => {
    if (picked.length < 5 && !picked.some((p) => p.id === m.id)) picked.push(m);
  });
  return picked.map((m, i) => ({
    name: m.name,
    // A quantity of two on one line, because "2" and "12" are different widths and a template
    // validated only against single digits is a template validated against half the evening.
    qty: i === 1 ? 12 : 1,
    foodType: m.foodType,
    rate: m.price,
    category: m.category,
    instruction: i === 0 ? 'less spicy, no onion' : '',
  }));
}

const toRoutable = (p: OwnerSectionProps['data']['printers'][number]): RoutablePrinter => ({
  id: p.id,
  // The tie-break, carried so this preview resolves a contested category exactly the way the
  // order path does. Without it the screen could promise one machine and the kitchen get another.
  machineId: p.machineId,
  name: p.name,
  purpose: p.purpose,
  station: p.station,
  routes: p.routes,
  online: p.online,
  enabled: p.enabled,
});

export function PrintSetupSection(props: OwnerSectionProps) {
  const { data } = props;
  const [tab, setTab] = React.useState<Tab>('overview');

  const kot = data.printers.filter((p) => p.purpose === 'KOT');
  const bills = data.printers.filter((p) => p.purpose !== 'KOT');
  const failedToday = data.printJobs.filter((j) => j.status === 'failed').length;
  // Assigned and undelivered. Without it the tile below reads "Nothing outstanding" over a
  // history in which nothing has printed at all.
  const waitingToday = data.printJobs.filter((j) => j.status === 'queued').length;

  return (
    <div className="flex flex-col gap-4" data-testid="owner-print-setup">
      <nav className={CHIP_NAV_WRAP} aria-label="Print setup sections">
        {TABS.map((t) => (
          <Chip key={t.key} on={tab === t.key} onClick={() => setTab(t.key)} data-testid={`owner-print-${t.key}`}>
            {t.label}
          </Chip>
        ))}
      </nav>

      {tab === 'overview' ? (
        <OverviewPanel
          {...props}
          kotCount={kot.length}
          billCount={bills.length}
          failed={failedToday}
          waiting={waitingToday}
          openTab={setTab}
        />
      ) : null}
      {tab === 'printers' ? <PrintersPanel {...props} /> : null}
      {tab === 'templates' ? <TemplatesPanel {...props} /> : null}
      {tab === 'routing' ? <RoutingPanel {...props} /> : null}
      {tab === 'history' ? <HistoryPanel {...props} /> : null}
    </div>
  );
}

/* ── Overview ──────────────────────────────────────────────────────────── */

function OverviewPanel({
  data,
  kotCount,
  billCount,
  failed,
  waiting,
  openTab,
}: OwnerSectionProps & {
  kotCount: number;
  billCount: number;
  failed: number;
  waiting: number;
  openTab: (t: Tab) => void;
}) {
  const down = data.printers.filter((p) => p.enabled && !p.online);
  const off = data.printers.filter((p) => !p.enabled);

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
        Two kitchen machines and the counter bill printer. Everything here is about what physically comes out of them.
      </p>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <MetricTile
          label="KOT printing"
          value={String(kotCount)}
          note={down.length ? `${down.length} not answering` : 'All answering'}
          testId="owner-print-kot-count"
          tone={down.length ? 'warning' : 'neutral'}
          onClick={() => openTab('printers')}
        />
        <MetricTile
          label="Bill printing"
          value={String(billCount)}
          note="At the counter"
          testId="owner-print-bill-count"
          onClick={() => openTab('printers')}
        />
        <MetricTile
          label="Failed tickets"
          value={String(failed)}
          note={failed ? 'Each one has a retry' : waiting ? `${waiting} waiting to print` : 'Nothing outstanding'}
          testId="owner-print-failed"
          tone={failed ? 'error' : 'neutral'}
          onClick={() => openTab('history')}
        />
        <MetricTile
          label="Templates"
          value="2"
          note="KOT and bill, per width"
          testId="owner-print-templates"
          onClick={() => openTab('templates')}
        />
      </div>

      <Card className="flex flex-col gap-2">
        <SectionLabel>The machines</SectionLabel>
        {data.printers.length === 0 ? (
          <FirstRunState
            title="No machine is configured"
            note="Add the kitchen and counter printers so a round has somewhere to print. Until then every ticket lands in the history as failed, with the order intact behind it."
            testId="owner-print-no-machines"
          />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {data.printers.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-4 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block type-body font-semibold">{p.name}</span>
                  <span className="block type-caption text-[var(--text-muted)]">
                    {p.purpose} · {p.station} · {p.paperMm} mm · {p.connection}
                  </span>
                </span>
                <Pill tone={!p.enabled ? 'neutral' : p.online ? 'success' : 'error'}>
                  {!p.enabled ? 'Switched off' : p.online ? 'Answering' : 'Not answering'}
                </Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* NEEDS ATTENTION. Only what a person can act on — an empty list here means the kitchen
          is printing, which is a thing worth being able to see at a glance mid-service. */}
      {down.length || off.length || failed ? (
        <Card className="flex flex-col gap-3" data-testid="owner-print-alerts">
          <SectionLabel>Needs attention</SectionLabel>
          {down.map((p) => (
            <div key={p.id} className="rounded-[var(--radius-md)] bg-[var(--error-surface)] px-4 py-3">
              <p className="m-0 type-body font-semibold text-[var(--on-error-surface)]">{p.name} is not answering</p>
              <p className="m-0 type-caption leading-relaxed text-[var(--on-error-surface)]">
                Its tickets fall back to the main kitchen printer with <strong>{p.station}</strong> on the header, so
                nothing is lost — but the {p.station.toLowerCase()} is working from somebody else&rsquo;s paper.
              </p>
            </div>
          ))}
          {off.map((p) => (
            <div key={p.id} className="rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-4 py-3">
              <p className="m-0 type-body font-semibold">{p.name} is switched off</p>
              <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
                Somebody turned it off here, which is different from it failing. Its tickets go to the main kitchen.
              </p>
            </div>
          ))}
          {failed ? (
            <button
              type="button"
              data-testid="owner-print-open-history"
              onClick={() => openTab('history')}
              className="rounded-[var(--radius-md)] bg-[var(--warning-surface)] px-4 py-3 text-left"
            >
              <p className="m-0 type-body font-semibold text-[var(--on-warning-surface)]">
                {failed === 1 ? '1 ticket failed' : `${failed} tickets failed`}
              </p>
              <p className="m-0 type-caption leading-relaxed text-[var(--on-warning-surface)]">
                The rounds exist and are on the captain&rsquo;s screen. Open the history to retry them.
              </p>
            </button>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

/* ── Printers ──────────────────────────────────────────────────────────── */

interface PrinterForm {
  id?: string;
  machineId: string;
  name: string;
  purpose: string;
  station: string;
  paperMm: number;
  connection: string;
  address: string;
  port: number;
  routes: string[];
  enabled: boolean;
}

const blankPrinter = (): PrinterForm => ({
  machineId: '',
  name: '',
  purpose: 'KOT',
  station: 'Main Kitchen',
  paperMm: 80,
  connection: 'Ethernet',
  address: '',
  port: 9100,
  routes: [],
  enabled: true,
});

function PrintersPanel({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const [form, setForm] = React.useState<PrinterForm | null>(null);
  const canEdit = data.grants.includes('set.printer');

  const save = (f: PrinterForm): void => {
    void runBusy(async () => {
      await send('/api/owner/action', {
        action: 'upsert-printer',
        ...(f.id ? { id: f.id } : {}),
        machineId: f.machineId || f.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20),
        name: f.name,
        purpose: f.purpose,
        station: f.station,
        paperMm: f.paperMm,
        connection: f.connection,
        address: f.address,
        port: f.port,
        routes: f.routes,
        enabled: f.enabled,
      });
      setForm(null);
      toast.show(`${f.name} saved · ${f.paperMm} mm · ${f.purpose} template`, { tone: 'success' });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 max-w-prose type-caption leading-relaxed text-[var(--text-muted)]">
          Each machine has its own paper width, so each has its own template. Changing a width re-flows that template
          rather than shrinking it.
        </p>
        {canEdit ? (
          <Button data-testid="owner-print-add" size="sm" onClick={() => setForm(blankPrinter())}>
            Add a printer
          </Button>
        ) : null}
      </div>

      {data.printers.length === 0 ? (
        <FirstRunState
          title="No machine is configured"
          note="A round still saves without one — it lands in the print history as failed, with a retry beside it. But nobody in the kitchen is told to cook it."
          testId="owner-print-printers-empty"
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {data.printers.map((p) => (
            <li key={p.id}>
              <Card className="flex flex-col gap-3" data-testid={`owner-print-printer-${p.id}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-[10rem] flex-1">
                    <span className="block type-body font-semibold">{p.name}</span>
                    <span className="block type-caption text-[var(--text-muted)]">
                      {p.purpose} template · {p.station}
                    </span>
                  </span>
                  <Pill tone={!p.enabled ? 'neutral' : p.online ? 'success' : 'error'}>
                    {!p.enabled ? 'Switched off' : p.online ? 'Answering' : 'Not answering'}
                  </Pill>
                  {canEdit ? (
                    <Button
                      data-testid={`owner-print-configure-${p.id}`}
                      size="sm"
                      variant="ghost"
                      onClick={() => setForm({ ...p })}
                    >
                      Configure
                    </Button>
                  ) : null}
                </div>

                <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                  {[
                    { k: 'Paper', v: `${p.paperMm} mm` },
                    { k: 'Connection', v: p.connection },
                    { k: 'Address', v: p.connection === 'USB' ? 'USB' : p.address || 'Not set' },
                    { k: 'Prints', v: p.routes.length ? p.routes.join(', ') : 'Everything unrouted' },
                  ].map((f) => (
                    <div key={f.k}>
                      <dt className="m-0 type-caption text-[var(--text-muted)]">{f.k}</dt>
                      <dd className="m-0 type-caption font-semibold">{f.v}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="m-0 rounded-[var(--radius-md)] bg-[var(--warning-surface)] px-4 py-3 type-caption leading-relaxed text-[var(--on-warning-surface)]">
        <strong>Connectivity is still an unvalidated dependency.</strong> These rows record what each machine
        <em> is</em>, and the order path routes to them. Nothing in this deployment opens a socket to a TVS device, so a
        machine is marked as answering only when something actually answered — which, today, nothing has.
      </p>

      <Sheet
        open={form !== null}
        onOpenChange={(o) => !o && setForm(null)}
        posture="modal"
        title={form?.id ? 'Configure printer' : 'Add a printer'}
        description="Name it for the person who will look for it, not for the network."
        testId="owner-print-form"
        footer={
          <>
            <Button data-testid="owner-print-cancel" variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button
              data-testid="owner-print-save"
              disabled={busy || !form?.name.trim() || (form.connection !== 'USB' && !form.address.trim())}
              onClick={() => form && save(form)}
            >
              {form?.id ? 'Save changes' : 'Add the printer'}
            </Button>
          </>
        }
      >
        {form ? (
          <div className="flex flex-col gap-3">
            <Field label="Printer name" required htmlFor="owner-print-name">
              <Input
                id="owner-print-name"
                value={form.name}
                placeholder="Main Kitchen Printer"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="owner-print-name"
              />
            </Field>

            <div className="flex flex-wrap gap-3">
              <Field label="What it prints" htmlFor="owner-print-purpose" className="min-w-[8rem] flex-1">
                <Select
                  id="owner-print-purpose"
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  data-testid="owner-print-purpose"
                >
                  <option value="KOT">Kitchen tickets</option>
                  <option value="Invoice">Bills</option>
                </Select>
              </Field>
              <Field label="Station" htmlFor="owner-print-station" className="min-w-[8rem] flex-1">
                <Input
                  id="owner-print-station"
                  value={form.station}
                  onChange={(e) => setForm({ ...form, station: e.target.value })}
                  data-testid="owner-print-station"
                />
              </Field>
              <Field label="Paper" htmlFor="owner-print-paper" className="min-w-[7rem] flex-1">
                <Select
                  id="owner-print-paper"
                  value={String(form.paperMm)}
                  onChange={(e) => setForm({ ...form, paperMm: Number(e.target.value) })}
                  data-testid="owner-print-paper"
                >
                  <option value="80">80 mm</option>
                  <option value="58">58 mm</option>
                </Select>
              </Field>
            </div>

            <div className="flex flex-wrap gap-3">
              <Field label="How it connects" htmlFor="owner-print-conn" className="min-w-[8rem] flex-1">
                <Select
                  id="owner-print-conn"
                  value={form.connection}
                  onChange={(e) => setForm({ ...form, connection: e.target.value })}
                  data-testid="owner-print-conn"
                >
                  <option value="Ethernet">Ethernet</option>
                  <option value="Wi-Fi">Wi-Fi</option>
                  <option value="USB">USB</option>
                </Select>
              </Field>
              {form.connection !== 'USB' ? (
                <>
                  <Field label="IP address" required htmlFor="owner-print-address" className="min-w-[9rem] flex-1">
                    <Input
                      id="owner-print-address"
                      value={form.address}
                      placeholder="192.168.1.101"
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      data-testid="owner-print-address"
                    />
                  </Field>
                  <Field label="Port" htmlFor="owner-print-port" className="min-w-[6rem] flex-1">
                    <Input
                      id="owner-print-port"
                      inputMode="numeric"
                      value={String(form.port)}
                      onChange={(e) => setForm({ ...form, port: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                      data-testid="owner-print-port"
                    />
                  </Field>
                </>
              ) : null}
            </div>

            <Toggle
              checked={form.enabled}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              label="Use this machine"
              consequence="Switched off, its tickets go to the main kitchen printer. That is a decision — a machine that simply stops answering is a fault, and the screen says so differently."
              testId="owner-print-enabled"
            />
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

/* ── Templates ─────────────────────────────────────────────────────────── */

function TemplatesPanel({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const stored = (data.settings.print ?? {}) as Record<string, unknown>;
  const [kind, setKind] = React.useState<TicketKind>('kot');

  const initial = React.useCallback(
    (k: TicketKind): TemplateConfig => ({ ...defaultTemplate(k), ...((stored[k] as Partial<TemplateConfig>) ?? {}) }),
    // `stored` is a fresh object on every payload, and re-deriving the draft from it would
    // discard what the owner is halfway through typing. The draft is seeded once per kind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [config, setConfig] = React.useState<TemplateConfig>(() => initial('kot'));
  const switchKind = (k: TicketKind): void => {
    setKind(k);
    setConfig(initial(k));
  };

  // `restaurant` is the raw row, so every value is narrowed at the point it is read rather
  // than by a cast that would be a promise this payload does not make.
  const restaurant = data.restaurant as { name?: string; address?: string; phone?: string };
  const tax = (data.settings.tax ?? {}) as { gstin?: string };
  const engagement = (data.settings.engagement ?? {}) as { upiId?: string };

  const items = previewRound(data.menu);
  const subtotal = items.reduce((a, i) => a + i.rate * i.qty, 0);
  const taxRate = typeof (data.settings.tax as { rate?: number } | undefined)?.rate === 'number'
    ? (data.settings.tax as { rate: number }).rate
    : 5;
  const billTax = Math.round(subtotal * (taxRate / 100));

  /**
   * The identifiers are the only invented values on this ticket, and they are invented on
   * purpose: a preview must not carry a real bill number, or somebody will pick the paper up and
   * go looking for table T12's outstanding round. Everything that affects whether the template
   * FITS — the names, the prices, the categories, the restaurant's own header — is real.
   */
  const sample: TicketData = {
    restaurant: (restaurant.name || 'Jalsa Restaurant').toUpperCase(),
    branch: restaurant.address || '',
    phone: restaurant.phone || '',
    gstin: tax.gstin || '—',
    kotCode: 'KOT-0000',
    roundCode: 'R-0',
    billCode: 'B-0000',
    table: 'PREVIEW',
    customer: 'Preview',
    captain: 'Preview',
    date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }),
    source: 'Guest phone',
    note: 'Preview of the longest note this template can carry without clipping',
    items,
    totals: {
      subtotal,
      discount: 0,
      tax: billTax,
      payable: subtotal + billTax,
      paymentMode: 'UPI',
    },
    ...(engagement.upiId ? { upiId: engagement.upiId } : {}),
  };

  const verdict = validateTemplate(kind, sample, config);
  const lines = buildTicket(kind, sample, config);
  const defs = fieldsFor(kind);
  const order = printOrder(config, kind);
  const canEdit = data.grants.includes('set.printer');

  const move = (key: string, dir: -1 | 1): void => {
    const arr = [...order];
    const i = arr.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    const a = arr[i]!;
    const b = arr[j]!;
    arr[i] = b;
    arr[j] = a;
    setConfig({ ...config, order: arr });
  };

  const toggleField = (key: string, label: string): void => {
    if ((LOCKED_FIELDS as readonly string[]).includes(key)) {
      toast.show(`${label} cannot be switched off — the ticket is useless without it`, { tone: 'error' });
      return;
    }
    setConfig({ ...config, on: { ...config.on, [key]: config.on[key] === false } });
  };

  const onCount = order.filter((k) => config.on[k] !== false).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip on={kind === 'kot'} onClick={() => switchKind('kot')} data-testid="owner-print-kind-kot">
          Kitchen ticket
        </Chip>
        <Chip on={kind === 'bill'} onClick={() => switchKind('bill')} data-testid="owner-print-kind-bill">
          Bill
        </Chip>
      </div>

      <p className="m-0 max-w-prose type-caption leading-relaxed text-[var(--text-muted)]">
        {kind === 'kot'
          ? 'What the kitchen holds in their hand. Every control here is a character-grid decision, not a styling one.'
          : 'What the guest takes away. Same grid, same rules, different content.'}
      </p>

      {/* A PREVIEW BUILT FROM NOTHING VALIDATES NOTHING, and an empty ticket passes every check
          there is — which is exactly what a clean codebase and an unparsed one look like to the
          same detector. So the panel says so rather than showing a green verdict. */}
      {items.length === 0 ? (
        <p
          data-testid="owner-print-no-menu"
          className="m-0 rounded-[var(--radius-md)] bg-[var(--warning-surface)] px-4 py-3 type-caption leading-relaxed text-[var(--on-warning-surface)]"
        >
          <strong>Nothing can be validated yet.</strong> The preview is built from this
          restaurant&rsquo;s own menu, because the question a template has to answer is whether{' '}
          <em>your</em> longest dish name fits on the paper. With no menu items there is nothing to
          measure, and a green verdict here would mean only that an empty ticket fits.
        </p>
      ) : null}

      {/* PAPER AND FIT. The width chips are the one control that changes what everything else
          means, so the grid facts sit directly under them rather than in a panel of their own. */}
      <Card className="flex flex-col gap-3">
        <SectionLabel>Paper and fit</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {(['58', '80'] as PaperWidth[]).map((w) => (
            <Chip
              key={w}
              on={config.width === w}
              onClick={() => setConfig({ ...config, width: w, printableMm: PAPER[w].printable })}
              data-testid={`owner-print-width-${w}`}
            >
              {w} mm
            </Chip>
          ))}
          <span className="w-2" />
          {(['small', 'normal', 'large'] as FontSize[]).map((f) => (
            <Chip
              key={f}
              on={config.font === f}
              onClick={() => setConfig({ ...config, font: f })}
              data-testid={`owner-print-font-${f}`}
            >
              {f === 'small' ? 'Small' : f === 'normal' ? 'Normal' : 'Large'}
            </Chip>
          ))}
        </div>

        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
          {[
            { k: 'Paper width', v: `${PAPER[config.width].mm} mm` },
            { k: 'Printable', v: `${config.printableMm} mm` },
            { k: 'Characters a line', v: String(verdict.cols) },
            { k: 'Ticket length', v: `${verdict.lineCount} lines` },
          ].map((f) => (
            <div key={f.k}>
              <dt className="m-0 type-caption text-[var(--text-muted)]">{f.k}</dt>
              <dd className="m-0 type-caption font-semibold tabular-nums">{f.v}</dd>
            </div>
          ))}
        </dl>

        <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
          A thermal printer has no pixels — it has {verdict.cols} character positions on this paper at this size. Every
          line below is measured against that number, which is why 58 mm is a different layout and not a smaller
          picture.
        </p>
      </Card>

      {/* LINES ON THE TICKET */}
      <Card className="flex flex-col gap-3">
        <SectionLabel>
          Lines on the ticket — {onCount} of {defs.length} on
        </SectionLabel>
        <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
          Switch a line off and it leaves the ticket. Move it and the ticket reorders. Empty lines never print.
        </p>
        <ul className="m-0 flex list-none flex-col gap-1 p-0" data-testid="owner-print-fields">
          {order.map((key) => {
            const def = defs.find((d) => d.key === key);
            if (!def) return null;
            const on = config.on[key] !== false;
            const locked = (LOCKED_FIELDS as readonly string[]).includes(key);
            return (
              <li
                key={key}
                className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className={`block type-caption font-semibold ${on ? '' : 'text-[var(--text-muted)]'}`}>
                    {def.label}
                  </span>
                  <span className="block type-caption text-[var(--text-muted)]">
                    {def.band}
                    {def.hint ? ` · ${def.hint}` : ''}
                  </span>
                </span>
                <Button
                  data-testid={`owner-print-field-${key}`}
                  size="sm"
                  variant="ghost"
                  disabled={!canEdit}
                  onClick={() => toggleField(key, def.label)}
                >
                  {locked ? 'Always on' : on ? 'On' : 'Off'}
                </Button>
                <Button
                  data-testid={`owner-print-up-${key}`}
                  size="sm"
                  variant="ghost"
                  disabled={!canEdit}
                  aria-label={`Move ${def.label} up`}
                  onClick={() => move(key, -1)}
                >
                  ↑
                </Button>
                <Button
                  data-testid={`owner-print-down-${key}`}
                  size="sm"
                  variant="ghost"
                  disabled={!canEdit}
                  aria-label={`Move ${def.label} down`}
                  onClick={() => move(key, 1)}
                >
                  ↓
                </Button>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* LAYOUT AND GROUPING */}
      <Card className="flex flex-col gap-3">
        <SectionLabel>How each item line reads</SectionLabel>
        <div className="flex flex-col gap-2">
          {(
            [
              { k: 'A' as ItemLayout, name: 'Name left, quantity right', sample: 'Chicken 65                 2' },
              { k: 'B' as ItemLayout, name: 'Quantity first', sample: '2 x Chicken 65' },
              { k: 'C' as ItemLayout, name: 'Name on its own line', sample: 'Chicken Tandoori Half / x1' },
            ]
          ).map((o) => (
            <Button
              key={o.k}
              data-testid={`owner-print-layout-${o.k}`}
              variant={config.layout === o.k ? 'secondary' : 'ghost'}
              size="sm"
              disabled={!canEdit}
              className="w-full justify-between"
              onClick={() => setConfig({ ...config, layout: o.k })}
            >
              <span>{o.name}</span>
              <span className="font-mono text-[var(--text-muted)]">
                {o.sample}
                {o.k === 'A' && config.width === '58' ? ' · tight at 58 mm' : ''}
              </span>
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ['dash', '- - - -'],
              ['equals', '= = = ='],
              ['dot', '. . . .'],
            ] as Array<[Separator, string]>
          ).map(([k, label]) => (
            <Chip
              key={k}
              on={config.separator === k}
              onClick={() => setConfig({ ...config, separator: k })}
              data-testid={`owner-print-sep-${k}`}
            >
              {label}
            </Chip>
          ))}
        </div>

        {kind === 'kot' ? (
          <>
            <Toggle
              checked={config.group}
              onCheckedChange={(v) => setConfig({ ...config, group: v })}
              label="Group items under VEG, NON-VEG and EGG"
              consequence="Each group prints its own heading band, so the person on the veg side never reads a chicken line."
              testId="owner-print-group"
              disabled={!canEdit}
            />
            <Toggle
              checked={config.hideEmpty}
              onCheckedChange={(v) => setConfig({ ...config, hideEmpty: v })}
              label="Hide a group when nothing in the round belongs to it"
              testId="owner-print-hide-empty"
              disabled={!canEdit}
            />
          </>
        ) : null}
      </Card>

      {/* PREVIEW — the same strings a printer would be handed. */}
      <Card className="flex flex-col gap-3">
        <SectionLabel>
          Preview · {PAPER[config.width].mm} mm · {verdict.cols} characters
        </SectionLabel>
        <pre
          data-testid="owner-print-preview"
          className="m-0 overflow-x-auto rounded-[var(--radius-md)] bg-[var(--surface-sunken)] p-4 font-mono type-caption leading-normal"
        >
          {lines.map((l) => l.text).join('\n')}
        </pre>
        <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
          Every line above was built by the same module a printer would be handed, wrapped on the character grid rather
          than by the browser. What fits here fits on the paper.
        </p>
      </Card>

      {/* VALIDATION — and the save it blocks. */}
      <Card className="flex flex-col gap-3" data-testid="owner-print-validation">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel className="mb-0">Validation</SectionLabel>
          <Pill tone={verdict.canSave ? 'success' : 'error'}>
            {verdict.canSave ? 'Ready to save' : 'Will not save'}
          </Pill>
        </div>

        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {verdict.checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2 type-caption leading-relaxed">
              <span aria-hidden className={c.ok ? 'text-[var(--success)]' : 'text-[var(--error)]'}>
                {c.ok ? '✓' : '⚠'}
              </span>
              <span className={c.ok ? 'text-[var(--text-muted)]' : 'font-semibold text-[var(--error)]'}>{c.label}</span>
            </li>
          ))}
        </ul>

        {verdict.canSave ? null : (
          <p className="m-0 rounded-[var(--radius-md)] bg-[var(--error-surface)] px-4 py-3 type-caption leading-relaxed text-[var(--on-error-surface)]">
            {verdict.failures.join('. ')}. Fix this before saving — an over-width line does not shrink on a thermal
            printer, it disappears.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {verdict.canSave ? null : (
            <Button
              variant="secondary"
              size="sm"
              disabled={!canEdit}
              data-testid="owner-print-autofit"
              onClick={() => {
                const fixed = autoFit(kind, sample, config);
                setConfig(fixed);
                toast.show(`Adjusted to fit ${PAPER[fixed.width].mm} mm — check the preview before saving`, {
                  tone: 'success',
                });
              }}
            >
              Fix automatically
            </Button>
          )}
          <Button
            size="sm"
            data-testid="owner-print-save-template"
            disabled={busy || !canEdit || !verdict.canSave || items.length === 0}
            onClick={() =>
              runBusy(async () => {
                await send('/api/owner/action', {
                  action: 'write-setting',
                  key: 'print',
                  value: { [kind]: config },
                });
                toast.show(`${kind === 'kot' ? 'Kitchen ticket' : 'Bill'} template saved for ${PAPER[config.width].mm} mm`, {
                  tone: 'success',
                });
              })
            }
          >
            {items.length === 0 ? 'Nothing to validate against' : verdict.canSave ? 'Save template' : 'Cannot save yet'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ── Routing ───────────────────────────────────────────────────────────── */

function RoutingPanel({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const printers = data.printers.map(toRoutable);
  const kotPrinters = data.printers.filter((p) => p.purpose === 'KOT');
  const canEdit = data.grants.includes('set.printer');
  const fallback = mainPrinter('KOT', printers);
  const printCfg = (data.settings.print ?? {}) as { splitByFoodType?: boolean };
  const split = printCfg.splitByFoodType === true;

  /**
   * MOVING A CATEGORY IS TWO WRITES, AND THAT IS DELIBERATE.
   *
   * A category belongs to exactly one machine, so pointing it at a new one means removing it from
   * whichever machine held it. Done as one "routing" blob it would be a third place routing
   * lives; done as two printer writes it stays where `resolvePrinter` reads it. The removal goes
   * first, so a failure between the two leaves a category unrouted — which falls back to the main
   * kitchen — rather than claimed by two machines, which would print it twice.
   */
  const route = (category: string, toPrinterId: string): void => {
    void runBusy(async () => {
      const from = data.printers.find((p) => p.routes.some((r) => r.toLowerCase() === category.toLowerCase()));
      const to = data.printers.find((p) => p.id === toPrinterId) ?? null;

      if (from && from.id !== toPrinterId) {
        await send('/api/owner/action', {
          action: 'upsert-printer',
          id: from.id,
          machineId: from.machineId,
          name: from.name,
          purpose: from.purpose,
          station: from.station,
          paperMm: from.paperMm,
          connection: from.connection,
          address: from.address,
          port: from.port,
          routes: from.routes.filter((r) => r.toLowerCase() !== category.toLowerCase()),
          enabled: from.enabled,
        });
      }

      if (to && !to.routes.some((r) => r.toLowerCase() === category.toLowerCase())) {
        await send('/api/owner/action', {
          action: 'upsert-printer',
          id: to.id,
          machineId: to.machineId,
          name: to.name,
          purpose: to.purpose,
          station: to.station,
          paperMm: to.paperMm,
          connection: to.connection,
          address: to.address,
          port: to.port,
          routes: [...to.routes, category],
          enabled: to.enabled,
        });
      }

      toast.show(
        to ? `${category} → ${to.station} → ${to.name}` : `${category} unrouted — it falls to the main kitchen`,
        { tone: 'success' }
      );
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 max-w-prose type-caption leading-relaxed text-[var(--text-muted)]">
        Which machine prints which items. A category nobody claims lands on the main kitchen printer — which is what
        makes it the main kitchen printer.
      </p>

      {data.categories.length === 0 ? (
        <FirstRunState
          title="There are no menu categories yet"
          note="Routing runs category → station → printer, so it has nothing to route until the menu has categories."
          testId="owner-print-routing-empty"
        />
      ) : (
        <Card className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_auto] gap-2 type-caption text-[var(--text-muted)] sm:grid-cols-[1fr_1fr_auto]">
            <span>Menu category</span>
            <span className="hidden sm:block">Station</span>
            <span>Printer</span>
          </div>
          <ul className="m-0 flex list-none flex-col gap-1 p-0" data-testid="owner-print-routes">
            {data.categories.map((c) => {
              const decision = resolvePrinter({ purpose: 'KOT', category: c.name, printers });
              const claimed = data.printers.find((p) =>
                p.routes.some((r) => r.trim().toLowerCase() === c.name.trim().toLowerCase())
              );
              return (
                <li
                  key={c.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-3 py-2 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <span className="min-w-0">
                    <span className="block type-caption font-semibold">{c.name}</span>
                    <span className="block type-caption text-[var(--text-muted)]">
                      {c.count} {c.count === 1 ? 'item' : 'items'}
                    </span>
                  </span>
                  <span className="hidden type-caption sm:block">
                    {decision.station || '—'}
                    {decision.rule === 'fallback' ? (
                      <span className="block type-caption text-[var(--error)]">printing at the main kitchen</span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-2">
                    {/* SEARCH ONLY — no `allowCreate`. A printer is a machine on a network
                        with an address and a paper width; it is added in the Machines section,
                        not conjured from a routing row. The option list is `kotPrinters`, so it
                        is however many machines exist: nothing here is sized to a count. */}
                    <Combobox
                      ariaLabel={`Printer for ${c.name}`}
                      testId={`owner-print-route-${c.id}`}
                      value={claimed?.id ?? ''}
                      disabled={!canEdit || busy}
                      onValueChange={(printerId) => route(c.name, printerId)}
                      options={[
                        { value: '', label: fallback ? `${fallback.name} (unrouted)` : 'No machine' },
                        ...kotPrinters.map((p) => ({ value: p.id, label: p.name, hint: p.station })),
                      ]}
                      placeholder="Search machines"
                      emptyLabel="No matching machines"
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <SectionLabel>Food type splits the kitchen ticket</SectionLabel>
        <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
          Routing decides the machine. Food type decides how many tickets come out of it — one combined, or a veg ticket
          and a non-veg ticket so the two sides of the kitchen never share paper. Egg travels with veg: one fryer, one
          side.
        </p>
        <Toggle
          checked={split}
          onCheckedChange={(v) =>
            runBusy(async () => {
              await send('/api/owner/action', {
                action: 'write-setting',
                key: 'print',
                value: { splitByFoodType: v },
              });
              toast.show(v ? 'Veg and non-veg now print separately' : 'One ticket per station again', {
                tone: 'success',
              });
            })
          }
          label="Print veg and non-veg as separate tickets"
          testId="owner-print-split"
          disabled={!canEdit || busy}
        />
      </Card>

      <p className="m-0 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-4 py-3 type-caption leading-relaxed text-[var(--text-muted)]">
        <strong>Fallback.</strong> When a station printer does not answer, its tickets go to{' '}
        {fallback ? fallback.name : 'the main kitchen printer'} with the station name on the header rather than
        vanishing. A ticket on the wrong machine is a problem somebody can see; a ticket that never printed looks
        exactly like a round that was never placed.
      </p>
    </div>
  );
}

/* ── History ───────────────────────────────────────────────────────────── */

const FILTERS = ['All', 'KOT', 'Invoice', 'Failed'] as const;

function HistoryPanel({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]>('All');
  const canRetry = data.grants.includes('orders.reprint');

  /**
   * The job an operator is redirecting, and where to. Held here rather than on the row because
   * choosing a machine is a decision with a confirmation, not a click — the whole point of
   * "Print elsewhere" is that nothing sends a ticket to a different machine without somebody
   * saying which machine and meaning it.
   */
  const [redirecting, setRedirecting] = React.useState<PrintJobRow | null>(null);
  const [redirectTo, setRedirectTo] = React.useState('');

  const alternatives = data.printers.filter(
    (p) => p.purpose === redirecting?.kind && p.enabled && p.id !== redirecting?.printerId
  );

  const jobs = data.printJobs.filter(
    (j) => filter === 'All' || j.kind === filter || (filter === 'Failed' && j.status === 'failed')
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 max-w-prose type-caption leading-relaxed text-[var(--text-muted)]">
        Every ticket the system tried to print tonight, and what happened to it. A failed ticket never means a lost
        round — the order is saved before a machine is asked for anything.
      </p>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Chip key={f} on={filter === f} onClick={() => setFilter(f)} data-testid={`owner-print-filter-${f}`}>
            {f === 'Invoice' ? 'Bills' : f === 'KOT' ? 'Kitchen' : f}
          </Chip>
        ))}
      </div>

      {jobs.length === 0 ? (
        <FirstRunState
          title={filter === 'All' ? 'Nothing has been printed yet' : `No ${filter.toLowerCase()} tickets`}
          note="Tickets appear here the moment a round is placed or a bill is closed, whether or not a machine answered."
          testId="owner-print-history-empty"
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="owner-print-history">
          {jobs.map((j) => (
            <li key={j.id}>
              <Card className="flex flex-wrap items-center gap-3">
                <span className="shrink-0 type-caption tabular-nums text-[var(--text-muted)]">
                  {new Date(j.createdAt).toLocaleTimeString('en-IN', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </span>

                <span className="min-w-[10rem] flex-1">
                  <span className="block type-body font-semibold">
                    {j.reference}
                    {j.isReprint ? ' · reprint' : ''}
                  </span>
                  <span className="block type-caption text-[var(--text-muted)]">
                    {j.kind === 'KOT' ? 'Kitchen ticket' : 'Bill'} · table {j.table}
                    {/* The station AND the machine. Either one alone leaves the question that
                        sends somebody to the wrong room: a fallback ticket is stamped for one
                        station and comes out at another, and only both facts say so. */}
                    {j.station ? ` · ${j.station}` : ''} · {j.printerName}
                    {j.routingRule === 'fallback' ? ' (stand-in)' : ''}
                    {j.routingRule === 'chosen' ? ' (sent here by hand)' : ''}
                    {j.redirectedFromJobId ? ' · redirected' : ''}
                    {j.lastError ? ` · ${j.lastError}` : ''}
                  </span>
                </span>

                <span className="shrink-0 type-caption tabular-nums text-[var(--text-muted)]">
                  {j.attempts} {j.attempts === 1 ? 'try' : 'tries'}
                </span>

                {/* One vocabulary for a print status, shared with every screen that shows a
                    round. "Waiting to print" is what a queued job IS now — assigned, undelivered
                    — and it must not read as "printed". */}
                <Pill tone={PRINT_STATUS[j.status].tone}>{PRINT_STATUS[j.status].word}</Pill>

                {canRetry && j.status !== 'printed' && j.printerId ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    data-testid={`owner-print-retry-${j.id}`}
                    onClick={() =>
                      runBusy(async () => {
                        const res = await send<{ printerName: string; station: string }>('/api/owner/action', {
                          action: 'retry-print',
                          jobId: j.id,
                        });
                        toast.show(`${j.reference} re-sent to ${res.printerName} · ${res.station}`);
                      })
                    }
                  >
                    {/* Names the machine, because the operator's next question after "it failed"
                        is "where", and the button used to answer it with "Try again". */}
                    Retry on {printerShortName(j.printerName)}
                  </Button>
                ) : null}

                {canRetry && j.status !== 'printed' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    data-testid={`owner-print-elsewhere-${j.id}`}
                    onClick={() => {
                      setRedirecting(j);
                      setRedirectTo('');
                    }}
                  >
                    Print elsewhere
                  </Button>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="m-0 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-4 py-3 type-caption leading-relaxed text-[var(--text-muted)]">
        <strong>Three different things, and they are not interchangeable.</strong> <em>Retry</em> sends a ticket that
        never came out to the same machine again, so the paper carries no mark. <em>Print elsewhere</em> sends it to a
        machine you choose, and only ever one you choose. <em>Reprint</em> — from the round itself, on Live orders —
        re-issues a ticket that <em>did</em> print and stamps <span className="font-mono">*** REPRINT ***</span> across
        the top, because without it a cook reads the same round twice and the table gets two of everything.
      </p>

      <Sheet
        open={redirecting !== null}
        onOpenChange={(open) => {
          if (!open) setRedirecting(null);
        }}
        posture="modal"
        title="Print elsewhere"
        description={
          redirecting
            ? `${redirecting.reference} was assigned to ${redirecting.printerName}${
                redirecting.station ? ` for ${redirecting.station}` : ''
              }. Choose the machine it should come out of instead.`
            : ''
        }
        testId="owner-print-elsewhere-sheet"
        footer={
          <>
            <Button variant="secondary" data-testid="owner-print-elsewhere-cancel" onClick={() => setRedirecting(null)}>
              Cancel
            </Button>
            <Button
              // No default, ever. The whole value of this control is that a ticket reaches a
              // second machine only because a person named it.
              disabled={busy || !redirectTo}
              data-testid="owner-print-elsewhere-confirm"
              onClick={() =>
                runBusy(async () => {
                  const job = redirecting;
                  if (!job) return;
                  const res = await send<{ printerName: string; station: string }>('/api/owner/action', {
                    action: 'print-elsewhere',
                    jobId: job.id,
                    printerId: redirectTo,
                  });
                  setRedirecting(null);
                  toast.show(`${job.reference} sent to ${res.printerName} · ${res.station}`);
                })
              }
            >
              Send it there
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {alternatives.length === 0 ? (
            <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
              There is no other machine switched on that prints {redirecting?.kind === 'KOT' ? 'kitchen tickets' : 'bills'}.
              Switch one on under Printers first.
            </p>
          ) : (
            <Field label="Machine" htmlFor="owner-print-elsewhere-printer">
              <Combobox
                id="owner-print-elsewhere-printer"
                value={redirectTo}
                onValueChange={setRedirectTo}
                options={alternatives.map((p) => ({ value: p.id, label: `${p.name} · ${p.station}` }))}
                placeholder="Choose a machine"
                testId="owner-print-elsewhere-picker"
                ariaLabel="Machine to print at instead"
              />
            </Field>
          )}

          <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
            This writes a new ticket against the machine you pick and keeps the original on the record, so the history
            still shows where the round was meant to go.
          </p>
        </div>
      </Sheet>
    </div>
  );
}
