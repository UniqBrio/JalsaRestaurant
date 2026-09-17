-- =============================================================================
-- 20260917120000_jalsa_drop_ambiguous_set_staff_pin
--
-- "Give them the app" and "Reissue PIN" both failed, and the reason was two functions.
--
-- WHAT HAPPENED
--   `20260910071000_jalsa_seed_and_pin.sql` created:
--       set_staff_pin(p_staff uuid, p_pin text)
--
--   `20260910073000_jalsa_provisional_pins.sql` then wrote:
--       create or replace function public.set_staff_pin(p_staff uuid, p_pin text,
--                                                       p_provisional boolean default false)
--
--   `create or replace function` replaces a function with the SAME signature. A third parameter
--   is a different signature, so that statement did not replace anything — it created a SIBLING,
--   and the two-argument original was left in place.
--
--   Because the new parameter carries `default false`, BOTH functions are callable with just
--   `(p_staff, p_pin)`. PostgREST resolves an RPC by the names in the JSON body, so
--   `.rpc('set_staff_pin', { p_staff, p_pin })` matches both and Postgres refuses to guess:
--
--       ERROR 42725: function public.set_staff_pin(p_staff => uuid, p_pin => unknown)
--                    is not unique
--       HINT: Could not choose a best candidate function.
--
--   Observed directly, on the test project, with a UUID matching no row so nothing was written.
--
-- THE AUTHOR KNEW THIS HAZARD — line 90 of that same migration reads
--   `drop function if exists public.verify_staff_pin(uuid, text);`
-- before replacing `verify_staff_pin` with a wider signature. The correct pattern was six lines
-- of SQL away from the omission. That is worth recording because it says the defect was a
-- MISSED STEP, not a misunderstanding, and a missed step is what a rung catches.
--
-- WHY DROPPING IS SAFE FOR A REPLAY FROM SCRATCH
--   `20260910072000` calls `set_staff_pin(s.id, s.pin)` positionally, and it runs BEFORE the
--   three-argument version exists — at that moment there is exactly one candidate and the call
--   resolves. This migration runs last, so a fresh database ends with one function and every
--   historical migration still applies in order.
--
-- WHY THE THREE-ARGUMENT ONE IS THE SURVIVOR
--   It is the one the application wants. `pin_provisional` is what makes guardrail 5 true — an
--   issued PIN opens "choose your own PIN" and nothing else — and the two-argument version
--   cannot set it, so a PIN issued through it would silently open the whole application.
-- =============================================================================

begin;

drop function if exists public.set_staff_pin(uuid, text);

commit;
