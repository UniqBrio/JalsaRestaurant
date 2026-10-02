-- =============================================================================
-- Jalsa — "Print elsewhere" can never print a ticket twice (02-Oct-2026).
--
-- WHY
--   Print elsewhere inserted a new job for the chosen machine and left the original exactly as it
--   was. When the original was still WAITING (its machine's PC off, say), the bridge kept listing
--   it - so the moment that PC came back, the original printed too: two tickets for one round in
--   the kitchen, the one printing mistake that costs real food.
--
-- WHAT
--   print_status gains 'cancelled': a job a person sent somewhere else before it printed. No
--   bridge lists it (they list 'queued'), no claim can take it (claims are conditional on
--   'queued'), and Retry refuses it.
--
--   redirect_print_job(...) does the redirect as ONE transaction, holding the original's row lock:
--     queued      -> the original is cancelled and the new job inserted, together;
--     processing  -> refused: a bridge is printing it at this moment, and cancelling it could not
--                    take back paper already moving;
--     cancelled   -> refused: it was already sent elsewhere;
--     failed      -> cancelled too, with its failure kept in the note: it printed nothing, and a
--                    failed original left 'failed' could be retried later - printing the round on
--                    its own machine as well as the new one (review, 02-Oct-2026);
--     printed     -> the new job is inserted, marked a reprint - the original is never cancelled.
--   The new job is a reprint when the original was one, or already printed.
--   The bridge's claim is `update ... set status = 'processing' where status = 'queued'`; the
--   row lock means whichever of the two reaches the row first wins and the other sees the result,
--   so exactly one of the two jobs can ever print.
--
-- `add value` is not USED in this file outside a function body (Postgres refuses a new enum label
-- in the transaction that added it; a plpgsql body is not executed here).
-- =============================================================================

begin;

alter type public.print_status add value if not exists 'cancelled';

create or replace function public.redirect_print_job(
  p_job_id        uuid,
  p_restaurant_id uuid,
  p_printer_id    uuid,
  p_printer_name  text,
  p_station       text,
  p_requested_by  text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  original public.print_job%rowtype;
  new_id   uuid;
begin
  select * into original
    from public.print_job
   where id = p_job_id and restaurant_id = p_restaurant_id
     for update;
  if not found then
    raise exception 'That ticket no longer exists. Reload the page.' using errcode = 'no_data_found';
  end if;
  -- The machine is this restaurant's too: the server checks it, and so does the one place that
  -- writes the job.
  if not exists (select 1 from public.printer where id = p_printer_id and restaurant_id = p_restaurant_id) then
    raise exception 'That printer is no longer configured. Reload the page.' using errcode = 'no_data_found';
  end if;

  if original.status::text = 'processing' then
    raise exception 'That ticket is being printed at % right now. Wait for it to print or fail, then choose again.',
      coalesce(nullif(original.printer_name, ''), 'its machine')
      using errcode = 'check_violation';
  end if;
  if original.status::text = 'cancelled' then
    raise exception 'That ticket was already sent to another machine.' using errcode = 'check_violation';
  end if;

  if original.status::text in ('queued', 'failed') then
    update public.print_job
       set status = 'cancelled',
           completed_at = now(),
           last_error = 'Sent to ' || p_printer_name || ' instead - not printed here.'
             || case when original.last_error <> '' then ' Before that: ' || original.last_error else '' end
     where id = p_job_id;
  end if;

  insert into public.print_job (
    restaurant_id, printer_id, printer_name, station, routing_rule, food_side, kind, kot_id, bill_id,
    status, attempts, is_reprint, requested_by, last_error, completed_at, redirected_from_job_id
  ) values (
    p_restaurant_id, p_printer_id, p_printer_name, p_station, 'chosen', coalesce(original.food_side, 'all'),
    original.kind, original.kot_id, original.bill_id,
    'queued', 0, original.is_reprint or original.status::text = 'printed', p_requested_by, '', null, original.id
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- Called only by this application's server, with the secret key (rule 3). It runs as the caller,
-- so RLS would stop anyone else anyway; the grant says so in the schema as well.
revoke execute on function public.redirect_print_job(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.redirect_print_job(uuid, uuid, uuid, text, text, text) to service_role;

commit;
