# Request — takeaway photo in the dialog, a dropdown icon on every dropdown, Delete on menu items (12-Oct-2026)

**TYPE** correction ×2 + feature ×1 · **RUN MODE** auto · **SCALE** scoped · **PRODUCTION** not touched, not deployed · **MIGRATION** none

## THE ASK (the owner's words)
1. "Add photo for take away you have added it under take away section it should be added under add new
   item dialog under take away."
2. "In all form where ever there is dropdown add dropdown icon so that it can be identified as dropdown
   and not text."
3. "Under menu item add delete feature beside edit and before delete ask for confirmation. This
   correction was already done why was it not reflecting find root cause."

## ROOT CAUSES
- **2 — no icon.** The one shared `Select` (`src/components/ui/field.tsx`) sets `appearance-none`, which
  removes the browser's own arrow, and keeps `pr-9` free for an arrow of its own — but nothing was ever
  drawn there. Every select in every form read as a text box. The `Combobox` had a chevron, but as a
  caption-sized text caret (`˅`) that did not read as one.
- **3 — "already done, not reflecting".** It was never committed. Searched on 12-Oct-2026: every commit
  on all 16 branches of the repository (`git log --all -S`/`-G` for a menu-item delete in the route,
  the mutations and MenuSection), every request file, both TEST_SUMMARY files and the run log. The only
  menu writes that ever existed were `upsert-item` and `set-availability`; no `delete-item`, no
  `deleteMenuItem`, no Delete button on a menu row. Work left in a session's container without a commit
  and push is lost when the container is reclaimed, and nothing reaches the app until it is merged and
  deployed. Prevention: a change is "done" only once it is pushed and appears in a merged PR (the
  Definition of Done already says so; this one was evidently reported done without it).

## DECISIONS
- **Photo, new takeaway:** chosen in the Takeaway dialog (camera or gallery, preview, replace, remove —
  the same `ImagePicker`). There is no bill to store it under until the order is sent, so it is held in
  the browser and saved with the existing `takeaway-photo` action the moment `takeaway` returns the
  bill. The order is placed whatever happens to the photo; if the photo save is refused, the toast says
  so in words and where to add it again.
- **Photo, Add items on a running takeaway:** the same dialog shows the order's current photo and saves
  changes straight away, as the old Live-orders picker did.
- **Live orders → order detail:** shows the photo; no longer edits it (the ask moves the control, it does
  not hide the photo from the people who need to see it).
- **Dropdown icon:** one `ChevronDown` (SVG, `currentColor`, no colour of its own — both themes) drawn
  inside the shared `Select` and as the `Combobox` toggle. No form builds its own select element, so
  this covers every dropdown in the guest, captain and owner screens.
- **Delete:** beside Edit on each menu row, for holders of `menu.item_edit` (the grant that adds and edits
  a dish). It opens the existing `ConfirmDialog` ("Delete <dish>?", "Keep it" / "Delete the item"); only
  the confirmation sends `delete-item`. The row is removed; nothing already ordered changes, which the
  schema already guarantees: `kot_item` snapshots name, price and food type and its link becomes empty
  (`on delete set null`), as does `guest_favourite`; a guest's unsent cart line for the dish goes with it
  (`on delete cascade`). Welcome drinks ignore an id that is no longer on the menu. No migration.

## THE FIVE PERMISSION QUESTIONS
1. **Who can do it?** Delete: `menu.item_edit` (Owner by default). Photo: unchanged — `orders.create` to
   change it, `orders.view` to see it.
2. **What changes when a grant is off?** No Delete button / no photo picker, and the server refuses (403)
   before any read or write.
3. **Can it reach another party's data?** No: the delete is scoped to the restaurant (`restaurant_id`)
   and a row from elsewhere reads as "no longer on the menu"; the photo path is unchanged.
4. **What does the database enforce?** The existing foreign keys above; RLS unchanged.
5. **Where is it recorded?** `docs/registers/RBAC_MATRIX.md` (two rows, 12-Oct-2026); the audit log
   ("Menu item — <dish> deleted").

## EVIDENCE
`tests/unit/corrections-12oct.unit.spec.ts` (11) and `tests/render/corrections-12oct.render.spec.ts` (10),
fail-first observed against the previous `src/`. Results in `TEST_SUMMARY.md`.
