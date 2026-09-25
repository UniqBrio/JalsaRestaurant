-- =============================================================================
-- 20260925100000_jalsa_item_routing_and_media
--
-- 25-Sep correction list, items 23, 25, 26 (and 32, which uses the same bucket).
--
-- 1. PER-ITEM ROUTING (items 25, 26)
--    Routing was per category only: each printer holds a list of category NAMES. The owner now
--    also chooses, per dish, a printer and/or a station. Both are nullable: null means "as the
--    category routes", which is every dish today, so nothing moves until somebody chooses.
--
-- 2. THE DECISION IS SNAPSHOT ON THE LINE, like the category name already is
--    A round is routed when it is placed. `kot_item.route_printer_id` / `route_station` record the
--    item-level choice that applied at that moment, so the job, the composed ticket and a reprint
--    hours later all resolve the line the same way - the reason `menu_category_name` is a snapshot
--    (see 20260922090000). Null on every line written before this migration: those lines route by
--    category exactly as they did.
--
-- 3. IMAGES (items 23, 32)
--    A private Storage bucket. The browser never talks to Supabase (guardrail 3): the app uploads
--    with its server key after checking the bytes, and serves the file back through its own
--    /api/media route. The limits here repeat the app's: PNG or JPEG, 1 MB.
-- =============================================================================

alter table public.menu_item
  add column if not exists printer_id uuid references public.printer(id) on delete set null,
  add column if not exists station text check (station is null or length(btrim(station)) between 1 and 40);

alter table public.kot_item
  add column if not exists route_printer_id uuid references public.printer(id) on delete set null,
  add column if not exists route_station text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 1048576, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;
