# Changelog

## Unreleased

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
