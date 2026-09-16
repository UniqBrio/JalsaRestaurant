'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, Chip, Pill, SectionLabel } from '@/components/ui/atoms';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { rupees } from '@/lib/money';
import {
  DEDUCTION_LINES,
  EARNING_LINES,
  longDate,
  merge,
  missingFields,
  monthName,
  payslipTotals,
  pronounsFor,
  readinessLine,
  rupeesInWords,
  type DocumentKind,
  type EmploymentRecord,
  type Merged,
  type RestaurantIdentity,
} from '@/lib/hr-documents';
import type { StaffMember } from '@/lib/db/types';
import type { OwnerSectionProps } from '../OwnerConsole';

/**
 * Staff paperwork — offer letter, experience certificate, payslip.
 *
 * `Jalsa Navigation Flowchart.dc.html`, section six: *"Staff record → Offer letter · Experience
 * certificate · Payslip. Variables merge from the employment record and the restaurant identity.
 * Anything unfilled prints as a marked placeholder so nothing is signed blank."*
 *
 * WHY THE PLACEHOLDER IS LOUD
 *   Two of these three get signed by the employee. A merge that dropped a missing value would
 *   produce "a gross monthly salary of  , subject to applicable statutory deductions" — which
 *   reads as a typo and is a blank cheque. So `merge()` returns `[MONTHLY SALARY]`, and this
 *   screen paints it on the error surface: visible on the paper, and visible on the screen
 *   before anybody reaches the printer.
 *
 * WHY THE FORM IS BESIDE THE DOCUMENT AND NOT BEHIND IT
 *   Every missing field is one the person has, in their head, right now. A flow that sent them
 *   back to the Staff editor to fill a department and then forward again to print is a flow
 *   where the document gets printed with the placeholder still on it.
 *
 * WHAT IS NOT BUILT: this prints through the browser, which is what the design's own
 * "Print or save as PDF" button does. It does not go to the thermal machines — a letter on 80 mm
 * till roll is not a letter.
 */

const KINDS: Array<{ key: DocumentKind; label: string }> = [
  { key: 'offer', label: 'Offer letter' },
  { key: 'experience', label: 'Experience certificate' },
  { key: 'payslip', label: 'Payslip' },
];

/** A merged value, painted so a placeholder cannot be skimmed past. */
function Val({ v }: { v: Merged }) {
  return v.placeholder ? (
    <span className="rounded-[var(--radius-sm)] bg-[var(--error-surface)] px-1 font-semibold text-[var(--on-error-surface)]">
      {v.text}
    </span>
  ) : (
    <span>{v.text}</span>
  );
}

const asRecord = (p: StaffMember): EmploymentRecord => ({
  name: p.name,
  employeeCode: p.employment.employeeCode,
  designation: p.employment.designation,
  department: p.employment.department,
  joinedOn: p.employment.joinedOn,
  lastWorkingDay: p.employment.lastWorkingDay,
  gender: p.employment.gender,
  employmentType: p.employment.employmentType,
  monthlySalary: p.employment.monthlySalary,
  reportsTo: p.employment.reportsTo,
  shift: p.employment.shift,
  mobile: p.mobile,
  email: p.employment.email,
  homeAddress: p.employment.homeAddress,
  pan: p.employment.pan,
  uan: p.employment.uan,
  bankLast4: p.employment.bankLast4,
});

const today = (): string => new Date().toISOString().slice(0, 10);
const thisMonth = (): string => new Date().toISOString().slice(0, 7);

export function StaffPaperwork({
  person,
  onClose,
  data,
  send,
  runBusy,
  busy,
}: Pick<OwnerSectionProps, 'data' | 'send' | 'runBusy' | 'busy'> & {
  /** Never null: the caller mounts this only when somebody is open, keyed by their id. */
  person: StaffMember;
  onClose: () => void;
}) {
  const toast = useToast();
  const [kind, setKind] = React.useState<DocumentKind>('offer');

  const canEdit = data.grants.includes('staff.paperwork');
  const restaurant = data.restaurant as {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    signatory_name?: string;
    signatory_role?: string;
  };
  const employment = (data.settings.employment ?? {}) as {
    probation?: string;
    notice?: string;
    workLocation?: string;
    duties?: string;
    qualities?: string;
  };

  const identity: RestaurantIdentity = {
    name: restaurant.name ?? '',
    address: restaurant.address ?? '',
    phone: restaurant.phone ?? '',
    email: restaurant.email ?? '',
    signatoryName: restaurant.signatory_name ?? '',
    signatoryRole: restaurant.signatory_role ?? '',
  };

  /**
   * The editable half of a document.
   *
   * Split from the employment record deliberately: a probation period and a duties sentence
   * belong to THIS letter, while a designation belongs to the person. The first is drafted here
   * and thrown away; the second is saved and merges into every document afterwards.
   */
  const [terms, setTerms] = React.useState({
    letterDate: today(),
    probation: employment.probation ?? '3 months',
    notice: employment.notice ?? '30 days',
    workLocation: employment.workLocation ?? '',
    duties: employment.duties ?? '',
    qualities: employment.qualities ?? 'professionalism, punctuality, teamwork and consistent customer service',
    month: thisMonth(),
    payDate: today(),
    payableDays: '30',
    paidDays: '30',
    lopDays: '0',
    paymentMode: 'Bank transfer',
    preparedBy: '',
  });

  const [pay, setPay] = React.useState<Record<string, string>>({});

  /**
   * SEEDED ONCE, THEN OWNED BY THE FORM.
   *
   * Re-deriving this from the payload on every poll would wipe whatever somebody is halfway
   * through typing — and this form is typed into for minutes at a time. The caller mounts this
   * component with `key={person.id}`, so opening a different person remounts it and the
   * initialiser runs again. That is the remount, not a ref compared during render.
   */
  const [record, setRecord] = React.useState<EmploymentRecord>(() => asRecord(person));

  const numeric = (v: string | undefined): number | null => {
    const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''));
    return String(v ?? '').trim() === '' ? null : Number.isFinite(n) ? n : null;
  };
  const payValues = (defs: Array<[string, string]>): Record<string, number | null> =>
    Object.fromEntries(defs.map(([key]) => [key, numeric(pay[key])]));

  const payslip = {
    month: terms.month,
    payDate: terms.payDate,
    payableDays: terms.payableDays,
    paidDays: terms.paidDays,
    lopDays: terms.lopDays,
    paymentMode: terms.paymentMode,
    preparedBy: terms.preparedBy,
    earnings: payValues(EARNING_LINES),
    deductions: payValues(DEDUCTION_LINES),
  };

  const missing = missingFields({
    kind,
    record,
    identity,
    offer: {
      letterDate: terms.letterDate,
      probation: terms.probation,
      notice: terms.notice,
      workLocation: terms.workLocation,
    },
    certificate: { letterDate: terms.letterDate, duties: terms.duties, qualities: terms.qualities },
    payslip,
  });

  const totals = payslipTotals(payslip);
  const pronouns = pronounsFor(record.gender);
  const firstName = record.name.split(/\s+/)[0] ?? '';

  const m = {
    name: merge(record.name, 'Employee full name'),
    first: merge(firstName, 'Employee name'),
    designation: merge(record.designation, 'Job title'),
    department: merge(record.department, 'Department'),
    joined: merge(longDate(record.joinedOn), 'Date of joining'),
    left: merge(longDate(record.lastWorkingDay), 'Last working date'),
    salary: merge(record.monthlySalary ? rupees(record.monthlySalary) : '', 'Monthly salary'),
    salaryWords: merge(record.monthlySalary ? `Rupees ${rupeesInWords(record.monthlySalary)}` : '', 'Salary in words'),
    address: merge(record.homeAddress, 'Employee address'),
    rName: merge(identity.name, 'Restaurant name'),
    rAddress: merge(identity.address, 'Restaurant address'),
    authName: merge(identity.signatoryName, 'Authorised person name'),
    authRole: merge(identity.signatoryRole, 'Designation'),
    letterDate: merge(longDate(terms.letterDate), 'Date'),
    notice: merge(terms.notice, 'Notice period'),
    duties: merge(terms.duties, 'Brief description of responsibilities'),
    qualities: merge(terms.qualities, 'Professionalism / punctuality / teamwork'),
    month: merge(monthName(terms.month), 'Month and year'),
    payDate: merge(longDate(terms.payDate), 'Payment date'),
    preparedBy: merge(terms.preparedBy, 'Name / designation'),
  };

  const saveRecord = (): void => {
    void runBusy(async () => {
      await send('/api/owner/action', {
        action: 'write-employment',
        staffId: person.id,
        patch: {
          employeeCode: record.employeeCode,
          designation: record.designation,
          department: record.department,
          joinedOn: record.joinedOn,
          lastWorkingDay: record.lastWorkingDay,
          gender: record.gender,
          employmentType: record.employmentType,
          monthlySalary: record.monthlySalary,
          reportsTo: record.reportsTo,
          shift: record.shift,
          email: record.email,
          homeAddress: record.homeAddress,
          pan: record.pan,
          uan: record.uan,
          bankLast4: record.bankLast4,
        },
      });
      toast.show(`${person.name}'s employment record saved — it merges into every document`, { tone: 'success' });
    });
  };

  const set = <K extends keyof EmploymentRecord>(key: K, value: EmploymentRecord[K]): void =>
    setRecord({ ...record, [key]: value });

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      posture="modal"
      title={`Paperwork — ${person.name}`}
      description="Offer letter, experience certificate and payslip, merged from the employment record."
      testId="owner-paperwork"
      footer={
        <>
          <Button data-testid="owner-paperwork-close" variant="ghost" onClick={onClose}>
            Close
          </Button>
          {canEdit ? (
            <Button data-testid="owner-paperwork-save" variant="secondary" disabled={busy} onClick={saveRecord}>
              Save the record
            </Button>
          ) : null}
          <Button
            data-testid="owner-paperwork-print"
            disabled={missing.length > 0}
            onClick={() => window.print()}
          >
            {missing.length ? 'Fill the blanks first' : 'Print or save as PDF'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <Chip
              key={k.key}
              on={kind === k.key}
              onClick={() => setKind(k.key)}
              data-testid={`owner-paperwork-${k.key}`}
            >
              {k.label}
            </Chip>
          ))}
        </div>

        {/* READINESS — named fields, not a count. "7 fields still to fill" sends somebody
            hunting; three names send them to the right part of the form. */}
        <p
          data-testid="owner-paperwork-readiness"
          className={
            missing.length
              ? 'm-0 rounded-[var(--radius-md)] bg-[var(--error-surface)] px-4 py-3 type-caption leading-relaxed text-[var(--on-error-surface)]'
              : 'm-0 rounded-[var(--radius-md)] bg-[var(--success-surface)] px-4 py-3 type-caption leading-relaxed text-[var(--on-success-surface)]'
          }
        >
          {readinessLine(missing, person.name)}
        </p>

        {/* THE EMPLOYMENT RECORD — saved, and merges into every document afterwards. */}
        <Card className="flex flex-col gap-3">
          <SectionLabel>The employment record</SectionLabel>
          <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
            Saved against {firstName || 'this person'} and merged into all three documents. The restaurant block — name,
            address, phone, signatory — comes from Settings › Restaurant details, so editing it there changes every
            document at once.
          </p>

          <div className="flex flex-wrap gap-3">
            <Field label="Employee ID" htmlFor="owner-hr-code" className="min-w-[8rem] flex-1">
              <Input
                id="owner-hr-code"
                data-testid="owner-hr-code"
                value={record.employeeCode}
                disabled={!canEdit}
                onChange={(e) => set('employeeCode', e.target.value)}
              />
            </Field>
            <Field label="Designation" required htmlFor="owner-hr-designation" className="min-w-[9rem] flex-1">
              <Input
                id="owner-hr-designation"
                data-testid="owner-hr-designation"
                value={record.designation}
                disabled={!canEdit}
                onChange={(e) => set('designation', e.target.value)}
              />
            </Field>
            <Field label="Department" required htmlFor="owner-hr-department" className="min-w-[8rem] flex-1">
              <Input
                id="owner-hr-department"
                data-testid="owner-hr-department"
                value={record.department}
                disabled={!canEdit}
                onChange={(e) => set('department', e.target.value)}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-3">
            <Field label="Date of joining" required htmlFor="owner-hr-joined" className="min-w-[9rem] flex-1">
              <Input
                id="owner-hr-joined"
                data-testid="owner-hr-joined"
                type="date"
                value={record.joinedOn}
                disabled={!canEdit}
                onChange={(e) => set('joinedOn', e.target.value)}
              />
            </Field>
            <Field
              label="Last working day"
              htmlFor="owner-hr-left"
              hint="Only for somebody who has left. An experience certificate cannot be written without it."
              className="min-w-[9rem] flex-1"
            >
              <Input
                id="owner-hr-left"
                data-testid="owner-hr-left"
                type="date"
                value={record.lastWorkingDay}
                disabled={!canEdit}
                onChange={(e) => set('lastWorkingDay', e.target.value)}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-3">
            <Field
              label="Gender"
              htmlFor="owner-hr-gender"
              hint="The certificate's pronouns follow this. Left unset it reads they / their / them, which is correct rather than a guess."
              className="min-w-[9rem] flex-1"
            >
              <Select
                id="owner-hr-gender"
                data-testid="owner-hr-gender"
                value={record.gender}
                disabled={!canEdit}
                onChange={(e) => set('gender', e.target.value)}
              >
                <option value="">Prefer not to say</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </Select>
            </Field>
            <Field label="Employment type" htmlFor="owner-hr-type" className="min-w-[8rem] flex-1">
              <Select
                id="owner-hr-type"
                data-testid="owner-hr-type"
                value={record.employmentType}
                disabled={!canEdit}
                onChange={(e) => set('employmentType', e.target.value)}
              >
                <option value="">Not set</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Trainee">Trainee</option>
              </Select>
            </Field>
            <Field label="Monthly salary" required htmlFor="owner-hr-salary" className="min-w-[8rem] flex-1">
              <Input
                id="owner-hr-salary"
                data-testid="owner-hr-salary"
                inputMode="numeric"
                value={record.monthlySalary === null ? '' : String(record.monthlySalary)}
                disabled={!canEdit}
                onChange={(e) => set('monthlySalary', numeric(e.target.value))}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-3">
            <Field label="Reporting to" htmlFor="owner-hr-reports" className="min-w-[9rem] flex-1">
              <Input
                id="owner-hr-reports"
                data-testid="owner-hr-reports"
                value={record.reportsTo}
                disabled={!canEdit}
                onChange={(e) => set('reportsTo', e.target.value)}
              />
            </Field>
            <Field label="Working hours / shift" htmlFor="owner-hr-shift" className="min-w-[11rem] flex-[2]">
              <Input
                id="owner-hr-shift"
                data-testid="owner-hr-shift"
                value={record.shift}
                disabled={!canEdit}
                onChange={(e) => set('shift', e.target.value)}
              />
            </Field>
          </div>

          <Field label="Home address" htmlFor="owner-hr-address">
            <Textarea
              id="owner-hr-address"
              data-testid="owner-hr-address"
              rows={2}
              value={record.homeAddress}
              disabled={!canEdit}
              onChange={(e) => set('homeAddress', e.target.value)}
            />
          </Field>

          {kind === 'payslip' ? (
            <div className="flex flex-wrap gap-3">
              <Field label="PAN" htmlFor="owner-hr-pan" className="min-w-[8rem] flex-1">
                <Input
                  id="owner-hr-pan"
                  data-testid="owner-hr-pan"
                  value={record.pan}
                  disabled={!canEdit}
                  onChange={(e) => set('pan', e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="UAN" htmlFor="owner-hr-uan" className="min-w-[8rem] flex-1">
                <Input
                  id="owner-hr-uan"
                  data-testid="owner-hr-uan"
                  value={record.uan}
                  disabled={!canEdit}
                  onChange={(e) => set('uan', e.target.value)}
                />
              </Field>
              <Field
                label="Bank account — last 4"
                htmlFor="owner-hr-bank"
                hint="Four digits only. The slip prints XXXX XXXX 5093, which is all it has ever needed, and the whole number is not ours to hold."
                className="min-w-[9rem] flex-1"
              >
                <Input
                  id="owner-hr-bank"
                  data-testid="owner-hr-bank"
                  inputMode="numeric"
                  maxLength={4}
                  value={record.bankLast4}
                  disabled={!canEdit}
                  onChange={(e) => set('bankLast4', e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
              </Field>
            </div>
          ) : null}
        </Card>

        {/* THIS DOCUMENT'S OWN TERMS — drafted here, not saved against the person. */}
        <Card className="flex flex-col gap-3">
          <SectionLabel>{KINDS.find((k) => k.key === kind)?.label} — terms</SectionLabel>

          <div className="flex flex-wrap gap-3">
            <Field label={kind === 'payslip' ? 'Salary month' : 'Letter date'} htmlFor="owner-hr-date" className="min-w-[9rem] flex-1">
              <Input
                id="owner-hr-date"
                data-testid="owner-hr-date"
                type={kind === 'payslip' ? 'month' : 'date'}
                value={kind === 'payslip' ? terms.month : terms.letterDate}
                onChange={(e) =>
                  setTerms(kind === 'payslip' ? { ...terms, month: e.target.value } : { ...terms, letterDate: e.target.value })
                }
              />
            </Field>

            {kind === 'offer' ? (
              <>
                <Field label="Probation period" required htmlFor="owner-hr-probation" className="min-w-[8rem] flex-1">
                  <Input
                    id="owner-hr-probation"
                    data-testid="owner-hr-probation"
                    value={terms.probation}
                    onChange={(e) => setTerms({ ...terms, probation: e.target.value })}
                  />
                </Field>
                <Field label="Notice period" required htmlFor="owner-hr-notice" className="min-w-[8rem] flex-1">
                  <Input
                    id="owner-hr-notice"
                    data-testid="owner-hr-notice"
                    value={terms.notice}
                    onChange={(e) => setTerms({ ...terms, notice: e.target.value })}
                  />
                </Field>
              </>
            ) : null}

            {kind === 'payslip' ? (
              <>
                <Field label="Payment date" required htmlFor="owner-hr-paydate" className="min-w-[9rem] flex-1">
                  <Input
                    id="owner-hr-paydate"
                    data-testid="owner-hr-paydate"
                    type="date"
                    value={terms.payDate}
                    onChange={(e) => setTerms({ ...terms, payDate: e.target.value })}
                  />
                </Field>
                <Field label="Paid days" htmlFor="owner-hr-paiddays" className="min-w-[6rem] flex-1">
                  <Input
                    id="owner-hr-paiddays"
                    data-testid="owner-hr-paiddays"
                    inputMode="numeric"
                    value={terms.paidDays}
                    onChange={(e) => setTerms({ ...terms, paidDays: e.target.value.replace(/\D/g, '') })}
                  />
                </Field>
                <Field label="Loss of pay days" htmlFor="owner-hr-lop" className="min-w-[6rem] flex-1">
                  <Input
                    id="owner-hr-lop"
                    data-testid="owner-hr-lop"
                    inputMode="numeric"
                    value={terms.lopDays}
                    onChange={(e) => setTerms({ ...terms, lopDays: e.target.value.replace(/\D/g, '') })}
                  />
                </Field>
              </>
            ) : null}
          </div>

          {kind === 'experience' ? (
            <>
              <Field label="What they were responsible for" required htmlFor="owner-hr-duties">
                <Textarea
                  id="owner-hr-duties"
                  data-testid="owner-hr-duties"
                  rows={2}
                  value={terms.duties}
                  placeholder="table service, order taking, billing support and guest handling"
                  onChange={(e) => setTerms({ ...terms, duties: e.target.value })}
                />
              </Field>
              <Field
                label="Qualities to name"
                htmlFor="owner-hr-qualities"
                hint={`Pronouns follow the gender field — ${pronouns.subject} / ${pronouns.possessive} / ${pronouns.object} will be used throughout.`}
              >
                <Textarea
                  id="owner-hr-qualities"
                  data-testid="owner-hr-qualities"
                  rows={2}
                  value={terms.qualities}
                  onChange={(e) => setTerms({ ...terms, qualities: e.target.value })}
                />
              </Field>
            </>
          ) : null}

          {kind === 'payslip' ? (
            <>
              <SectionLabel className="mb-0 mt-2">Earnings and deductions</SectionLabel>
              <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
                A line left blank is left off the printed slip rather than printed as zero — &ldquo;Overtime 0&rdquo;
                invites a question the paper cannot answer.
              </p>
              <div className="flex flex-wrap gap-3">
                {[...EARNING_LINES, ...DEDUCTION_LINES].map(([key, label]) => (
                  <Field key={key} label={label} htmlFor={`owner-hr-pay-${key}`} className="min-w-[9rem] flex-1">
                    <Input
                      id={`owner-hr-pay-${key}`}
                      data-testid={`owner-hr-pay-${key}`}
                      inputMode="numeric"
                      value={pay[key] ?? ''}
                      onChange={(e) => setPay({ ...pay, [key]: e.target.value.replace(/[^0-9.]/g, '') })}
                    />
                  </Field>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Pill tone="neutral">Gross {rupees(totals.gross)}</Pill>
                <Pill tone="warning">Deductions {rupees(totals.totalDeductions)}</Pill>
                <Pill tone={totals.net < 0 ? 'error' : 'success'}>Net {rupees(totals.net)}</Pill>
              </div>
            </>
          ) : null}

          <Field label="Prepared by" htmlFor="owner-hr-prepared" className={kind === 'payslip' ? '' : 'hidden'}>
            <Input
              id="owner-hr-prepared"
              data-testid="owner-hr-prepared"
              value={terms.preparedBy}
              placeholder="Name, designation"
              onChange={(e) => setTerms({ ...terms, preparedBy: e.target.value })}
            />
          </Field>
        </Card>

        {/* THE DOCUMENT. What prints is what is drawn here — there is no second template. */}
        <Card className="flex flex-col gap-3" data-testid="owner-paperwork-document">
          <div className="border-b border-[var(--border)] pb-3 text-center">
            <p className="m-0 type-h3">
              <Val v={m.rName} />
            </p>
            <p className="m-0 type-caption text-[var(--text-muted)]">
              <Val v={m.rAddress} />
            </p>
            <p className="m-0 type-caption text-[var(--text-muted)]">
              {identity.email || '[RESTAURANT EMAIL]'} · {identity.phone || '[RESTAURANT PHONE]'}
            </p>
          </div>

          {kind === 'offer' ? (
            <OfferBody m={m} record={record} terms={terms} />
          ) : kind === 'experience' ? (
            <CertificateBody m={m} pronouns={pronouns} />
          ) : (
            <PayslipBody m={m} record={record} totals={totals} terms={terms} />
          )}

          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <p className="m-0 type-caption">
              For <Val v={m.rName} />
            </p>
            <p className="m-0 mt-6 type-body font-semibold">
              <Val v={m.authName} />
            </p>
            <p className="m-0 type-caption text-[var(--text-muted)]">
              <Val v={m.authRole} />
            </p>
          </div>
        </Card>
      </div>
    </Sheet>
  );
}

/* ── The three bodies ──────────────────────────────────────────────────── */

type Merges = Record<string, Merged>;

function Row({ k, v }: { k: string; v: Merged }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-[var(--border)] py-1.5">
      <span className="type-caption text-[var(--text-muted)]">{k}</span>
      <span className="type-caption font-semibold">
        <Val v={v} />
      </span>
    </div>
  );
}

function OfferBody({
  m,
  record,
  terms,
}: {
  m: Merges;
  record: EmploymentRecord;
  terms: { workLocation: string; probation: string };
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 type-eyebrow">Offer letter</p>
      <p className="m-0 type-caption text-[var(--text-muted)]">
        Date: <Val v={m.letterDate!} />
      </p>
      <p className="m-0 type-caption leading-relaxed">
        To,
        <br />
        <Val v={m.name!} />
        <br />
        <Val v={m.address!} />
      </p>
      <p className="m-0 type-body font-semibold">Subject: Offer of Employment</p>
      <p className="m-0 type-caption leading-relaxed">
        Dear <Val v={m.first!} />, we are pleased to offer you employment with <Val v={m.rName!} /> for the position of{' '}
        <Val v={m.designation!} />. Your employment will commence on <Val v={m.joined!} />, subject to the terms and
        conditions set out below.
      </p>

      <div>
        <p className="m-0 mb-1 type-eyebrow">Employment details</p>
        <Row k="Employee name" v={m.name!} />
        <Row k="Designation" v={m.designation!} />
        <Row k="Department" v={m.department!} />
        <Row k="Date of joining" v={m.joined!} />
        <Row k="Employment type" v={merge(record.employmentType, 'Full-time / part-time / contract')} />
        <Row k="Work location" v={merge(terms.workLocation, 'Location')} />
        <Row k="Reporting to" v={merge(record.reportsTo, 'Manager / supervisor name')} />
        <Row k="Working hours" v={merge(record.shift, 'Working hours / shift')} />
        <Row k="Monthly salary" v={m.salary!} />
        <Row k="Probation period" v={merge(terms.probation, 'Probation period')} />
      </div>

      <p className="m-0 type-caption leading-relaxed">
        You will receive a gross monthly salary of <Val v={m.salary!} /> (<Val v={m.salaryWords!} /> only), subject to
        applicable statutory and other deductions. You are expected to maintain professional conduct, punctuality,
        hygiene, discipline and appropriate standards of customer service at all times, and to keep confidential the
        restaurant&rsquo;s operations, customer information, recipes, pricing and financial information.
      </p>
      <p className="m-0 type-caption leading-relaxed">
        Either party may terminate the employment by giving <Val v={m.notice!} /> notice or salary in lieu of notice,
        subject to applicable law. Leave, weekly off and attendance are governed by the restaurant&rsquo;s applicable
        policies and statutory requirements.
      </p>
      <p className="m-0 type-caption leading-relaxed">
        Please sign and return a copy of this letter as confirmation of your acceptance of the above terms.
      </p>
      <p className="m-0 mt-3 type-caption leading-relaxed">
        I, <Val v={m.name!} />, accept the offer of employment and agree to the terms stated above.
        <br />
        <br />
        Employee signature: ______________________ Date: ______________________
      </p>
    </div>
  );
}

function CertificateBody({ m, pronouns }: { m: Merges; pronouns: { subject: string; possessive: string; object: string } }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 type-eyebrow">Experience certificate</p>
      <p className="m-0 type-caption text-[var(--text-muted)]">
        Date: <Val v={m.letterDate!} />
      </p>
      <p className="m-0 type-body font-semibold">To whom it may concern</p>
      <p className="m-0 type-caption leading-relaxed">
        This is to certify that <Val v={m.name!} /> was employed with <Val v={m.rName!} /> as <Val v={m.designation!} />{' '}
        in the <Val v={m.department!} /> department from <Val v={m.joined!} /> to <Val v={m.left!} />.
      </p>
      <p className="m-0 type-caption leading-relaxed">
        During the period of employment, {pronouns.subject} was responsible for <Val v={m.duties!} />. Throughout{' '}
        {pronouns.possessive} tenure with us, <Val v={m.first!} /> demonstrated <Val v={m.qualities!} /> and carried out
        the assigned responsibilities to the satisfaction of the management.
      </p>
      <p className="m-0 type-caption leading-relaxed">
        We appreciate {pronouns.possessive} contribution to <Val v={m.rName!} /> and wish {pronouns.object} every
        success in {pronouns.possessive} future career. This certificate is issued at the employee&rsquo;s request for
        official and employment-related purposes.
      </p>
    </div>
  );
}

function PayslipBody({
  m,
  record,
  totals,
  terms,
}: {
  m: Merges;
  record: EmploymentRecord;
  totals: ReturnType<typeof payslipTotals>;
  terms: { payableDays: string; paidDays: string; lopDays: string; paymentMode: string };
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 type-eyebrow">Salary slip</p>
      <p className="m-0 type-caption text-[var(--text-muted)]">
        Salary month: <Val v={m.month!} />
      </p>

      <div>
        <p className="m-0 mb-1 type-eyebrow">Employee details</p>
        <Row k="Employee name" v={m.name!} />
        <Row k="Employee ID" v={merge(record.employeeCode, 'Employee ID')} />
        <Row k="Designation" v={m.designation!} />
        <Row k="Date of joining" v={m.joined!} />
        <Row k="PAN" v={merge(record.pan, 'PAN number')} />
        {/* N/A is a real answer here and not a placeholder: plenty of employees have no UAN,
            and a red [UAN NUMBER] on the paper would send somebody looking for one. */}
        <Row k="UAN" v={{ text: record.uan || 'N/A', placeholder: false }} />
        <Row
          k="Bank account"
          v={{ text: record.bankLast4 ? `XXXX XXXX ${record.bankLast4}` : 'N/A', placeholder: false }}
        />
        <Row k="Payment mode" v={merge(terms.paymentMode, 'Bank transfer / cash / other')} />
        <Row k="Paid days" v={merge(terms.paidDays, 'Paid days')} />
        <Row k="Loss of pay days" v={{ text: terms.lopDays || '0', placeholder: false }} />
      </div>

      <div>
        <p className="m-0 mb-1 type-eyebrow">Earnings</p>
        {totals.earnings.map((r) => (
          <Row key={r.label} k={r.label} v={{ text: rupees(r.amount), placeholder: false }} />
        ))}
        <Row k="Gross earnings" v={{ text: rupees(totals.gross), placeholder: false }} />
      </div>

      <div>
        <p className="m-0 mb-1 type-eyebrow">Deductions</p>
        {totals.deductions.length === 0 ? (
          <p className="m-0 type-caption text-[var(--text-muted)]">None this month.</p>
        ) : (
          totals.deductions.map((r) => (
            <Row key={r.label} k={r.label} v={{ text: rupees(r.amount), placeholder: false }} />
          ))
        )}
        <Row k="Total deductions" v={{ text: rupees(totals.totalDeductions), placeholder: false }} />
      </div>

      <div className="rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-4 py-3">
        <p className="m-0 type-body font-semibold">Net salary payable: {rupees(totals.net)}</p>
        <p className="m-0 type-caption text-[var(--text-muted)]">
          Amount in words: Rupees {totals.netInWords} only
        </p>
      </div>

      <p className="m-0 type-caption text-[var(--text-muted)]">
        Salary payment date: <Val v={m.payDate!} /> · Prepared by: <Val v={m.preparedBy!} />
      </p>
      <p className="m-0 type-caption text-[var(--text-muted)]">
        This is a computer-generated salary slip and does not require a physical signature unless otherwise specified.
      </p>
    </div>
  );
}
