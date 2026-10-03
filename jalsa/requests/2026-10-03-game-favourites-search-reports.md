# Request — game, favourites, owner search and guest reports (03-Oct-2026)

**TYPE** enhancement ×3 + defect ×1 · **RUN MODE** auto · **SCALE** scoped · **PRODUCTION** not touched, not deployed

## THE ASK (the owner's words, condensed)
1. Make the food-catching game a real mini-game: the guest's **own order** as emoji + name, an
   **enemy** to avoid, **Easy / Moderate / Hard** that change play, **points**, a **plate** instead of
   the brown slate, the line *"Catch your ordered food. Avoid the bad item!"* — shown on the
   **order-placed confirmation** screen, not on "See my order".
2. The favourite (♥) icon "is not working" — find the root cause, make it persist.
3. A search bar in the owner console that finds **screens** (not data), with keyboard and touch,
   ranked, filtered by permission, never inventing a route.
4. Reports: **People Loved Items** from real favourites; **How did you hear about us?** answers
   shown clearly under Reports (the owner believes about 10 people answered).

## ROOT CAUSES (established before code)
| # | Question | Answer |
|---|---|---|
| 1 | Why was the game on "See my order"? | It was built (18-Sep) as the *waiting* experience: `StatusScreen` rendered it for `activeCravingRound` - the round furthest along that was still `new`/`preparing` - so it lived on the screen that lists rounds. |
| 2 | How are order items available after placement? | `/api/guest/round` returns `kotCode` and echoes the fresh payload; `data.rounds[].items` carry `{id (kot_item), name, qty, foodType}`. The game previously ignored them and drew `cravingPool` from the whole **menu** by route. |
| 3 | Why did the heart not work? | It was `useState` inside `StatusScreen` and nothing else: no route, no table, no payload field. Any navigation, new round, reload or second phone reset it; it was keyed by the KOT line, not the dish. |
| 4 | Where were favourites persisted? | Nowhere. No table or column existed (the `favourites` feature flag is unrelated and unread). |
| 5 | Where is "How did you hear about us?" persisted? | `guest_session.heard_about` (since 18-Sep) and, from the 02-Oct migration `20261002110000`, `guest_attribution` (rows that survive a session's deletion). On PRODUCTION only the first exists - the 02-Oct feature migrations are not applied there. |
| 6 | Where was the attribution report shown? | `HeardAboutCard` (UpliftSection.tsx) - in Uplift (fixed 30 days) and at the foot of Reports → Sales & products (rep.sales only), reading `guest_attribution` through `/api/owner/heard`. |
| 7 | What powers the owner's navigation? | Client state only (`section` + `arg` in OwnerConsole); no URL routes. `SECTIONS` (14, each with one grant), `REPORT_TABS`, Settings `PANELS` (10, each with its own grant). |

**On the "about 10 answers":** read-only on production (03-Oct): 17 guest sessions, **1** answer
("Google review", 1-Oct). The audit log has **10** "Table freed by hand" entries - freeing a table
deletes its guest sessions, and before `20261002110000` the answer lived only on the session. The
missing answers were very likely deleted with those sessions and cannot be recovered;
`guest_attribution` stops it happening again once that migration reaches production.

## DECISIONS
- Game rules live in `src/lib/craving.ts` (pure, tested); the enemy is a germ 🦠 (not food, plainly
  unwanted); a germ costs 15 points (never below 0) and one of 3 lives; levels change fall time,
  spawn rate, germ share and plate width. Bound to `placedCode` - the round THIS phone just sent.
- A heart is per **party (bill) and dish**: one row, `unique (bill_id, menu_item_id)`; only for a
  dish served on that bill; enforced by the owner's `heart` switch on the server.
- Hearts are read inside the bill read (`BILL_SELECT`), costing the guest poll no round trip.
  **Consequence: the migration must reach an environment before this code does.**
- The heard report is REUSED (same card, same endpoint), moved to a new Reports tab
  **Guest insights** beside People loved items; Uplift keeps its own copy.
- Search registry: labels and grants come from the console's own lists; `owner-search.ts` adds
  only words; a hint naming no real screen fails a spec.

## THE FIVE PERMISSION QUESTIONS
1. **Who can do it?** Heart: a guest, on their own session's bill (cookie), no grant. People loved
   items: `rep.products`. How guests found Jalsa: `rep.sales` (unchanged). Search: anyone in the
   console; it shows only screens their grants open.
2. **What changes when a setting is off?** `heart` off: no button, and the route refuses a new
   heart (taking one back stays allowed). `craving` off: no game.
3. **Can it reach another party's data?** No - no bill id is accepted from the guest; the served
   check reads THIS bill only; the report is scoped by `restaurant_id`.
4. **What does the database enforce?** RLS on, no policy, default grants to anon/authenticated
   revoked; one heart per dish per bill; non-empty name.
5. **Where is it recorded?** `docs/registers/RBAC_MATRIX.md` (four rows, 03-Oct-2026).

## NOT DONE / OPEN
- Production: nothing applied or deployed.
- TEST: `20261004090000_jalsa_guest_favourite` is NOT applied. Three `apply_migration` calls timed
  out in the Supabase connector (03-Oct, ~20:52-21:10 UTC); after each, the table was absent, no
  history row existed and nothing was running - verified, so none half-applied. It is proven on
  PGlite (`favourites.db.unit.spec.ts`, every migration from scratch). Apply it to TEST before
  this code runs there: the bill read now embeds `guest_favourite`.
- `PRODUCT_LEXICON.md` exists only as the framework template at the repository root; the new terms
  (Germ, points, Easy / Moderate / Hard, Lives, heart, People loved items, Guest insights, Search the
  console) are recorded here as PROVISIONAL instead.
- Copy-review candidates left as they are (shipped strings): `send()` passes a raw fetch error to the
  cart toast; HeardAboutCard's read-failure line has no next step.
- Pre-existing, not changed: a provisional-PIN session is held to "choose your own PIN" by the pages,
  not by the owner API routes.
