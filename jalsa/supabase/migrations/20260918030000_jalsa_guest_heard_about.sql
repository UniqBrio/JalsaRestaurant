-- How a party found Jalsa, recorded against the visit.
--
-- WHY guest_session AND NOT bill
--   The question is asked on the landing screen, and at that moment there is no bill: a bill
--   opens on the first round (`ensureOpenBill`). A column on `bill` could not be written when
--   the question is answered. `guest_session` IS the visit — one row per phone per table, with
--   its own `restaurant_id` — so it is both available and correctly scoped.
--
-- WHY NOT A CUSTOMER RECORD
--   There isn't one. Jalsa is QR-first with no guest accounts; a guest is a table session, not
--   a person. So this is visit-level acquisition by construction, and nothing here can overwrite
--   a returning customer's historical answer, because no customer history exists to overwrite.
--
-- WHY A PLAIN text AND NOT AN enum OR A LOOKUP TABLE
--   The four seeded answers are a starting point, not a closed set — the request is explicit
--   that a guest may add one. An enum would need a migration per new answer; a lookup table
--   would need a write path from an unauthenticated phone into a shared restaurant-wide list,
--   which is a moderation surface nobody asked for. The option list is instead assembled the
--   way the expense-category list already is: the seeded answers, plus the distinct answers this
--   restaurant has actually recorded. A guest who types "Instagram" makes it appear for the next
--   guest, and it can never leak to another restaurant because the query is scoped by
--   restaurant_id.
--
-- Additive, defaulted, nullable-free. No existing row changes meaning and nothing is destructive.
alter table public.guest_session
  add column if not exists heard_about text not null default '';

-- Trimmed length only. Deliberately NOT a check against a fixed list, for the reason above.
alter table public.guest_session
  drop constraint if exists guest_session_heard_about_len;
alter table public.guest_session
  add constraint guest_session_heard_about_len
  check (length(btrim(heard_about)) <= 60);

-- The option list reads distinct answers per restaurant. Without this it is a sequential scan of
-- every session the restaurant has ever had, on the guest's landing screen.
create index if not exists guest_session_heard_about_idx
  on public.guest_session (restaurant_id, heard_about)
  where heard_about <> '';
