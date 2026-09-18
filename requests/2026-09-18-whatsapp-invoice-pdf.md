# NEW REQUEST — something that does not exist yet
Run **Track A** ([workflows/feature.md](../../workflows/feature.md)) with this request.

## FIELDS
- ONE-LINE GOAL: as stated — `"Send the bill to WhatsApp" currently does not work. Fix it
  properly.` The customer should see the invoice **in PDF/document form** through WhatsApp.
- WHERE IT LIVES: `GuestClosure.tsx:638` (`guest-whatsapp`, on the Paid screen) and
  `GuestClosure.tsx:739` (`guest-invoice-whatsapp`, on the Invoice screen).
- MUST-HAVE (stated): the correct PDF for the exact bill being viewed, carrying restaurant, table,
  bill number, date/time, rounds, items, quantities, prices, subtotal, GST, discount + type, tip,
  total, payment status and assigned staff; a real recipient number; differentiated errors; no
  secret, token, stack trace or SQL reaching the browser.
- EXPLICITLY OUT (stated): faking PDF delivery by putting a URL in a message and calling it an
  attachment; hard-coding a phone number; inventing a provider.
- CORRECTION ROUND: 1

## WHAT INTAKE FOUND — IT IS NOT BROKEN, IT WAS NEVER BUILT
This changes the classification and the size of the work, so it is stated before anything else.

- **Both buttons do exactly one thing: show a toast.** Verbatim, at both call sites —
  `onClick={() => toast.show('Ask your captain for the bill on WhatsApp — the provider is not
  connected yet.')}`. There is no handler, no fetch, no route, no failure to find.
- **The application already says so in Settings.** The feature row reads
  `['whatsapp', 'Send the bill to WhatsApp', 'Needs a provider before it can actually send.']`,
  and there is a **WhatsApp provider** text field whose own hint is *"Named here so the
  bill-to-WhatsApp button can say which service is not connected yet, rather than failing
  silently."* The gap was designed, declared and left open on purpose.
- **Nothing on the PDF path exists either.** No PDF library in `package.json`, no
  `generatePdf`/`invoicePdf` anywhere, no Supabase storage bucket in any migration
  (`grep storage.buckets supabase/migrations/*.sql` → nothing), and no `.storage` call in `src/`.
- **There is no customer phone number anywhere.** No `phone` column on any guest-facing table; a
  guest is a table session with a cookie, not a person. `waitlist_entry` has a phone for a
  waiting party — that is a different party at a different moment.

**So this is not a fix. It is four new things:** a PDF generator, somewhere to put the file, a
WhatsApp provider integration, and a way to learn the customer's number. Each is its own
decision, and the fourth touches guest privacy on a QR-first product with no accounts.

## OPEN QUESTIONS FOR GATE 1 — THE FIRST TWO ARE BLOCKING
1. **Which provider?** Meta WhatsApp Cloud API, MSG91, something else? None is present, none is
   configured, and only a document-capable provider can satisfy "see the invoice in PDF form".
   Until one is named and credentialled, a true document send **cannot** be built — and the brief
   is explicit that a `wa.me` link must not be dressed up as an attachment.
2. **Where does the customer's number come from?** Asked on the guest screen, taken from the
   waitlist entry, typed by staff? Collecting a phone number from a diner is a new data class on
   a product that deliberately has no customer records.
3. Who may send it — the guest from their own phone, or staff? The owner's bill-detail screen
   already has a `wa.me` share for staff (shipped 17-Sep).
4. Public invoice URL or attached file? A link anyone holding it can open is a different privacy
   posture from a document delivered to one number.
