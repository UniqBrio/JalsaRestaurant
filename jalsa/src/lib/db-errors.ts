/**
 * db-errors — telling a deployment fault apart from a bad night on the network.
 *
 * WHY THIS ONE DISTINCTION EARNS A MODULE
 *   "Nothing you did was lost — try again" is the right thing to say about a dropped connection
 *   or a statement timeout. It is ACTIVELY WRONG about the code and the schema disagreeing:
 *   retrying an ambiguous function never once succeeds, and the sentence sends somebody tapping
 *   a button that cannot work while the real problem sits in a migration.
 *
 *   That is not hypothetical. On 17-Sep-2026 the owner's "Give them the app" and "Reissue PIN"
 *   both returned 42725 — `set_staff_pin` existed twice, so PostgREST could not choose — and the
 *   screen advised trying again. It was advice that could not come true.
 *
 * IT LIVES HERE, NOT IN `route.ts`, because `route.ts` imports `next/server` and the unit tier
 * cannot resolve that. A predicate a rung cannot execute is a predicate nothing checks, and this
 * one exists precisely because nothing was checking.
 *
 * AND IT STILL DID NOT FIRE. See the second block of codes below: the module knew the database's
 * vocabulary and not PostgREST's, so the fault it was written for never matched it.
 */

/**
 * The four SQLSTATEs that all mean the same thing: the application asked the database for
 * something it does not have, or has twice.
 *
 * Deliberately short. A long list would start absorbing codes that ARE worth retrying — a
 * serialization failure, a lock timeout — and the value here is entirely in the two sets being
 * disjoint.
 */
const SCHEMA_FAULTS = new Set([
  // ── PostgreSQL SQLSTATEs, seen when the error reaches us from the database itself ──────────
  '42725', // ambiguous_function  — two overloads, PostgREST cannot choose
  '42883', // undefined_function  — the RPC name does not exist
  '42703', // undefined_column    — a hand-written column name that is not there
  '42P01', // undefined_table     — a migration that never ran

  /*
    ── PostgREST's OWN codes, added 18-Sep-2026 ──────────────────────────────────────────────
    THE REASON THIS MODULE EXISTED AND STILL DID NOT WORK.

    The four SQLSTATEs above were chosen from an error observed by running SQL directly. But the
    application does not run SQL directly — every call goes through PostgREST, and PostgREST
    resolves schema problems ITSELF, before Postgres is ever asked. When it does, it answers with
    a `PGRST***` code of its own and the SQLSTATE never appears.

    So the exact fault this module was written for — `set_staff_pin` existing twice — arrives as
    `PGRST203`, matches nothing here, and falls through to "Nothing you did was lost — try
    again." The one message written to say "retrying cannot help" could not fire for the one
    error it was written about. That is why the owner has been told to retry an action that has
    never once succeeded.

    Verified against the live production schema on 18-Sep-2026: `set_staff_pin` still has both
    signatures, because `20260917120000_jalsa_drop_ambiguous_set_staff_pin.sql` — the migration
    written to drop the narrow one — has never been applied there.
  */
  'PGRST202', // the function does not exist in the schema cache
  'PGRST203', // could not choose between overloaded functions  ← the 17-Sep fault, as it ARRIVES
  'PGRST204', // the column does not exist in the schema cache
]);

/**
 * True when the failure is the schema, not the weather.
 *
 * Reads `code` off an `unknown` rather than narrowing on `instanceof Error`: a `PostgrestError`
 * from supabase-js is a PLAIN OBJECT, so `err instanceof Error` is false for exactly the errors
 * this is about.
 */
export function isSchemaFault(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' && SCHEMA_FAULTS.has(code);
}

/** What the browser is told. Names no identifier, no SQL and no code — only whether to retry. */
export const SCHEMA_FAULT_MESSAGE =
  'This action is not set up correctly on our side. Trying again will not help — it has been logged with the details.';
