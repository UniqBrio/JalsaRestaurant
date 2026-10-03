-- =============================================================================
-- Jalsa — a guest's heart on a dish is kept (03-Oct-2026).
--
-- WHY
--   The heart on "See my order" ("Tap the heart on anything you loved") was React state inside
--   the order screen and nothing else: no route, no table, no field in the guest payload. Any
--   trip to the menu, a new round, a reload or a second phone at the table reset every heart to
--   empty, and the owner could never learn which dishes guests loved. There was no store to fix;
--   this is it.
--
-- WHAT
--   `guest_favourite` - one row per dish per party (bill). The party is the customer here: every
--   phone at the table sees and changes the same hearts, and "how many customers loved it" counts
--   parties, not phones or taps. `unique (bill_id, menu_item_id)` makes a second tap of the same
--   heart a no-op rather than a second row.
--
--   `menu_item_id` is ON DELETE SET NULL and the dish's name is snapshotted beside it, like
--   `kot_item.name`: deleting a dish from the menu next month must not erase the fact that people
--   loved it. A bill deleted outright (an empty takeaway) takes its hearts with it - none can
--   exist, since a heart needs a served dish.
--
-- ACCESS: RLS enabled with no permissive policy, like every table here (rule 3) - that is what
-- keeps the browser's keys out, since Supabase's default privileges grant table rights on new
-- public tables to anon and authenticated. Those grants are also revoked below, so the table
-- answers "permission denied" to them outright. A guest writes only through
-- `/api/guest/favourite`, on their own session's bill, found by their own cookie, and only for a
-- dish served on that bill.
-- =============================================================================

begin;

create table if not exists public.guest_favourite (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid not null references public.restaurant(id) on delete cascade,
  bill_id          uuid not null references public.bill(id) on delete cascade,
  menu_item_id     uuid references public.menu_item(id) on delete set null,
  item_name        text not null check (length(btrim(item_name)) between 1 and 120),
  guest_session_id uuid references public.guest_session(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint guest_favourite_once_per_party unique (bill_id, menu_item_id)
);

alter table public.guest_favourite enable row level security;
revoke all on public.guest_favourite from anon, authenticated;

-- The owner's report reads a date range per restaurant; the guest payload reads one bill's.
create index if not exists guest_favourite_created_idx
  on public.guest_favourite (restaurant_id, created_at desc);

-- A heart moves its BILL's version - the counter every guest phone at the table polls
-- (`guestStamp`) - through the same trigger function the bill's other children use. A bump of
-- the 'floor' counter alone (the first draft) reached no guest phone at all: they never read it.
-- The bill's own update moves 'floor' as any child of a bill does, so nothing else changes.
drop trigger if exists guest_favourite_bill_version on public.guest_favourite;
create trigger guest_favourite_bill_version
  after insert or update or delete on public.guest_favourite
  for each row execute function public.bill_version_from_child();

commit;
