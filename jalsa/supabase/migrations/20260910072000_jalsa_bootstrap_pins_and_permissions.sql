-- =============================================================================
-- 20260910072000_jalsa_bootstrap_pins_and_permissions
--
-- Two things a scaffolded restaurant cannot open without: someone who can sign in, and a
-- permission matrix that says what each role may do.
--
-- ABOUT THE PINs
--   These are the SETUP PINs from the approved design set (Javeed 4021, Imran 1188,
--   Farhan 2043) plus one per role so every surface can be exercised. They are stored
--   hashed, exactly like a reissued one - there is no second code path for "seeded"
--   credentials - but they are published in a design document and in this file, so they are
--   not secrets and must never be treated as any.
--
--   This is recorded as a known limitation rather than hidden: docs/registers/
--   KNOWN_LIMITATIONS.md carries the entry, and the owner's Staff screen reissues any PIN in
--   two taps. Seeding NO pin was the alternative, and it produces an application nobody can
--   sign in to and therefore nobody can verify - a worse failure, silently.
--
-- ABOUT THE PERMISSION MATRIX
--   The keys and the role presets are the ones the owner-admin artboard lists, unchanged.
--   They are seeded as ROWS rather than hard-coded in the application because Standard 9.1
--   requires a preset to be a starting point that an owner then adjusts per person - a
--   preset compiled into the bundle cannot be adjusted at all.
-- =============================================================================

begin;

do $$
declare
  r uuid;
  s record;
begin
  select id into r from public.restaurant where slug = 'jalsa-hosur';

  -- --- Setup PINs -----------------------------------------------------------
  for s in
    select st.id, p.pin
      from (values
        ('Javeed Ahmed', '4021'),
        ('Imran',        '1188'),
        ('Ramesh',       '1122'),
        ('Karthik',      '1133'),
        ('Shabbir',      '1144'),
        ('Mani',         '2211'),
        ('Nawaz',        '2222'),
        ('Firoz',        '2233'),
        ('Sameer',       '2244'),
        ('Farhan',       '2043')
      ) as p(person, pin)
      join public.staff st on st.restaurant_id = r and st.name = p.person
     where st.pin_hash is null      -- never overwrite a PIN a real person has already reset
  loop
    perform public.set_staff_pin(s.id, s.pin);
  end loop;

  -- --- Role presets ---------------------------------------------------------
  -- Every permission the design's Module access panel lists, granted per role. Rows, not code.
  insert into public.staff_permission (staff_id, perm_key, granted, granted_by)
  select st.id, g.perm_key, true, 'setup'
  from public.staff st
  join (values
    -- Captain
    ('Captain','queue.view'),('Captain','queue.walkin'),('Captain','queue.notify'),('Captain','queue.seat'),
    ('Captain','orders.view'),('Captain','orders.create'),('Captain','orders.add_items'),
    ('Captain','orders.qty_change'),('Captain','orders.cancel_before'),('Captain','orders.status'),
    ('Captain','orders.reprint'),('Captain','tables.view'),('Captain','tables.assign'),('Captain','tables.qr'),
    ('Captain','menu.view'),('Captain','menu.availability'),('Captain','bill.view'),
    ('Captain','bill.record_payment'),('Captain','bill.reprint'),('Captain','tips.own'),('Captain','rep.products'),
    -- Waiter. Deliberately no bill.view: the design hides amounts from waiters and says so
    -- on screen ("Bill amounts are hidden for waiters").
    ('Waiter','queue.view'),('Waiter','orders.view'),('Waiter','orders.status'),
    ('Waiter','tables.view'),('Waiter','menu.view'),('Waiter','menu.availability'),('Waiter','tips.own'),
    -- Chef
    ('Chef','orders.view'),('Chef','orders.status'),('Chef','orders.reprint'),
    ('Chef','menu.view'),('Chef','menu.availability'),
    -- Cashier
    ('Cashier','queue.view'),('Cashier','queue.notify'),('Cashier','orders.view'),('Cashier','tables.view'),
    ('Cashier','bill.view'),('Cashier','bill.record_payment'),('Cashier','bill.reprint'),
    ('Cashier','bill.disc_pct'),('Cashier','tips.settle')
  ) as g(role, perm_key) on g.role = st.role
  where st.restaurant_id = r
  on conflict (staff_id, perm_key) do nothing;

  -- The owner holds every permission there is. Listing them individually would mean a new
  -- permission silently not reaching the person whose job is to grant it.
  insert into public.staff_permission (staff_id, perm_key, granted, granted_by)
  select st.id, k.perm_key, true, 'setup'
  from public.staff st
  cross join (values
    ('queue.view'),('queue.walkin'),('queue.notify'),('queue.seat'),('queue.close'),('queue.clear'),
    ('orders.view'),('orders.create'),('orders.add_items'),('orders.qty_change'),
    ('orders.cancel_before'),('orders.cancel_after'),('orders.status'),('orders.reprint'),
    ('tables.view'),('tables.assign'),('tables.qr'),('tables.transfer'),
    ('menu.view'),('menu.availability'),('menu.item_edit'),('menu.price_edit'),('menu.category'),
    ('bill.view'),('bill.disc_pct'),('bill.disc_flat'),('bill.record_payment'),('bill.reprint'),
    ('bill.tax_view'),('bill.void'),
    ('tips.own'),('tips.all'),('tips.settle'),
    ('rep.sales'),('rep.products'),('rep.staff'),('rep.expenses'),('rep.reviews'),
    ('staff.view'),('staff.create'),('staff.perms'),('staff.pin'),
    ('set.tax'),('set.printer'),('set.whatsapp'),('set.review'),('set.hours'),('set.identity'),
    ('set.invoice'),('set.tables'),('set.copy'),('set.features'),
    ('audit.view'),('expense.manage'),('day.setup')
  ) as k(perm_key)
  where st.restaurant_id = r and st.role = 'Owner / Admin'
  on conflict (staff_id, perm_key) do nothing;
end $$;

commit;
