-- =============================================================================
-- 20260910073000_jalsa_provisional_pins
--
-- A PIN issued BY someone else is a different thing from a PIN a person chose, and the schema
-- now says so.
--
-- WHY THIS MATTERS MORE THAN IT LOOKS
--   The whole accountability story rests on one sentence the sign-in screen makes: "everything
--   you do tonight is recorded against your name". That sentence is only true while the PIN is
--   theirs alone. A code the owner generated, read aloud, and possibly wrote on a docket is not
--   yet theirs — so it is marked PROVISIONAL, and the application refuses to let anyone work
--   behind it until they have replaced it with one of their own choosing.
--
--   This is the design set's own instruction ("They sign in … with this PIN and change it on
--   first use") turned into a state the database holds rather than a habit people are asked to
--   remember.
--
-- THE SETUP PIN IS NOW 1234 FOR EVERYONE, DELIBERATELY AND TEMPORARILY
--   Requested for testing. It is safe ONLY because it is provisional: signing in with it does
--   not open the floor, it opens "choose your own PIN". A shared, well-known setup code that
--   cannot be worked behind is a convenience; one that can be is an unlocked till.
--   Recorded in docs/registers/KNOWN_LIMITATIONS.md with the date it must be reviewed.
-- =============================================================================

begin;

alter table public.staff
  add column if not exists pin_provisional boolean not null default false;

-- Setting a PIN now records WHO chose it. `p_provisional` true means "issued to them"; false
-- means "chosen by them", and only the second one opens the application.
create or replace function public.set_staff_pin(p_staff uuid, p_pin text, p_provisional boolean default false)
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
         pin_set_at = now(),
         pin_provisional = p_provisional
   where id = p_staff;
end;
$$;

/* Choosing your own. Separate from set_staff_pin on purpose: this one requires the CURRENT pin,
   so a phone left signed in on a counter cannot be used to lock its owner out of their own
   account. It also refuses the setup code, which would otherwise let someone "change" their PIN
   to the one everybody already knows. */
create or replace function public.set_own_pin(p_staff uuid, p_current text, p_new text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ok boolean;
begin
  if p_new !~ '^[0-9]{4}$' then
    raise exception 'A PIN is exactly four digits';
  end if;
  if p_new in ('1234', '0000', '1111', '4321') then
    raise exception 'Choose four digits that are not a sequence or a repeat';
  end if;

  select (s.pin_hash = extensions.crypt(p_current, s.pin_hash))
    into v_ok
    from public.staff s
   where s.id = p_staff and s.pin_hash is not null;

  if not coalesce(v_ok, false) then
    return false;
  end if;

  update public.staff
     set pin_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)),
         pin_set_at = now(),
         pin_provisional = false
   where id = p_staff;
  return true;
end;
$$;

-- verify_staff_pin now reports whether the credential is still the issued one, so the surfaces
-- can route to "choose your own PIN" instead of to the floor.
drop function if exists public.verify_staff_pin(uuid, text);
create or replace function public.verify_staff_pin(p_restaurant uuid, p_pin text)
returns table (id uuid, name text, role text, initials text, provisional boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
    select s.id, s.name, s.role, s.initials, s.pin_provisional
      from public.staff s
     where s.restaurant_id = p_restaurant
       and s.removed_at is null
       and s.active
       and s.pin_hash is not null
       and s.pin_hash = extensions.crypt(p_pin, s.pin_hash)
     limit 1;
end;
$$;

-- Everyone who has never chosen their own PIN gets the shared setup code, marked provisional.
-- `pin_set_at` is deliberately not consulted: the earlier bootstrap set it, and treating that as
-- "they chose it" would grandfather in exactly the accounts this migration exists to close.
do $$
declare
  r uuid;
  s record;
begin
  select id into r from public.restaurant where slug = 'jalsa-hosur';
  for s in
    select st.id from public.staff st
     where st.restaurant_id = r
       and st.removed_at is null
       and st.pin_provisional = false
       and st.pin_hash is not null
  loop
    perform public.set_staff_pin(s.id, '1234', true);
  end loop;
end $$;

commit;
