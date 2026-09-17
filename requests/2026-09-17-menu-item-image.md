# NEW REQUEST — something that does not exist yet
<!-- Filled by workflows/request.md (/request) · Consumed by Track A: /feature requests/<this-file> -->
<!-- Stated fields are BINDING. "unknown" is a Gate 1 question, never a blank to fill. -->

Run **Track A** ([workflows/feature.md](../../workflows/feature.md)) with this request.

## FIELDS
- ONE-LINE GOAL: as stated — `Add image browse option to add an image in a menu item.`
- WHERE IT LIVES: Owner → **Menu** → the **Add an item** / **Edit item** modal
  (`MenuSection.tsx`), from the screenshot. Its fields today are Item name, Price, Category,
  Food type, Description.
- MUST-HAVE (requester to trim at Gate 1): a browse control on that modal that attaches an
  image to the menu item.
- EXPLICITLY OUT: nothing stated.
- WHO USES IT: the owner/admin maintaining the menu. Not stated beyond that.
- CORRECTION ROUND: 1

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: the Add/Edit item modal (browse, chosen, uploading, failed, remove).
  **And, `unknown` but unavoidable: the guest menu**, which holds a placeholder tile for exactly
  this photograph today and would start showing real ones.
- STRINGS ADDED OR ALTERED: none stated. All new strings are `unknown`.
- PERMISSIONS: `unknown` — who may upload is not stated; `menu.edit` is the adjacent permission.
- USAGE PROFILE: `unknown` — how often the menu changes, whether every one of the 57 items gets
  a photograph or only some.
- RUN MODE: auto
- SCALE: unknown — **not micro**, see below.

## WHAT INTAKE FOUND WHILE CLASSIFYING (evidence, not a plan)
The gap is narrower than it looks in one place and wider in another.

- **The column already exists.** `menu_item.image_url text not null default ''`, in the core
  schema (`20260910070000_jalsa_core_schema.sql:192`). It is already selected in
  `queries.ts:63`, already mapped to `MenuItem.imageUrl` in `types.ts:21`. So the data contract
  for "this item has a picture" is in place and needs no change.
- **Nothing reads it and nothing writes it.** `imageUrl` appears in no component. The guest's
  dish rows and the upsell cards render a hand-drawn placeholder SVG — the comment in
  `GuestClosure.tsx` calls it *"The space a photograph will occupy"*. The space was designed;
  the picture was never wired.
- **There is nowhere to put the bytes.** No migration creates a Supabase storage bucket
  (`grep storage.buckets supabase/migrations/*.sql` → nothing), and no code touches
  `.storage`, a `type="file"` input or `FormData` anywhere in `src/`.
- **Guardrail 3 decides the shape of the upload.** "The browser never speaks to Supabase" — RLS
  is on with no permissive policy and the server holds the secret key. So a browse control
  cannot upload straight to a bucket from the page; the bytes go through a route handler under
  `src/app/api/`, like every other write.

So this is: a file input, a route that accepts it, a bucket with its own policy (a migration),
`image_url` written on save, and the guest menu finally rendering the tile it has been holding
open. Five parts, one of them a schema change — which is why it is not micro.

## OPEN QUESTIONS FOR GATE 1 (not decided at intake)
1. **Does the guest see it?** Writing `image_url` without rendering it changes nothing anyone
   can see; rendering it changes the guest menu for every diner. Both are defensible; they are
   different requests.
2. **What are the limits** — file size, dimensions, accepted types, and is the image resized on
   upload or stored as sent? Unstated, and a 12 MB phone photograph on a guest's mobile data is
   the failure mode.
3. **Who may upload**, and does it need an audit entry the way other menu edits do?
4. **What happens to an item with no image** — the placeholder tile stays, or the row reflows?

## STANDING INSTRUCTIONS (do not edit)
- Track A order is binding: Gate 1 questionnaire (every `unknown` above is a question) → design
  → plan → build → test gate. Nothing is built before Gate 1 is answered.
- The five permission questions are answered in the plan, before build.
- Every backend change is a migration file. The browser never speaks to Supabase.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.
