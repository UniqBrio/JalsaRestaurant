/**
 * reset-test-db - put the TEST project back to its seeded state before a suite runs.
 *
 * WHY A RESET AND NOT A CLEANUP
 *   The model rule "one open bill per table" (bill_table_one_open_per_table) means the second
 *   run of the guest journey would find the first run's still-open bill on the same table and
 *   land on its order list instead of the welcome screen. A journey spec needs a KNOWN starting
 *   state, and the only honest way to have one is to establish it before the run - not to hope
 *   the previous run tidied up after itself on the way out (it did not, if it failed).
 *
 * WHY IT CAN NEVER RUN AGAINST THE REAL PROJECT
 *   Three interlocks, all required, none sufficient alone:
 *     1. APP_ENV must be exactly "test".
 *     2. RESET_TEST_DB must be exactly "yes" - a deliberate flag, never a default.
 *     3. The project ref in NEXT_PUBLIC_SUPABASE_URL must not be on the deny-list below, which
 *        names the seeded development/production project by ref. A deny-list rather than an
 *        allow-list, because the test project's ref is set by the person who creates it and
 *        this file must be correct BEFORE that happens.
 *   Fail any of them and it exits 2 having deleted nothing, saying which.
 *
 * WHAT IT DELETES, IN ORDER, AND WHY THAT ORDER
 *   bill            -> cascades bill_table, kot, kot_item, tip; sets null on table_request,
 *                      suggestion and print_job bill_id (schema: on delete rules)
 *   guest_session   -> cascades guest_cart_line
 *   table_request, suggestion, print_job, audit_entry -> transactional rows with no cascade
 *   number_series   -> back to the seed values, so bill/KOT numbers are reproducible per run
 *   Nothing in the seed - restaurant, settings, tables, menu, staff, permissions, printers,
 *   expenses - is touched. The seed IS the fixture.
 *
 * Run: APP_ENV=test RESET_TEST_DB=yes node scripts/reset-test-db.mjs
 */
import { createClient } from '@supabase/supabase-js';

const DENY_PROJECT_REFS = new Set([
  // The seeded development project, which is also the one that becomes production. Never.
  'yxgxmbyilpivbmeemqkp',
]);

const SEED_COUNTERS = { bill: 1041, kot: 105, group: 7 };

/**
 * What the delete loop below has already emptied. Declared HERE, above refuse(), because refuse()
 * has to be able to read it: a failure on the sixth table happens with five already gone, and
 * "Nothing was deleted" would then be a false statement printed by the script's own error path.
 */
const deleted = {};

function refuse(reason) {
  console.error(`REFUSED [reset-test-db] ${reason}`);
  const done = Object.entries(deleted);
  if (done.length === 0) {
    console.error('  Nothing was deleted.');
  } else {
    console.error(`  ALREADY DELETED before this failure: ${done.map(([t, n]) => `${t}=${n}`).join(' ')}`);
    console.error('  The project is therefore NOT at its seeded state. Re-run the reset once the cause is fixed.');
  }
  process.exit(2);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SECRET_KEY ?? '';
const ref = (url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/) ?? [])[1];

if (process.env.APP_ENV !== 'test') refuse(`APP_ENV is "${process.env.APP_ENV ?? ''}", not "test".`);
if (process.env.RESET_TEST_DB !== 'yes') refuse('RESET_TEST_DB is not "yes". This flag is deliberate, never a default.');
if (!ref) refuse(`NEXT_PUBLIC_SUPABASE_URL "${url}" is not a Supabase project URL.`);
if (DENY_PROJECT_REFS.has(ref)) refuse(`project "${ref}" is the development/production project. This script must never touch it.`);
if (!key) refuse('SUPABASE_SECRET_KEY is not set.');

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

/**
 * PostgREST refuses an unfiltered delete; a tautology makes "everything" explicit.
 *
 * THE TAUTOLOGY IS THE PRIMARY KEY, NOT A TIMESTAMP
 *   This was `gte('created_at', '1970-01-01')`, which assumed a column name that five of these
 *   six tables happen to share. `audit_entry` timestamps with `at` — deliberately, see the core
 *   schema — so the loop emptied the other five and then died on its last table with
 *   `column audit_entry.created_at does not exist` (CI on main @ 91004d1).
 *
 *   `id` is the one column every table in the list is guaranteed to have, because every one of
 *   them has a primary key called `id`, and `id is not null` is true of every row BY DEFINITION
 *   rather than by convention. So this predicate cannot drift when a seventh table joins the
 *   list, and it never has to know what that table calls its clock.
 */
const everything = (table) => db.from(table).delete({ count: 'exact' }).not('id', 'is', null);

for (const table of ['bill', 'guest_session', 'table_request', 'suggestion', 'print_job', 'audit_entry']) {
  const { count, error } = await everything(table);
  if (error) refuse(`deleting ${table}: ${error.message}`);
  deleted[table] = count ?? 0;
}

const { data: restaurant, error: rErr } = await db.from('restaurant').select('id').eq('slug', 'jalsa-hosur').single();
if (rErr || !restaurant) refuse(`no restaurant "jalsa-hosur" - is this project seeded? ${rErr?.message ?? ''}`);

for (const [kind, next] of Object.entries(SEED_COUNTERS)) {
  const { error } = await db.from('number_series').update({ next_value: next }).eq('restaurant_id', restaurant.id).eq('kind', kind);
  if (error) refuse(`resetting number_series.${kind}: ${error.message}`);
}

console.log(`OK [reset-test-db] project ${ref}: ${Object.entries(deleted).map(([t, n]) => `${t}=${n}`).join(' ')}; counters -> bill ${SEED_COUNTERS.bill}, kot ${SEED_COUNTERS.kot}, group ${SEED_COUNTERS.group}`);
console.log('   SCOPE [reset-test-db] transactional tables only; the seed (restaurant, settings, tables, menu, staff, permissions, printers, expenses) was not touched.');
