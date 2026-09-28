/**
 * The restaurant's Food Type list and its KOT Classification, against a real Postgres (28-Sep-2026).
 *
 * The owner asked for Food Types of their own (Fish, Dessert, Juice, Seafood...) each carrying a
 * separate KOT Classification - Veg, Non-veg, Egg or Other - with Veg/Non-veg/Egg working as
 * before. These cases run every migration in supabase/migrations in filename order on PGlite and
 * then exercise the triggers that keep a dish's classification equal to its Food Type's.
 */
import { test, expect } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = fileURLToPath(new URL('../../supabase/migrations', import.meta.url));

/** What Supabase provides before any migration runs (the same prelude as change-versions.db). */
const SUPABASE_PRELUDE = `
  create schema extensions; create extension pgcrypto with schema extensions;
  create schema auth; create table auth.users (id uuid primary key);
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema storage; create table storage.buckets (id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  set search_path = public, extensions;
`;

let db: PGlite;

async function rows<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  return (await db.query<T>(sql)).rows;
}
async function one<T = Record<string, unknown>>(sql: string): Promise<T> {
  const row = (await rows<T>(sql))[0];
  if (!row) throw new Error(`no row: ${sql}`);
  return row;
}
const dishClass = async (name: string) =>
  (await one<{ c: string }>(`select food_type::text c from menu_item where name = '${name}'`)).c;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_PRELUDE);
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('00000000000000'))
    .sort();
  for (const f of files) await db.exec(readFileSync(`${MIGRATIONS}/${f}`, 'utf8'));
});

test('every restaurant starts with Veg, Non-veg and Egg, each carrying its own classification', async () => {
  const types = await rows<{ name: string; kot_class: string }>(
    `select name, kot_class::text from menu_food_type order by sort`
  );
  expect(types).toEqual([
    { name: 'Veg', kot_class: 'veg' },
    { name: 'Non-veg', kot_class: 'non_veg' },
    { name: 'Egg', kot_class: 'egg' },
  ]);
});

test('every existing dish points at the type matching what it already was - nothing reclassified', async () => {
  const mismatched = await one<{ n: number }>(`
    select count(*)::int n from menu_item m left join menu_food_type f on f.id = m.food_type_id
     where f.id is null or f.kot_class <> m.food_type`);
  expect(mismatched.n).toBe(0);
  expect((await one<{ n: number }>(`select count(*)::int n from menu_item`)).n).toBe(57);
});

test('a new Food Type takes its own name and a separate classification; its dishes take the classification', async () => {
  await db.exec(`
    insert into menu_food_type (restaurant_id, name, kot_class, sort)
      select id, 'Fish', 'non_veg', 4 from restaurant;
    insert into menu_food_type (restaurant_id, name, kot_class, sort)
      select id, 'Dessert', 'other', 5 from restaurant;
  `);
  const dessert = await one<{ name: string; food_type: string }>(
    `select name, food_type::text from menu_item where food_type = 'veg' order by name limit 1`
  );
  await db.exec(`update menu_item set food_type_id = (select id from menu_food_type where name = 'Dessert')
                  where name = '${dessert.name.replace(/'/g, "''")}'`);
  expect(await dishClass(dessert.name.replace(/'/g, "''"))).toBe('other');

  const fishDish = await one<{ name: string }>(
    `select name from menu_item where food_type = 'veg' order by name offset 1 limit 1`
  );
  await db.exec(`update menu_item set food_type_id = (select id from menu_food_type where name = 'Fish')
                  where name = '${fishDish.name.replace(/'/g, "''")}'`);
  expect(await dishClass(fishDish.name.replace(/'/g, "''"))).toBe('non_veg');
});

test('a dish cannot claim a classification its Food Type does not have', async () => {
  await db.exec(`update menu_item set food_type = 'veg'
                  where food_type_id = (select id from menu_food_type where name = 'Fish')`);
  const fish = await rows<{ c: string }>(`select food_type::text c from menu_item
                                            where food_type_id = (select id from menu_food_type where name = 'Fish')`);
  expect(fish.length).toBe(1);
  expect(fish[0]?.c).toBe('non_veg');
});

test('re-classifying a Food Type re-classifies its dishes', async () => {
  await db.exec(`update menu_food_type set kot_class = 'veg' where name = 'Fish'`);
  const fish = await one<{ c: string }>(`select food_type::text c from menu_item
                                          where food_type_id = (select id from menu_food_type where name = 'Fish')`);
  expect(fish.c).toBe('veg');
  await db.exec(`update menu_food_type set kot_class = 'non_veg' where name = 'Fish'`);
});

test('an older writer that sends only the classification still lands on a Food Type', async () => {
  await db.exec(`
    insert into menu_item (restaurant_id, category_id, name, price, food_type)
      select r.id, c.id, 'Old-writer egg dish', 90, 'egg'
        from restaurant r, lateral (select id from menu_category order by sort limit 1) c`);
  const row = await one<{
    name: string;
  }>(`select f.name from menu_item m join menu_food_type f on f.id = m.food_type_id
                                            where m.name = 'Old-writer egg dish'`);
  expect(row.name).toBe('Egg');
});

test('names are unique per restaurant, whatever the case or spacing', async () => {
  await expect(
    db.exec(
      `insert into menu_food_type (restaurant_id, name, kot_class) select id, '  fish ', 'non_veg' from restaurant`
    )
  ).rejects.toThrow(/duplicate key|unique/i);
});

test('rounds already placed carry the Food Type name for reports', async () => {
  const blank = await one<{ n: number }>(`select count(*)::int n from kot_item where food_type_name = ''`);
  expect(blank.n).toBe(0);
});
