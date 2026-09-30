# Changelog

## Unreleased

### Added — 30-Sep-2026 — Catch Your Craving

- **While a round is being cooked**, the guest's order screen offers a short, optional game: dishes from your own menu fall, and the guest catches them on a plate. It lasts about 24 seconds, can be played twice, and "Maybe later" puts it away. It ends with at most two suggestions from your menu (a dessert or a drink first), which go into the guest's cart like any other dish. It disappears the moment the round is Ready.
- A Veg order only ever sees Veg dishes. Dishes with the KOT classification **Other** (a juice, a dessert) do not change which dishes a table sees; they fall, and are suggested, for Non-veg, Egg and mixed tables.
- **Add** puts the dish in the guest's cart and says "nothing sent to the kitchen yet"; the guest sends it the usual way. **Maybe later** or **Close** puts the game away for that round; the next round offers it again.
- **Settings → What the customer sees → While they eat → Catch Your Craving game while they wait for their food** switches it off. It is on by default.

### Added — 30-Sep-2026 — Delete beside each printer

- **Settings → Printers → Printers**: every printer row now has **Delete** next to **Configure**. It asks first, as the Delete inside Configure does.

### Fixed — 30-Sep-2026 — Switching a printer off and saving

- **Settings → Printers → Configure**: a kitchen printer set to Ethernet or Wi-Fi with no IP address typed in can now be switched off with **Use this machine** and saved. **Save changes** stayed grey before, without saying why. The IP address is asked for only while the machine is in use, so switching it back on still needs one.

### Added — 28-Sep-2026 — Delete a table

- **Settings → Tables & QR → Edit** now has **Delete**, with a confirmation. A table that has never had a bill (added by mistake, never used) is deleted and its code stops working. A table that has had a bill is refused with "switch it off instead", so old bills and reports keep their table. On 28-Sep that is A1, A4, A5, A7, N3, N4 and N5; the other 13 can be deleted.

### Added — 28-Sep-2026 — Food Types of your own, each with a KOT classification

- **Menu → Food types.** Add Fish, Dessert, Juice, Seafood or anything else. Each type has a **name** (what you and guests see) and a **KOT classification**: Veg, Non-veg, Egg, or Other (no KOT classification). The classification decides which ticket a dish prints on when the veg/non-veg split is on, and the band it sits under on the KOT. Non-veg prints on the non-veg ticket; Veg, Egg and Other print on the veg-side ticket, under their own band (Other prints under **OTHER**).
- **Add item** and **add a dish while ordering** pick the Food Type the way Category is picked: search, or type a new name and choose its classification before it is saved. Renaming or re-classifying a type (Menu → Food types) applies to every dish of that type; tickets already printed are not changed.
- Guests' search finds dishes by their Food Type name, and the menu shows it. The Veg / Non-veg / Egg diet chips keep working by classification.
- Reports gain **What sold by food type**.
- Existing dishes keep exactly what they were: every restaurant starts with Veg, Non-veg and Egg, and each dish is linked to the matching one.

**Technical.** Migration `20260928090000_jalsa_food_type_master.sql`: enum `food_type` gains `other`; new table `menu_food_type` (name, `kot_class`); `menu_item.food_type_id`, with triggers that derive `menu_item.food_type` from it and propagate a re-classification; `kot_item.food_type_name` snapshot. Must be applied before this code is deployed.

### Added — 28-Sep-2026 — "Mark it clear" on the owner console

- A table showing **Needs clearing** on the owner dashboard now offers **Mark it clear** to anyone holding `tables.clear` (the owner, captains, waiters). It is the same verb the captain's To clear list has always sent, through a new `clear-table` action on the owner route, guarded in `clearTable` like everything else. Until now the console showed the state and offered nothing; Mark free is a different operation (`tables.free`, for a table holding an empty bill or a phone's cart) and is not offered on a released table.

### Changed — 25-Sep-2026 — the rest of the correction list

**For Javeed.**
- **Owner console and staff app sign in separately.** Signing in on one no longer signs the phone
  in on the other, so a captain's handset never carries your name onto the floor. Everyone
  signed in, on either app, signs in once more after this update.
- **Add a dish while ordering.** On Add items (captain) and New round (owner), search for a dish;
  if it is not on the menu, tap **+ Add "…" to the menu**, give it a price, category and food
  type, and it goes on the menu and into the round. Only people allowed to add menu items AND set
  prices see it (captains only if you give them both). A name already on the menu adds that dish,
  unless it is sold out, which the screen says.
- **Sub-menus.** Menu → **Sub-menus**: put a category under another (e.g. Biryani under Main
  course). Reports then show **What sold by menu**, with sub-menus included, and each category
  shows which menu it sits under. Sales already recorded keep the menu they sold under.
- **Reissue PIN** now works on the live system (the old database function was removed).

**Technical.** Migration `20260925120000_jalsa_menu_sub_categories.sql` (applied to test, then
live); `20260917120000` applied to live. CI: Node 20 Windows-1252 decoding fixed; the two CI
workflows no longer cancel each other. RC-025, RC-026, RC-027.
### Changed — 25-Sep-2026 — the 40-item correction list

**For Javeed — printers.**
- **Printers** lists every printer, each with **Added on**, **Last printed**, and a **Delete** that asks
  first and names the printer. Old tickets stay in History.
- The **10:15** you saw was not a print: it was the last time the kitchen PC checked in (10:15 pm on
  24-Sep). Bridges now say **Last ticket** and **last in touch**, each with its date.
- **Bills print in the order the items were ordered**, in clean columns — Item, Qty, Rate, Amount —
  with the totals lined up underneath and a large TOTAL that fits the paper. The big lines (the
  restaurant name, the KOT number) no longer run off the edge.
- **One bill format everywhere**: the counter printer, the preview, and **Print** on a bill all show
  the same invoice. It no longer counts a cancelled round.
- **Preview | Test Print** next to every printer, for a **KOT** or a **Bill**.
- **KOT template**: every line is **Off / On / Always on**. The restaurant's phone and address are
  now off on kitchen tickets.
- **Printing is faster** and uses the full paper width — this needs the new Jalsa Print Bridge
  (2.1.0) installed on the kitchen PC.
- As you asked: only **RP3160 GOLD(U) 1** is kept, and the four old disconnected bridges are
  removed. Its computer, **Kitchen PC**, still prints.

**Menu and routing.** Add Item takes a **photo** (PNG or JPEG, up to 1 MB), shown on the guest's
menu; **Food type** is searched like Category; each dish can have its own **Printer**. Routing lists
every dish with its own **Station** and **Printer**, and **Set all dishes to…** changes every
dish's station at once after asking. A new **category** can be given its printer. **Settings →
Printers & machines → Default station** decides where a dish goes when nothing else does.

**Tables and QR.** **Restaurant details → Logo**: upload your logo; it appears in the middle of
every QR code and at the door. **Scan to Block Your Table** is a poster for the entrance. **Zone**
is AC, Non-AC or Terrace. **Mark free** now only shows on a table that is holding something, and
after you press it the table reads Free (A5 fixed).

**Guests and payments.** When a guest asks to pay, the **captain** is told to see to the table and
the **bill counter** is told the bill is wanted — separately, once. **Share to WhatsApp** can send
straight to the guest's number. **Reports** show **Sales by day** and **Sales by category**. The
**Google review link** is checked before it is saved, and can be opened, shared and printed as a QR.

Not yet: nothing here has been printed on the TVS or opened on a phone from here — see the run
notes. The Google review link saved today is the placeholder from setup
(`https://g.page/r/jalsa-hosur/review`); replace it with your real one under Customer engagement.

### Changed — 24-Sep-2026 — the testing correction list

**For Javeed.**
- **Reports on Today** now says "No bills closed today", names the last bill and its day, and has
  a **View Yesterday** button. **Every "today"** — Payments, Dashboard, tips, printed tickets —
  now runs midnight to midnight in India, not from 5:30 am.
- **Income & expenses** (was Expenses): one date range, income from closed bills (tips left out),
  the expense ledger, and the net.
- **Uplift** shows how guests found Jalsa over the last 30 days.
- **Printers:** switching a printer off and saving now works for printers on the printing
  computer; a printer can be **deleted** (it asks first); a Windows printer shows **Change** and
  **Stop using**. A step-by-step install guide is in `docs/PRINT-BRIDGE-WINDOWS-INSTALL.md`.
- **Reissue PIN** works again, and the new PIN makes the person choose their own.
- **Seating from the queue** now opens the table's bill, so the table shows as taken everywhere.
  A **table code scanned while the queue is closed** shows a closed screen unless the table is
  already seated.
- **Welcome drinks** (Settings → Features): choose them once; the first order on a table offers
  one tap to add them.
- **Cash payments** show the change to hand back, and refuse a short payment.
- **Every KOT** says where it came from: Captain, Owner or Guest phone.

**For captains.** Tables waiting to be cleared are no longer listed as free. You can set the
**waiter** on your own bill. A table you open with nobody assigned becomes yours.

Not yet: none of this has been opened against the live database from here (the end-to-end tier
could not run). Sub-menu categories and a "favorite menu" quick add are not built — see the run
notes.

**Fixed — 24-Sep-2026 — Reports showed nothing, whatever dates you picked.** Every payment you
recorded was saved and the report was worked out correctly, but the Reports screen threw the
answer away and said "Nothing in this range" instead. It should now show the figures, and nothing
was lost: every bill closed since the start is still there. "Nothing in this range" now appears only
when the dates really have no bill and no expense. When a report cannot be shown (for example, a
role without access to sales), the screen now says why instead of a general message. The guest's
entrance queue had the same mistake: a guest whose queue closed after the page opened now sees
"We have stopped taking the queue" instead of "That did not go through."

Not yet: the corrected Reports screen has not been opened against real bills. To check it, open
Reports, pick 23-Sep and expect one bill, B-1044, paid by UPI.

### Added — 23-Sep-2026 — set up the thermal printer from Printers

**For Javeed.** A new **Printers** section on the console. Press *Connect Printing Computer*,
download Jalsa Print Bridge for Windows, run the installer on the computer the printer is plugged
into, and type the code the screen shows you — once. The computer then appears with the printers
Windows found on it; pick one, say which station it serves, press *Test Print*. Nothing to type
in the morning: the bridge starts with Windows and restarts itself. If it is switched off, not
running, or the printer is unplugged, the Printers screen says so in plain words. *Manage* still
opens the full print setup (templates, routing, history).

Not yet: none of this has been run on a Windows machine or a real TVS RP3160 — see KL-6 and KL-7.

**Fixed — 23-Sep-2026 — the installer would not start.** The first real Windows run of the download
stopped at once with a PowerShell error before asking for anything. The installer's text used an
arrow character that Windows read as a quotation mark. It now uses plain characters, and the
download is checked the way Windows will read it before it is built. Download the installer again
(Jalsa Print Bridge 2.0.1).

### Added — 10-Sep-2026 — the first build

**For a guest.** Scan the code on your table and the menu is on your phone: veg, non-veg and egg
marked, prices as printed, anything sold out shown as sold out rather than quietly missing. Order,
watch the kitchen work through it, add another round, ask for the bill when you are ready, leave a
tip if you want to, and pay a person. Your table's link keeps working if your phone dies, your
browser closes, or you hand it to whoever is paying.

**For a captain and a waiter.** Sign in with a four-digit PIN — everything you do that night is
recorded against your name. The floor, live, with what each table is waiting on. Take a round for a
table, change a quantity, cancel something before the kitchen starts, join two tables onto one
bill, reprint a ticket. A waiter sees the food and the status; the money stays with the captain and
the cashier.

**For Javeed.** Live orders across every table, closures with the payment mode and who recorded
them, the menu, the people and their permissions, the day's expenses, and an audit log of every
figure anyone changed. Table QRs, printable.

**Everyone's first sign-in.** The PIN you were given opens one screen: choose your own. Four digits
that are not a sequence and not four of the same. Nobody can see it afterwards, including Javeed —
if you forget it, he issues a new one.

**When the till cannot be reached.** Every surface now says so in a sentence, on the screen you
were on, and names what still works: the staff take your order the usual way. Previously the guest
surface showed a blank error page with no next step.

**Printing.** No printer has been connected yet, so every kitchen ticket is saved and then shown as
failed with a retry, rather than appearing to have printed. That is deliberate — a ticket that
silently did not print is the most expensive thing this application could hide.

### Not in this build
The entrance waitlist, the uplift report, the print-template designer, ranged reports and the HR
document pack. Each is named on the screen where it will live, rather than half-built.
