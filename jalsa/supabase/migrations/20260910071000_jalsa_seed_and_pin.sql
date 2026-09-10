-- =============================================================================
-- 20260910071000_jalsa_seed_and_pin
--
-- Two things that belong together: the PIN verification function, and the restaurant's own
-- data as the design set states it.
--
-- WHY THE SEED IS A MIGRATION AND NOT A SCRIPT
--   Every value below is a real operating fact the design set already fixed - the twenty
--   tables, the twenty-seven people, the menu with its real prices, the three TVS machines.
--   Kept in a script, it is the one part of the setup nobody can reproduce; kept here, a new
--   environment is one command away from being usable, and the numbers on screen match the
--   numbers in the approved design instead of being invented at demo time.
--
--   It is idempotent throughout: `on conflict do nothing` everywhere, so re-running it after
--   a real service has started adds nothing and destroys nothing.
--
-- WHY PIN VERIFICATION IS A DATABASE FUNCTION
--   The hash never leaves the database and the application never needs a hashing library at
--   all. A wrong PIN returns no row - there is deliberately no way to ask "does this person
--   exist" separately from "is this their PIN", because the two answers together are what
--   makes a four-digit credential enumerable.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Credentials
-- ---------------------------------------------------------------------------
create or replace function public.set_staff_pin(p_staff uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'A PIN is exactly four digits';
  end if;
  update public.staff
     set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
         pin_set_at = now()
   where id = p_staff;
end;
$$;

create or replace function public.verify_staff_pin(p_restaurant uuid, p_pin text)
returns table (id uuid, name text, role text, initials text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- No early return on "no such PIN" versus "removed person": one shape of answer, always.
  return query
    select s.id, s.name, s.role, s.initials
      from public.staff s
     where s.restaurant_id = p_restaurant
       and s.removed_at is null
       and s.active
       and s.pin_hash is not null
       and s.pin_hash = extensions.crypt(p_pin, s.pin_hash)
     limit 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- The restaurant
-- ---------------------------------------------------------------------------
insert into public.restaurant (slug, legal_name, display_name, address, email, phone,
                               location_line, hr_email, signatory_name, signatory_role,
                               fssai, pan)
values ('jalsa-hosur', 'Jalsa Restaurant', 'Jalsa Restaurant',
        '142 Bagalur Main Road, Hosur, Krishnagiri District, Tamil Nadu 635109',
        'hello@jalsahosur.in', '+91 90000 12345', 'Hosur, Tamil Nadu', 'hr@jalsahosur.in',
        'Javeed', 'Proprietor', '12419008000123', 'AABCJ1234M')
on conflict (slug) do nothing;

do $$
declare r uuid;
begin
  select id into r from public.restaurant where slug = 'jalsa-hosur';

  -- -------------------------------------------------------------------------
  -- Number series. Bill numbers continue from the design's own ledger (B-1041 onward) so a
  -- demo does not restart at 1 and read as a brand-new restaurant.
  -- -------------------------------------------------------------------------
  insert into public.number_series (restaurant_id, kind, prefix, next_value) values
    (r, 'bill', 'B-', 1041),
    (r, 'kot', 'KOT-', 105),
    (r, 'group', 'G-', 7)
  on conflict (restaurant_id, kind) do nothing;

  -- -------------------------------------------------------------------------
  -- Settings. Ten sub-sections of the design's Settings tab, each a keyed document.
  -- -------------------------------------------------------------------------
  insert into public.setting (restaurant_id, key, value) values
    (r, 'hours', jsonb_build_object(
      'days', jsonb_build_array(
        jsonb_build_object('day','Monday','open','12:00','close','23:00','shut',false),
        jsonb_build_object('day','Tuesday','open','12:00','close','23:00','shut',false),
        jsonb_build_object('day','Wednesday','open','12:00','close','23:00','shut',false),
        jsonb_build_object('day','Thursday','open','12:00','close','23:00','shut',false),
        jsonb_build_object('day','Friday','open','12:00','close','23:30','shut',false),
        jsonb_build_object('day','Saturday','open','11:30','close','23:30','shut',false),
        jsonb_build_object('day','Sunday','open','11:30','close','23:00','shut',false)),
      'breakOn', true, 'breakFrom', '15:30', 'breakTo', '18:30',
      'lastOrderMins', 30, 'dayStart', '05:00',
      'note', 'Kitchen stops taking orders 30 minutes before closing.',
      'holidays', jsonb_build_array(
        jsonb_build_object('date','2026-09-20','label','Closed — Milad-un-Nabi','full',true),
        jsonb_build_object('date','2026-10-02','label','Dinner only, opens 6 PM','full',false))
    )),
    (r, 'tax', jsonb_build_object('rate', 5, 'gstin', '33ABCDE1234F1Z5', 'inclusive', false)),
    (r, 'invoice', jsonb_build_object(
      'prefix', 'JAL', 'reset', 'Every financial year', 'rounding', 'Nearest rupee',
      'showCaptain', true, 'showKot', true)),
    (r, 'engagement', jsonb_build_object(
      'reviewUrl', 'https://g.page/r/jalsa-hosur/review', 'photoPrompt', true,
      'waProvider', 'Not selected', 'waTrigger', 'Customer taps to send',
      'callNumber', '+91 98765 43210')),
    (r, 'rescan', jsonb_build_object('minutes', 15)),
    (r, 'tips', jsonb_build_object('options', jsonb_build_array(0, 10, 20, 30))),
    -- "What the customer sees" — every optional guest feature as a switch. The three that
    -- start off are the three the design ships off.
    (r, 'customerFeatures', jsonb_build_object(
      'captainName', true, 'waiterName', false, 'askForPerson', true,
      'water', true, 'callCaptain', true, 'plates', true, 'parcelRest', true,
      'waterBottle', true, 'askBill', false,
      'special', true, 'combos', true, 'festival', true, 'favourites', true,
      'hoursBtn', true, 'seeWeek', true, 'seeMenuClosed', true, 'callUs', true,
      'notifyReopen', false,
      'welcome', true, 'occasion', true, 'queueOccasion', true,
      'cookAnim', true, 'recos', true, 'heart', true,
      'upsell', true, 'takeaway', true, 'tip', true, 'whatsapp', true,
      'suggestion', true, 'review', true, 'queue', true)),
    -- "Words the guest sees" — every guest-facing string, editable without a release.
    (r, 'copy', jsonb_build_object(
      'name', 'Jalsa Restaurant',
      'subline', 'Hosur · since 2016',
      'marquee', 'Celebrate every bite',
      'greetMorning', 'Good morning', 'greetAfternoon', 'Good afternoon',
      'greetEvening', 'Good evening', 'greetLate', 'Still open — welcome in',
      'welcome', 'The full menu is on your phone. Order as many rounds as you like — one bill at the end.',
      'startBtn', 'Start ordering',
      'suggestBtn', 'Tell us something',
      'captainLine', '{captain} is your captain',
      'waiterLine', '{waiter} is serving your table',
      'askHeading', 'Ask for something',
      'cookingLine', 'Your order is being cooked',
      'cookingSub', '{captain} has it · usually 18–22 minutes',
      'servedHeading', 'On your table — enjoy',
      'heartHint', 'Tap the heart on anything you loved',
      'thankYou', 'Thank you',
      'parcelPitch', '{dish} is a favourite here too. Take a portion home for someone you love?',
      'payBtn', 'Request payment',
      'tipPrompt', 'Add a tip for {captain}?',
      'paidHeading', 'Paid',
      'reviewHeading', 'Loved it? Tell Google',
      'reviewSub', 'A photo from tonight helps more than words',
      'suggestPrompt', 'Tell us anything — we read every one',
      'closedToday', 'Closed today',
      'closedNote', 'Back tomorrow at {open}.',
      'hoursBtn', 'Hours & holidays',
      'callBtn', 'Call the restaurant',
      'weekBtn', 'See the full week',
      'footer', 'Thank you for eating with us')),
    (r, 'replies', jsonb_build_object(
      'heading', 'Pick a reply or write your own',
      'items', jsonb_build_array(
        jsonb_build_object('name','Our standard thanks','text','Thank you for the feedback and for bringing this to our attention. We shall take the necessary measures to keep it great.'),
        jsonb_build_object('name','Passed to the kitchen','text','Thank you — we have passed this to the kitchen tonight.'),
        jsonb_build_object('name','Sorry it fell short','text','Thank you for telling us. We are sorry it fell short, and the next visit will be better.')))),
    (r, 'day', jsonb_build_object(
      'note', 'Festival weekend — quote 20 minutes at the door and push the combos. Mutton is limited to 15 plates tonight.',
      'opened', false, 'menuChecked', false)),
    (r, 'employment', jsonb_build_object('probation', '3 months', 'notice', '30 days'))
  on conflict (restaurant_id, key) do nothing;

  -- -------------------------------------------------------------------------
  -- Tables. Ten AC, ten non-AC, with the seat counts the waitlist reads when it suggests
  -- where to put a party.
  -- -------------------------------------------------------------------------
  insert into public.dining_table (restaurant_id, name, zone, seats, active, sort)
  select r, t.name, t.zone, t.seats, t.active, t.sort
  from (values
    ('A1','AC',2,true,1),  ('A2','AC',2,true,2),  ('A3','AC',4,true,3),  ('A4','AC',4,true,4),
    ('A5','AC',4,true,5),  ('A6','AC',4,true,6),  ('A7','AC',4,true,7),  ('A8','AC',4,true,8),
    ('A9','AC',6,true,9),  ('A10','AC',6,true,10),
    ('N1','Non-AC',4,true,11), ('N2','Non-AC',4,true,12), ('N3','Non-AC',4,true,13),
    ('N4','Non-AC',4,true,14), ('N5','Non-AC',4,true,15), ('N6','Non-AC',4,true,16),
    ('N7','Non-AC',6,true,17), ('N8','Non-AC',6,true,18), ('N9','Non-AC',4,true,19),
    ('N10','Non-AC',4,false,20)
  ) as t(name, zone, seats, active, sort)
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Menu categories, in the order the design's chip row shows them.
  -- -------------------------------------------------------------------------
  insert into public.menu_category (restaurant_id, name, sort)
  select r, c.name, c.sort from (values
    ('Biryani',1), ('Rice',2), ('Non-Veg Starters',3), ('Veg Starters',4), ('Chinese',5),
    ('Indian Curry',6), ('Bread',7), ('Combo',8), ('Salads',9), ('Desserts',10), ('Drinks',11)
  ) as c(name, sort)
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Menu items - the real card, at the real prices, from the owner-admin artboard.
  -- -------------------------------------------------------------------------
  insert into public.menu_item (restaurant_id, category_id, name, price, food_type, description, sort)
  select r, c.id, m.name, m.price, m.ftype::public.food_type, m.descr, m.sort
  from (values
    ('Chicken Biryani',90,'Biryani','non_veg','Seeraga samba rice layered with chicken, served with raita.',1),
    ('Mutton Biryani',240,'Biryani','non_veg','Slow-dum mutton biryani, the Friday order.',2),
    ('Veg Biryani',140,'Biryani','veg','Whole spice, seasonal vegetables, layered and dummed.',3),
    ('Full Biryani',115,'Biryani','non_veg','Long-grain rice layered with chicken, served with raita.',4),
    ('Veg Pulav',120,'Rice','veg','Rice cooked with whole spice and seasonal vegetables.',5),
    ('Chicken Fried Rice',170,'Rice','non_veg','Wok-tossed rice with shredded chicken and spring onion.',6),
    ('Chicken Tikka — 5 pc',260,'Non-Veg Starters','non_veg','Boneless thigh, hung curd and kasuri methi, off the tandoor.',7),
    ('Chicken Lollipop — 1 pc',30,'Non-Veg Starters','non_veg','Frenched wing, fried and tossed in a dry chilli glaze.',8),
    ('Tandoori Chicken — Half',130,'Non-Veg Starters','non_veg','Overnight marinade, charred on the bone.',9),
    ('Tandoori Chicken — Full',240,'Non-Veg Starters','non_veg','The full bird, overnight marinade, charred on the bone.',10),
    ('Chicken Nuggets',140,'Non-Veg Starters','non_veg','Crumb-fried, for the table with children at it.',11),
    ('Kebab Half',70,'Non-Veg Starters','non_veg','Minced seekh kebab off the skewer.',12),
    ('Chilli Paneer',220,'Veg Starters','veg','Paneer, capsicum and onion in a dry Indo-Chinese toss.',13),
    ('Paneer 65',130,'Veg Starters','veg','Battered paneer, curry leaf and a short chilli finish.',14),
    ('Veg Pepper Salt',140,'Veg Starters','veg','Mixed vegetables, crushed pepper, plenty of salt-fry crunch.',15),
    ('Crispy Chilli Baby Corn',160,'Veg Starters','veg','Baby corn fried crisp and tossed in chilli and garlic.',16),
    ('Chicken Manchurian',190,'Chinese','non_veg','Fried chicken tossed in a soy and garlic sauce.',17),
    ('Chicken Chilly',190,'Chinese','non_veg','Dry chilli chicken with onion and capsicum.',18),
    ('Chicken Manchow Soup',140,'Chinese','non_veg','Peppery broth with fried noodles on top.',19),
    ('Chicken Hot & Sour Soup',150,'Chinese','non_veg','Hot, sour and thickened, with shredded chicken.',20),
    ('Veg Hot & Sour Soup',135,'Chinese','veg','Peppery, tangy broth with shredded vegetables.',21),
    ('Chicken Clear Soup',140,'Chinese','non_veg','Clean chicken broth with pepper and coriander.',22),
    ('Veg Clear Soup',110,'Chinese','veg','Clear vegetable broth, light before a heavy round.',23),
    ('Gobi Manchurian',160,'Chinese','veg','Cauliflower fried and tossed in a soy and garlic sauce.',24),
    ('Paneer Butter Masala',191,'Indian Curry','veg','Tomato and cashew gravy, finished with butter.',25),
    ('Paneer Tikka Masala',228,'Indian Curry','veg','Tandoori paneer folded into a spiced tomato gravy.',26),
    ('Kadai Paneer',180,'Indian Curry','veg','Paneer and capsicum in a coarse kadai masala.',27),
    ('Matar Paneer',160,'Indian Curry','veg','Peas and paneer in a mild onion-tomato gravy.',28),
    ('Mix Veg Kadai',180,'Indian Curry','veg','Seasonal vegetables in a coarse kadai masala.',29),
    ('Dal Fry',120,'Indian Curry','veg','Yellow dal tempered with cumin, garlic and ghee.',30),
    ('Mutton Masala',290,'Indian Curry','non_veg','Mutton in a deep onion-tomato masala.',31),
    ('Mutton Chettinadu',320,'Indian Curry','non_veg','Slow-cooked mutton in a dark roasted masala.',32),
    ('Mutton Kadai',290,'Indian Curry','non_veg','Mutton and capsicum in a coarse kadai masala.',33),
    ('Mutton Shuka',110,'Indian Curry','non_veg','Dry-roasted mutton with curry leaf and pepper.',34),
    ('Butter Chicken Masala',290,'Indian Curry','non_veg','Tandoori chicken in a butter and cashew gravy.',35),
    ('Chicken Tikka Masala',280,'Indian Curry','non_veg','Tandoori chicken folded into a spiced tomato gravy.',36),
    ('Chicken Tawa Masala',260,'Indian Curry','non_veg','Griddled chicken with onion and a dry masala.',37),
    ('Kadai Chicken',180,'Indian Curry','non_veg','Chicken and capsicum in a coarse kadai masala.',38),
    ('Chicken Chettinad',240,'Indian Curry','non_veg','Roasted Chettinad masala, coconut and black pepper.',39),
    ('Chicken Masala',220,'Indian Curry','non_veg','House chicken curry, the one that never comes off.',40),
    ('Chicken Chukka',100,'Indian Curry','non_veg','Dry-roasted chicken with curry leaf and pepper.',41),
    ('Egg Burji',80,'Indian Curry','egg','Scrambled egg with onion, tomato and green chilli.',42),
    ('Egg Masala',95,'Indian Curry','egg','Boiled egg in an onion-tomato masala.',43),
    ('Egg Kheema Masala',130,'Indian Curry','egg','Minced egg and onion, cooked down dry.',44),
    ('Butter Naan',45,'Bread','veg','Tandoor naan, brushed with butter.',45),
    ('Tandoori Roti',30,'Bread','veg','Whole-wheat roti off the tandoor wall.',46),
    ('Dinner Combo 1',299,'Combo','veg','Veg biryani, raita and a gulab jamun, priced together.',47),
    ('Dinner Combo 2',299,'Combo','non_veg','Chicken biryani, raita and a gulab jamun, priced together.',48),
    ('Dinner Combo 3',448,'Combo','non_veg','Biryani for two, a starter and dessert.',49),
    ('Dinner Combo 4',248,'Combo','veg','Paneer curry, two naan and a dessert.',50),
    ('Onion Cucumber Raita',45,'Salads','veg','Set curd with onion, cucumber and roasted cumin.',51),
    ('Gulab Jamun — 1 pc',30,'Desserts','veg','Warm milk dumpling in cardamom syrup.',52),
    ('Milk Halwa',110,'Desserts','veg','Slow-reduced milk halwa, cut warm.',53),
    ('Royal Falooda',290,'Desserts','veg','Rose syrup, vermicelli, jelly and ice cream.',54),
    ('Badam Milk',25,'Drinks','veg','Chilled milk with almond and saffron.',55),
    ('Horlicks',25,'Drinks','veg','Hot, for the end of a long dinner.',56),
    ('Lime Tea',12,'Drinks','veg','Black tea, lime, no milk.',57)
  ) as m(name, price, cat, ftype, descr, sort)
  join public.menu_category c on c.restaurant_id = r and c.name = m.cat
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- People. Twenty-seven, with the roles and standing table assignments the design lists.
  -- -------------------------------------------------------------------------
  insert into public.staff (restaurant_id, name, role, initials, designation, department, on_duty)
  select r, p.name, p.role, p.initials, p.role, p.dept, p.on_duty
  from (values
    ('Javeed Ahmed','Owner / Admin','JA','Management',true),
    ('Ramesh','Captain','R','Floor',true),
    ('Imran','Captain','I','Floor',true),
    ('Karthik','Captain','K','Floor',true),
    ('Shabbir','Captain','S','Floor',true),
    ('Naveen','Captain','N','Floor',false),
    ('Anand','Chef','A','Kitchen',true),
    ('Rafiq','Chef','R','Kitchen',true),
    ('Vetri','Chef','V','Kitchen',false),
    ('Yusuf','Chef','Y','Kitchen',true),
    ('Basheer','Chef','B','Kitchen',true),
    ('Selvam','Chef','S','Kitchen',false),
    ('Nawaz','Waiter','N','Floor',true),
    ('Mani','Waiter','M','Floor',true),
    ('Firoz','Waiter','F','Floor',true),
    ('Sameer','Waiter','S','Floor',true),
    ('Arun','Waiter','A','Floor',true),
    ('Ashraf','Waiter','A','Floor',true),
    ('Prakash','Waiter','P','Floor',true),
    ('Iqbal','Waiter','I','Floor',false),
    ('Dinesh','Waiter','D','Floor',true),
    ('Salim','Waiter','S','Floor',false),
    ('Farhan','Cashier','F','Counter',true),
    ('Kavitha','Cashier','K','Counter',false),
    ('Munna','Cleaning','M','Housekeeping',true),
    ('Razia','Cleaning','R','Housekeeping',true),
    ('Latha','Cleaning','L','Housekeeping',false)
  ) as p(name, role, initials, dept, on_duty)
  on conflict do nothing;

  -- Standing assignments, exactly as the staff artboard lists them.
  insert into public.staff_table (staff_id, table_id)
  select s.id, d.id
  from (values
    ('Ramesh','A1'),('Ramesh','A2'),('Ramesh','A9'),('Ramesh','N4'),
    ('Imran','A3'),('Imran','A5'),('Imran','A10'),('Imran','N5'),
    ('Karthik','A6'),('Karthik','A8'),('Karthik','N1'),('Karthik','N2'),('Karthik','N7'),
    ('Shabbir','N3'),('Shabbir','N6'),
    ('Naveen','N8'),('Naveen','N10'),
    ('Nawaz','A1'),('Nawaz','A2'),('Nawaz','A9'),('Nawaz','N9'),
    ('Mani','A3'),('Mani','A5'),('Mani','A10'),
    ('Firoz','N1'),('Firoz','N2'),('Firoz','N4'),
    ('Sameer','A6'),('Sameer','A8'),('Sameer','N7'),
    ('Iqbal','N3'),('Iqbal','N6'),
    ('Salim','N10')
  ) as a(person, tbl)
  join public.staff s on s.restaurant_id = r and s.name = a.person
  join public.dining_table d on d.restaurant_id = r and d.name = a.tbl
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- The three machines from the printer artboard. All three start offline, because the
  -- printer is an unvalidated dependency and pretending otherwise would hide the fallback
  -- path this build is meant to exercise.
  -- -------------------------------------------------------------------------
  insert into public.printer (restaurant_id, machine_id, name, purpose, paper_mm, routes, chefs, online)
  values
    (r, 'KOT-VEG-01', 'TVS RP 3160 Gold — Kitchen 1', 'KOT', 80, array['Veg','Egg'], array['Anand'], false),
    (r, 'KOT-NV-01', 'TVS RP 3160 Gold — Kitchen 2', 'KOT', 80, array['Non-veg'], array['Rafiq','Vetri'], false),
    (r, 'BILL-01', 'TVS RP 3160 Gold — Counter', 'Invoice', 80, array['Invoice'], array[]::text[], false),
    (r, 'KOT-TAN-01', 'TVS RP 3160 Gold — Tandoor station', 'KOT', 58, array['Non-veg'], array['Yusuf'], false)
  on conflict (restaurant_id, machine_id) do nothing;

  -- -------------------------------------------------------------------------
  -- Expenses, so the purchases report has something honest to show on day one.
  -- -------------------------------------------------------------------------
  insert into public.expense (restaurant_id, spent_on, category, note, amount, entered_by)
  select r, e.d::date, e.cat, e.note, e.amt, 'Javeed'
  from (values
    ('2026-09-06','Vegetables','Morning market',4280),
    ('2026-09-06','Gas cylinder','2 units',2100),
    ('2026-09-06','Staff advance','Firoz',1500),
    ('2026-09-05','Chicken & mutton','Daily supply',9600),
    ('2026-09-05','Electricity','August bill',7340)
  ) as e(d, cat, note, amt)
  on conflict do nothing;
end $$;

commit;
