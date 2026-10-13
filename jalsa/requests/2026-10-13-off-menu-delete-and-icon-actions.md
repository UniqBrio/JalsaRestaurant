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
Edit or Delete button carrying its word; every opener is `IconAction`; the strip shares the one delete
path) and `tests/render/icon-actions.render.spec.ts` (7: the real Menu section, both themes, 390 px and
desktop). Pattern JP-24 in `docs/registers/CANONICAL_PATTERNS.md`. Two 12-Oct pins superseded in place
with dated notes. Results and fail-first in `TEST_SUMMARY.md`.
