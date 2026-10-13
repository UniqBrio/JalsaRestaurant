# Request — delete a dish straight from the off-menu strip; Edit and Delete as icons only (13-Oct-2026)

**TYPE** enhancement ×2 · **RUN MODE** auto · **SCALE** scoped · **PRODUCTION** not touched, not deployed · **MIGRATION** none

## THE ASK (the owner's words)
1. "Enable direct deletion of off-menu items from the customer menu without requiring users to add the
   items back before deleting them."
2. "Replace the edit and delete button with text with only edit and delete icon across app."

## WHY IT WAS SO
- **1.** The server never needed the dish back on: `deleteMenuItem` deletes whatever the availability.
  The screen did. Owner console → Menu shows the dishes that are off in a strip, "Off the customer menu
  right now", and each chip offered **Put back** and nothing else. The Delete added on 12-Oct sits only
  in the table row, further down, so from the strip the visible path to delete was: put it back on
  every guest's phone, find its row, delete it.
- **2.** Every Edit and Delete was a text button, built one at a time on each screen.

## DECISIONS
- **Delete on the strip:** a bin icon on each off-menu chip, for holders of `menu.item_edit` (the grant
  that adds, edits and deletes a dish), beside Put back (`menu.availability`). It opens the SAME
  confirmation as the row's Delete - one `deleting` state, one `ConfirmDialog`, one `delete-item` send.
  Nothing is put back first; one write. For a dish already off, the confirmation drops its last
  sentence ("To take it off only for a while, switch it Off ... instead") - it would tell the owner to do
  what is already done. The rest of the dialog is word for word.
- **Icons:** one shared `IconAction` (`src/components/ui/icon-action.tsx`) - a pencil for Edit, a bin
  for Delete, Lucide at stroke 2.75 as the design system sets it (`_ds/.../readme.md`: "Use Lucide
  icons ... at stroke-width 2.75"), on Button's existing `icon` size (the 44px floor). Lucide was already
  a dependency, unused until now. Delete is drawn in the error colour (on the yellow off-menu chip, the
  chip's own ink - red on that tint is not a checked pair).
- **The word is kept, not dropped:** it is each button's accessible name and its tooltip, naming the
  thing - "Edit Paneer Tikka", "Delete table A5", "Delete Gas ₹450 from 2026-10-12". A screen
  reader reads it; a mouse shows it; a runner finds it by role.
- **Scope, "across app":** every button that OPENS an edit or a delete - Menu (row Edit and Delete, the
  strip's Delete), Settings → Tables (row Edit, the table sheet's Delete), Staff (Edit), Ledgers →
  Expenses (Edit, Delete), Printers (Delete), Print setup (row Delete, the Configure sheet's Delete).
  The guest and captain screens have no Edit or Delete buttons.
- **Left as words, on purpose:** the confirmation buttons that CARRY OUT a delete ("Delete the item",
  "Delete printer") - a destructive commitment names what it does; and buttons whose word is another
  verb (Remove a staff member, Remove a printer mapping, Configure, Preview, Put back). Changing those is
  a different ask; say so if wanted.

## THE FIVE PERMISSION QUESTIONS
1. **Who can do it?** Delete from the strip: `menu.item_edit` (Owner by default) - the same grant as
   the row's Delete. Icons change no grant anywhere.
2. **What changes when a grant is off?** No bin on the strip (Put back stays for `menu.availability`);
   the server refuses `delete-item` (403) before any read or write, unchanged.
3. **Can it reach another party's data?** No: the same `deleteMenuItem`, scoped to the restaurant.
4. **What does the database enforce?** Unchanged (12-Oct): orders and bills keep the dish by snapshot.
5. **Where is it recorded?** `docs/registers/RBAC_MATRIX.md` (one row, 13-Oct-2026); the audit log, as
   before ("Menu item — <dish> deleted").

## EVIDENCE
`tests/unit/icon-actions.unit.spec.ts` (5: the TypeScript parser reads every component and refuses an
Edit or Delete opener carrying its word; every opener is `IconAction`; the strip shares the one delete
path), `tests/render/icon-actions.render.spec.ts` (7: the real Menu section, both themes, 390 px and
desktop) and `tests/render/icon-actions-screens.render.spec.ts` (20: Tables, Staff, Expenses, Printers,
Print setup, both themes, 390 px and 1280 px). Pattern JP-24 in `docs/registers/CANONICAL_PATTERNS.md`. Two 12-Oct pins superseded in place
with dated notes. Results and fail-first in `TEST_SUMMARY.md`.

## REVIEW (13-Oct-2026: copy reviewer) - what changed
- Expense labels read "Edit/Delete <category> <amount> from <date>", the words of the expense's own
  delete dialog ("Gas ₹450 from 2026-10-12"), and two same-day entries of one category are told apart.
- The Delete in the table and printer sheets names the SAVED table or printer, not the name field being
  typed in (cleared, it read "Delete table ").
- Candidates noted, not changed (shipped words): the expense opener says Delete while its dialog says
  Remove; expense dates are ISO where the app's display format is DD-MMM-YYYY.

## REVIEW (13-Oct-2026: code reviewer) - what changed, and what was weighed and left
- **Fixed - five of six screens were never rendered.** `icon-actions-screens.render.spec.ts` mounts the
  real Tables, Staff, Expenses, Printers and Print setup screens in both themes at 390 and 1280 px.
- **Fixed - a colour assertion that could not fail** ("not transparent" - `currentColor` never is).
  Every icon is now compared with its token resolved in the page's theme (`tests/support/icon-action-probe.ts`).
- **Fixed - the scan was narrower than JP-24 said.** It now reads nested text and string literals in
  expressions, and buttons, chips and links, for any words beginning Edit or Delete.
- **Fixed - the strip's bin hovered in the grey ghost fill** on the yellow chip; it now takes the chip's
  own tint, as Put back does.
- **Fixed - two reachable pairs were missing from the contrast policy:** error on surface-raised (a
  sheet's Delete) and error on surface-sunken (a Delete under the pointer). Both pass, both themes.
- **Fixed - a whitespace-dependent pin** on `deleteMenuItem`, and a "does not contain" that would pass on
  an empty dialog (a positive assertion is beside it now).
- **Weighed, left - two buttons named "Delete <dish>"** for a dish that is off: the strip's and the row's.
  Both delete the same dish through the same dialog, so the same name is true; a runner uses test ids.
- **Weighed, left - the 44px bin is taller than the chip** (it overhangs by about 2px, invisible until
  hovered or focused). Shrinking it would break the 44px touch floor; growing the chip would change
  every chip for one button.
- **For the owner - still words:** Remove (a staff member; a printer's computer mapping; a quick reply;
  a waitlist entry; a photo), Configure, Preview, Put back. Another verb, so outside this ask; say if
  any should be an icon too.
