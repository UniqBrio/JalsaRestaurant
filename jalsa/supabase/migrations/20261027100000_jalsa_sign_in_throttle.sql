-- ============================================================================================
-- Sign-in throttling, in the database: per network, per surface, bounded globally, exact under
-- concurrency (27-Oct-2026, P-5; audit SEC-03 / N-06).
--
-- WHAT IT REPLACES, AND WHY
--   An in-memory window in the route: 10 attempts a minute per server process, shared by EVERY
--   person. One captain's three fat-fingered attempts and a handful of correct sign-ins at shift
--   change locked the whole restaurant out for a minute (the performance rig hit it within
--   seconds), while an attacker got 10 guesses a minute per process — per process, so the
--   platform's instance count multiplied it, and a restart forgot it. 14,400 guesses a day against
--   a four-digit PIN space with 27 holders.
--
-- THE RULES (failures only — a correct PIN never spends anyone's allowance)
--   A "network" is a keyed hash of the client's address computed by the application (IPv6 reduced
--   to its /64), so no address is stored. A network is TRUSTED while it has had a correct PIN in
--   the last 14 hours — the restaurant's own wifi, all evening.
--     per network, 15 minutes:     5 failures (untrusted)   10 (trusted)
--     per network, 24 hours:      20 failures (untrusted)   50 (trusted)
--     all untrusted networks together, per surface, 15 minutes:  staff app 30, owner console 15
--   The last is the bound on a DISTRIBUTED guesser (many addresses, few guesses each); trusted
--   networks are exempt from it, so an attack from outside cannot lock the restaurant's own wifi
--   out. An insider on the trusted wifi still meets the per-network limits: 50 guesses a day, not
--   14,400. Four digits remain four digits; see docs/audit/SECURITY_REMEDIATION_PLAN.md.
--
-- EXACT UNDER CONCURRENCY, WITHOUT SERIALISING BCRYPT
--   The PIN is checked first, with no lock held (bcrypt is the slow part). Then ONE transaction-
--   scoped advisory lock is taken just to count and record — milliseconds — so fifty parallel
--   guesses from one address are counted one after another and the sixth is refused, however they
--   arrive. Over a limit, the answer is "throttled" WHETHER OR NOT the PIN was right: the limit
--   is never an oracle. A cheap unlocked pre-check refuses an already-throttled network before
--   spending bcrypt on it.
--
-- WHAT THE APPLICATION SEES: one call, as before (src/lib/db/auth.ts). Where this migration has not
-- run, the function is missing and the application falls back to the old path, saying so in the
-- log — so merging the code cannot break a database that is behind.
--
-- RLS / PRIVILEGES: the table has RLS enabled with no policy and no grant to the API roles. The
-- function is SECURITY DEFINER (it must read pin_hash, as verify_staff_pin does) with a fixed
-- search_path, executable by service_role only — the same lock as every privileged function here
-- (20261003090000). Inputs are validated inside: a PIN is four digits, a surface is one of two.
--
-- ROLLBACK: the application falls back by itself once the function is gone.
--   drop function if exists public.sign_in_with_pin(uuid, text, text, text);
--   drop table if exists public.sign_in_attempt;
-- ============================================================================================

create table if not exists public.sign_in_attempt (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  net text not null check (length(net) between 1 and 64),
  surface text not null check (surface in ('staff', 'owner')),
  ok boolean not null
);
create index if not exists sign_in_attempt_net_at_idx on public.sign_in_attempt (net, at);
create index if not exists sign_in_attempt_at_idx on public.sign_in_attempt (at);
alter table public.sign_in_attempt enable row level security;
revoke all on table public.sign_in_attempt from public, anon, authenticated;

create or replace function public.sign_in_with_pin(p_restaurant uuid, p_pin text, p_net text, p_surface text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_trusted boolean;
  v_net_15 int;
  v_net_day int;
  v_global int;
  v_limit_15 int;
  v_limit_day int;
  v_limit_global int;
  v_oldest timestamptz;
  v_span interval;
  v_id uuid;
  v_name text;
  v_role text;
  v_initials text;
  v_provisional boolean;
begin
  if p_surface is null or p_surface not in ('staff', 'owner') then
    raise exception 'surface must be staff or owner';
  end if;
  if p_net is null or length(p_net) not between 1 and 64 then
    raise exception 'net must be 1 to 64 characters';
  end if;

  -- Old rows go; two days covers the longest window with room.
  delete from public.sign_in_attempt where at < now() - interval '2 days';

  select exists (
    select 1 from public.sign_in_attempt
     where net = p_net and ok and at > now() - interval '14 hours'
  ) into v_trusted;
  v_limit_15 := case when v_trusted then 10 else 5 end;
  v_limit_day := case when v_trusted then 50 else 20 end;
  v_limit_global := case when p_surface = 'owner' then 15 else 30 end;

  -- The PIN, with no lock held — unless this network has already spent its allowance (a cheap
  -- refusal that spends no bcrypt). Anything that is not four digits is simply a wrong PIN.
  select count(*) filter (where at > now() - interval '15 minutes'), count(*)
    into v_net_15, v_net_day
    from public.sign_in_attempt
   where net = p_net and not ok and at > now() - interval '24 hours';
  if v_net_15 < v_limit_15 and v_net_day < v_limit_day and p_pin ~ '^[0-9]{4}$' then
    select v.id, v.name, v.role, v.initials, v.provisional
      into v_id, v_name, v_role, v_initials, v_provisional
      from public.verify_staff_pin(p_restaurant, p_pin) v;
  end if;

  -- Count again and record, under one short lock, so concurrent attempts are counted one by one.
  perform pg_advisory_xact_lock(hashtextextended('jalsa.sign_in_attempt', 0));
  select count(*) filter (where at > now() - interval '15 minutes'), count(*)
    into v_net_15, v_net_day
    from public.sign_in_attempt
   where net = p_net and not ok and at > now() - interval '24 hours';
  select count(*) into v_global
    from public.sign_in_attempt a
   where a.surface = p_surface and not a.ok and a.at > now() - interval '15 minutes'
     and not exists (
       select 1 from public.sign_in_attempt t
        where t.net = a.net and t.ok and t.at > now() - interval '14 hours');

  -- Over a limit: refused, right PIN or wrong, and not recorded (a refusal is not a guess). The
  -- wait is until the oldest counted failure leaves the window that tripped.
  if v_net_day >= v_limit_day then
    v_span := interval '24 hours';
    select min(at) into v_oldest from public.sign_in_attempt
     where net = p_net and not ok and at > now() - v_span;
  elsif v_net_15 >= v_limit_15 then
    v_span := interval '15 minutes';
    select min(at) into v_oldest from public.sign_in_attempt
     where net = p_net and not ok and at > now() - v_span;
  elsif not v_trusted and v_global >= v_limit_global then
    v_span := interval '15 minutes';
    select min(a.at) into v_oldest from public.sign_in_attempt a
     where a.surface = p_surface and not a.ok and a.at > now() - v_span
       and not exists (
         select 1 from public.sign_in_attempt t
          where t.net = a.net and t.ok and t.at > now() - interval '14 hours');
  end if;
  if v_span is not null then
    return jsonb_build_object(
      'result', 'throttled',
      'retry_after', greatest(1, ceil(extract(epoch from (coalesce(v_oldest, now()) + v_span - now())))::int));
  end if;

  insert into public.sign_in_attempt (net, surface, ok) values (p_net, p_surface, v_id is not null);
  if v_id is null then
    return jsonb_build_object('result', 'refused');
  end if;
  return jsonb_build_object(
    'result', 'ok',
    'staff', jsonb_build_object(
      'id', v_id, 'name', v_name, 'role', v_role, 'initials', v_initials, 'provisional', v_provisional));
end;
$$;

revoke all on function public.sign_in_with_pin(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.sign_in_with_pin(uuid, text, text, text) to service_role;
