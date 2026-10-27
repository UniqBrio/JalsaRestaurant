-- ============================================================================================
-- Four trigger functions get a fixed search_path (27-Oct-2026, audit SEC-16).
--
-- WHY
--   The Supabase security advisor (function_search_path_mutable) lists these four: they resolve
--   unqualified names through the caller's search_path. They are trigger functions — not callable
--   through PostgREST — so the exposure is a role that can set its own search_path AND write these
--   tables, which today is only the service role. Pinned anyway: it costs nothing, it clears the
--   advisor, and it is the rule every other function here already follows.
--
-- WHAT CHANGES: configuration only. No body, no trigger, no data. `alter function ... set` takes a
-- brief lock on the function's catalog row.
--
-- ROLLBACK
--   alter function public.touch_updated_at() reset search_path;
--   alter function public.release_tables_on_close() reset search_path;
--   alter function public.print_job_printer_is_immutable() reset search_path;
--   alter function public.print_job_food_side_is_immutable() reset search_path;
-- ============================================================================================

alter function public.touch_updated_at() set search_path = public;
alter function public.release_tables_on_close() set search_path = public;
alter function public.print_job_printer_is_immutable() set search_path = public;
alter function public.print_job_food_side_is_immutable() set search_path = public;
