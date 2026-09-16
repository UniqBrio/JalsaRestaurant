-- =============================================================================
-- 20260916090000_jalsa_waitlist
--
-- The entrance queue: parties waiting for a table, and the four things that happen to one.
--
-- WHY THIS IS A TABLE AND NOT A SETTING OR A SCREEN'S STATE
--   A waiting party is shared, contested, live state. The person at the door adds it, a captain
--   seats it, the guest's own phone shows their position, and the owner's Day setup asks whether
--   the queue is open at all. Four surfaces read the same rows within seconds of each other, so
--   it cannot live in a component, in a settings document, or on one device. It is also the one
--   piece of Jalsa state with a person physically standing in front of it: a lost row is a party
--   who was told twenty minutes and then forgotten.
--
-- WHY THE CODE IS STORED AND NOT DERIVED
--   `code` is the four digits a guest reads back at the door to claim their turn. Derived from
--   the id it would be guessable from the id; regenerated on read it would change between the
--   moment they were told it and the moment they say it. Stored once, at insert, it is the same
--   four digits on the host's screen and on the guest's phone.
--
-- WHY `pair` EXISTS ALONGSIDE IT
--   A two-word name ("Amber Lotus") is what gets CALLED ACROSS A ROOM. Numbers mishear — 4821
--   and 4831 sound identical over a full dining room — and a surname is neither ours to ask for
--   nor pleasant to shout. The design set uses the pair as the spoken handle and the code as the
--   silent one, and both are needed for the same party.
--
-- THE LIFECYCLE IS THREE NULLABLE TIMESTAMPS, NOT A STATUS COLUMN
--   notified_at / seated_at / removed_at. A status enum would have to answer "notified AND then
--   removed" with one value and would lose the first fact; three stamps keep both, and every
--   report about how long a party actually waited is a subtraction rather than a guess. A row is
--   WAITING while all three are null. This is the same shape `bill_table.released_at` uses, so
--   there is one idiom for "this happened, here is when", not two.
--
-- WHAT THIS MIGRATION DOES NOT DO
--   It does not seat anyone automatically and it creates no bill. Seating is a captain's act on
--   a real table, and linking a waitlist row to a bill would make the queue a second way to open
--   one — there is exactly one (`ensureOpenBill`), and a second would eventually disagree with it
--   about the one-open-bill-per-table rule.
-- =============================================================================

begin;

create table if not exists public.waitlist_entry (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurant(id) on delete cascade,

  -- The token the host says out loud ("W-18"), unique per restaurant per day's run of numbers.
  token          text not null,
  -- The spoken handle. See the note above on why a code alone is not enough.
  pair           text not null default '',
  -- The four digits the guest reads back. Text, not int: leading zeros are real digits here.
  code           text not null,

  party_size     int  not null check (party_size > 0),
  phone          text not null default '',
  -- How they joined: 'scanned' (their own phone, from the entrance QR) or 'walk_in' (the host
  -- typed them in). Recorded at insert because it cannot be reconstructed afterwards, and it is
  -- what answers "is the entrance code actually being used?" — the same argument as kot.source.
  source         text not null default 'walk_in' check (source in ('scanned', 'walk_in')),

  joined_at      timestamptz not null default now(),
  notified_at    timestamptz,
  seated_at      timestamptz,
  removed_at     timestamptz,
  removed_reason text not null default '',

  -- Who seated or removed them. Named, for the same reason a closure is named: it is the
  -- difference between a record and a claim.
  actor_label    text not null default '',

  created_at     timestamptz not null default now(),

  -- A party cannot be both seated and abandoned. Either stamp alone is fine; both is a
  -- contradiction the database should refuse rather than a report should explain.
  constraint waitlist_entry_one_ending check (seated_at is null or removed_at is null)
);

-- The queue is always read as "who is still waiting, oldest first". A partial index over
-- exactly that predicate keeps the common read cheap as the day's finished rows accumulate.
create index if not exists waitlist_entry_waiting_idx
  on public.waitlist_entry (restaurant_id, joined_at)
  where seated_at is null and removed_at is null;

-- Two live parties must never hold the same token: the host calls it across a room and two
-- parties standing up is the failure. Finished rows are excluded so tokens can be reused
-- tomorrow without a reset.
create unique index if not exists waitlist_entry_live_token_idx
  on public.waitlist_entry (restaurant_id, token)
  where seated_at is null and removed_at is null;

-- RLS: on, with no policy — the posture every other table here takes. ENABLE and deliberately
-- not FORCE, so the migration's own owner connection can seed, while anon and authenticated get
-- nothing at all and the server's secret key is the only caller. See the posture note in
-- 20260910070000_jalsa_core_schema.sql.
alter table public.waitlist_entry enable row level security;

-- ---------------------------------------------------------------------------
-- The token comes from the SAME number series every other document uses.
--
-- `next_number` raises if no series row exists for the kind, and `number_series.kind` carries a
-- CHECK listing exactly bill / kot / group — so a fourth kind is a real schema change, not a
-- row. Widening the constraint is deliberate: the alternative was a second numbering mechanism
-- living in TypeScript, which would not take the row lock the function takes and would hand two
-- simultaneous walk-ins the same token. One idiom, one lock, one source of numbers.
-- ---------------------------------------------------------------------------
alter table public.number_series drop constraint if exists number_series_kind_check;
alter table public.number_series add constraint number_series_kind_check
  check (kind in ('bill', 'kot', 'group', 'waitlist'));

do $$
declare
  r uuid;
begin
  select id into r from public.restaurant where slug = 'jalsa-hosur';

  insert into public.number_series (restaurant_id, kind, prefix, next_value) values
    (r, 'waitlist', 'W-', 1)
  on conflict (restaurant_id, kind) do nothing;

  -- The queue's own permissions already exist in the matrix (queue.view / walkin / seat /
  -- notify / clear / close) — they were defined when the roles were, ahead of the screen. The
  -- owner gets them here; everyone else is granted per person on the Staff screen, because
  -- "the owner can pass this to someone" is a grant and not a preset.
  insert into public.staff_permission (staff_id, perm_key, granted, granted_by)
  select st.id, k, true, 'setup'
  from public.staff st
  cross join unnest(array['queue.view', 'queue.walkin', 'queue.seat', 'queue.notify',
                          'queue.clear', 'queue.close']) as k
  where st.restaurant_id = r
    and st.role = 'Owner / Admin'
  on conflict (staff_id, perm_key) do nothing;
end $$;

commit;
