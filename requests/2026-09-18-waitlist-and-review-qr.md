# NEW REQUEST — something that does not exist yet
Run **Track A** ([workflows/feature.md](../../workflows/feature.md)) with this request.

## FIELDS
- ONE-LINE GOAL: as stated — two distinct QR purposes beside the table codes: a **Waitlist QR**
  that lets an arriving party join the waiting list when tables are full, and a **Google Review
  QR** that routes a departing guest to the restaurant's review destination. `These are separate
  QR types and must never be confused.`
- WHERE IT LIVES: Owner → Settings → **Tables & QR** (`SettingsSection.tsx`, tab key `tables`,
  permission `set.tables`), and `GET /api/owner/qr`.
- MUST-HAVE (stated): the section supports Table QR, Waitlist QR and Google Review QR, visibly
  distinct; the waitlist QR is restaurant-specific, stable, printable, and carries no bill,
  customer or table state; the review destination is **never** hard-coded or guessed; `/t/<table>`
  keeps working exactly as it does; the three must not resolve to the same destination.
- EXPLICITLY OUT (stated): a second waitlist database; a guessed Google review URL; breaking the
  existing table QR.
- CORRECTION ROUND: 1

## WHAT INTAKE FOUND — BOTH DESTINATIONS ALREADY EXIST
The QR *images* do not exist. Everything they would point at does.

- **`GET /api/owner/qr` generates exactly one target**: `${qrOrigin}/t/${table}`
  (`route.ts:37`). It is gated on `tables.qr`, painted from the theme token map, high error
  correction, cached a day. It takes a `table` parameter and nothing else — there is no purpose
  or type parameter, so there is currently no way to ask it for anything but a table.
  Its own header already states the property the brief asks for: *"Nothing about a bill, a
  session or a guest is in it, so the same laminated card works for every party, forever, and
  renaming a table in Settings does not invalidate it."*
- **The waitlist journey already has its own address: `/q`.** `src/app/q/page.tsx` is "the code on
  the door" — one address for the whole restaurant, with the party identified by the phone's own
  `jalsa_queue` cookie rather than by the URL, precisely so one printed code serves every party.
  It reads the live queue, shows the wait, and offers joining. **The Waitlist QR is therefore one
  new target string — `${qrOrigin}/q` — not a new journey.**
- **The review destination is already configured and already used.** `engagement.reviewUrl` is an
  owner Setting (`SettingsSection.tsx:1083`), read into the guest payload at
  `guest-view.ts:244`, and already rendered as the guest's review link on the Paid screen
  (`GuestClosure.tsx:657`). Nothing needs inventing; the QR reads the same setting.
- **No duplicate QR generation exists** — `qrcode` is imported in exactly one file.

So the work is: a purpose parameter on the one QR route, two cards in Tables & QR, and an
honest empty state for the review QR when `reviewUrl` is blank.

## OPEN QUESTIONS FOR GATE 1
1. **What does the waitlist QR do when a table IS free?** The brief says "if a table is available:
   follow existing appropriate table-entry behavior". `/q` today is the queue page; it does not
   hand out tables. Does it need a new "tables are free, go to the host" state, or is that the
   host's job at the door?
2. **Review QR when `reviewUrl` is empty** — hide the card, or show it disabled with "Review link
   is not configured yet" and a link to the setting? The brief's error-handling section suggests
   the second; confirm.
3. **One image each, or one per table?** Waitlist and review are restaurant-level, so one of each
   — confirm that is what "printable" means here (a door card and a bill-tray card).
