# Jalsa — QR dine-in ordering

A guest scans the code on their table, orders from their own phone, watches the kitchen work, adds
more, asks for the bill, tips if they want to, and pays a person. A captain works the same bill
from a handset. The owner watches all of it, closes the till and reconciles the day.

It is **working** when a table can go scan → order → kitchen → add more → request payment → tip →
pay → invoice → reconcile without anyone touching a keyboard, and every figure in the day's
reconciliation is attributable to a named member of staff.

Three surfaces, one bill, one restaurant: Jalsa, Hosur, Tamil Nadu.

---

## Run it

```bash
npm install
cp .env.example .env.local     # then fill it in — see the table below
npm run dev                    # http://localhost:3000
```

| Surface | Address | Sign in with |
|---|---|---|
| Guest | `/t/A5` (any table name from the seed) | nothing — the URL is the key |
| Captain / waiter | `/staff` | a four-digit PIN |
| Owner / admin | `/owner` | the same four-digit PIN |

**Every seeded account's PIN is `1234`, and it opens exactly one screen: "choose your own PIN".**
It is marked provisional in the database, so it cannot be worked behind. See KL-4 in
`docs/registers/KNOWN_LIMITATIONS.md`.

### Environment

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | the project address |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | safe in the browser: RLS is on with no policies, so it reads nothing |
| `SUPABASE_SECRET_KEY` | yes | **server only.** Bypasses RLS. Never `NEXT_PUBLIC_`, never committed |
| `SESSION_SECRET` | yes | signs the staff cookie; rotating it signs everyone out |
| `NEXT_PUBLIC_QR_ORIGIN` | no | what printed table QRs point at; defaults to the deployment origin |

### Database

```bash
# migrations apply in filename order
supabase/migrations/20260910070000_jalsa_core_schema.sql
supabase/migrations/20260910071000_jalsa_seed_and_pin.sql
supabase/migrations/20260910072000_jalsa_bootstrap_pins_and_permissions.sql
supabase/migrations/20260910073000_jalsa_provisional_pins.sql
```

All four are applied to the development project. `docs/registers/ENVIRONMENTS.md` has the table.

---

## The gate

```bash
npm run audit:all      # 8 audits: theme sync, contrast, assets, colours, test ids, columns, fixtures, dead weight
npm run gate           # the ordered, three-valued gate — G1..G11
```

On a container that supplies its own browser and cannot reach the database:

```bash
npm run dev &
export PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium
export TEST_APP_URL=http://localhost:3000
npm run gate
```

The override drops the two WebKit-backed viewport projects and prints `SKIPPED: tablet,
mobile-ios` on stderr. It does not quietly substitute Chromium for Safari.

### What the suite covers today

| Tier | Cases | What |
|---|---|---|
| unit | 56 | money, bill and KOT status, the permission matrix, guest phase reconciliation |
| render | 14 | computed contrast on real elements, both themes, every target asserted to exist |
| functional | 20 × 4 viewports + degraded | sign-in end to end, keyboard parity, geometry at 320–1920px, and the whole outage path against a real second instance with no database |

**252 assertions pass. The data journeys — the guest's, the captain's and the owner's — are BLOCKED,
not passing**: this build container's egress policy refuses the Supabase host, so the application
could never be run against its own database here. The evidence, the exact denial and the list of
what that leaves unverified are KL-1 in `docs/registers/KNOWN_LIMITATIONS.md`. Run the suite on a
machine with outbound access and those journeys are the first thing to write.

---

## Where to read next

| | |
|---|---|
| The binding rules for this app | `CLAUDE.md` |
| The design set — the specification | `../Design planning documentation/` |
| One idiom per concern | `docs/registers/CANONICAL_PATTERNS.md` |
| Who may do what, and why | `docs/registers/RBAC_MATRIX.md` |
| What is genuinely blocked | `docs/registers/KNOWN_LIMITATIONS.md` |
| The framework this is built under | `../docs/00-OVERVIEW.md` |
