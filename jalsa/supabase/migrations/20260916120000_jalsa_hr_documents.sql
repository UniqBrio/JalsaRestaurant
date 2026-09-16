-- =============================================================================
-- 20260916120000_jalsa_hr_documents
--
-- The last five employment columns, and the permission that guards them.
--
-- WHAT WAS ALREADY THERE
--   The core schema carried designation, department, employee_code, joined_on, last_working_day,
--   monthly_salary, gender, employment_type and home_address, under a comment naming the HR
--   documents as the reason. Nothing read them and nothing wrote them: the Staff screen edited
--   name, role and mobile, and every other column has held its default since the first migration.
--   That is the same shape of defect as the reply box that wrote to a column no screen read —
--   a field that exists, looks maintained, and is empty in every row.
--
-- WHAT THE DOCUMENTS STILL NEEDED
--   `Jalsa HR Documents.dc.html` merges five more: who a person reports to, their shift, and —
--   for the payslip only — PAN, UAN and the last four digits of the bank account.
--
-- WHY ONLY THE LAST FOUR DIGITS
--   The design's own payslip prints `XXXX XXXX 5093`, which is all a payslip has ever needed: it
--   lets the employee confirm the money went to the right account. Storing the whole number would
--   make this table hold a credential that nothing in this application can use and that a leak
--   would make somebody else's problem. The column is named for what it holds so nobody later
--   widens it by accident.
--
-- WHY `staff.paperwork` IS ITS OWN PERMISSION
--   `staff.create` already exists and means "add or edit staff" — name, role, who is on duty.
--   Salary, PAN and a bank fragment are a different question, and a person who may fix a spelling
--   in a waiter's name has no business reading what the senior captain is paid. Marked
--   confidential, so the audit log treats a change to it accordingly.
--
-- NOTHING HERE IS BACKFILLED. Every new column starts empty on every existing row, and the
-- documents print `[REPORTING TO]` until somebody fills it — which is the design's rule working,
-- not a migration that failed to finish.
-- =============================================================================

begin;

alter table public.staff
  add column if not exists reports_to      text not null default '',
  add column if not exists shift           text not null default '',
  add column if not exists pan             text not null default '',
  add column if not exists uan             text not null default '',
  -- Four digits or nothing. A column that can hold sixteen eventually holds sixteen.
  add column if not exists bank_last4      text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'staff_bank_last4_check') then
    alter table public.staff
      add constraint staff_bank_last4_check check (bank_last4 = '' or bank_last4 ~ '^[0-9]{4}$');
  end if;
end $$;

do $$
declare
  r uuid;
begin
  select id into r from public.restaurant order by created_at limit 1;
  if r is null then return; end if;

  -- The grant, to whoever already holds the confidential staff permissions. Owner and
  -- Manager-shaped roles have `staff.perms`; nobody else should be reading salaries.
  insert into public.staff_permission (staff_id, perm_key, granted, granted_by)
  select sp.staff_id, 'staff.paperwork', true, 'migration'
  from public.staff_permission sp
  join public.staff s on s.id = sp.staff_id
  where s.restaurant_id = r
    and sp.perm_key = 'staff.perms'
    and sp.granted
  on conflict (staff_id, perm_key) do nothing;
end $$;

commit;
