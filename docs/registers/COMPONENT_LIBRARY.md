# Component Library

> The central registry of **reusable, stack-specific implementations** of the concerns every
> application needs. Consulted **before building** (the lookup), appended **after building**
> (the contribute-back loop): *Discover → Reuse → Build the missing piece → Register it →
> Reuse in the next app.*
>
> A row is a claim that working code exists at the named path — never register an intention.
> A concern wanted but not yet built is a **GAP** row, on purpose: it tells the next builder
> exactly what to contribute back. Append/amend only; never hard-delete (supersede with date).

---

## 1. The standard baseline — what every application includes

Regardless of business requirements, every application ships these; the product-advisor pass
(docs/24 §2) places them in **Must-Have automatically** and never spends research on them:

| Concern | Includes |
|---|---|
| Theme | Light AND dark theme · token-driven colour configuration · theme toggle · per-theme assets |
| Authentication | Login · logout/sign-out · forgot password · reset password · session identity |
| Layout & navigation | App shell (header/nav) · section tabs · back behaviour · cold-loadable routes |
| States | Empty · loading · error · offline · permission-denied, as shared treatments |
| Data plumbing | Single API client · error taxonomy · idempotent writes · transactions |
| Safety | Outbound-send deny-by-default · env trust boundary · tenant scoping |

## 2. The lookup (before building anything)

```
Concern needed
  → this app already has it?            → use it (A3.1)
  → this registry, for the app's stack? → use it — copy/adapt the registered implementation
  → GAP row or no row?                  → build it to the standards below,
                                          then REGISTER it (section 4)
```

The check is one read of this file. Skipping it and rebuilding a registered component is a
defect (the same rule as CANONICAL_PATTERNS: a second way of doing the same thing).

## 3. Implementations by stack

### Stack: `typescript-react-postgres` — the reference stack (lives in `starter/`)

| Concern | Component | Implementation | Status |
|---|---|---|---|
| Theme | Tokens, both themes, contrast pairs | `starter/design/tokens.json` + `scripts/theme-build.mjs` | READY |
| Theme | Theme toggle (3-state, no flash) | `starter/src/theme/theme-toggle.css` + theme docs 11–12 | READY |
| Theme | Per-theme images | `starter/src/theme/ThemedImage.tsx` | READY |
| Authentication | Session identity (tri-state) | `starter/src/lib/session.ts` | READY |
| Authentication | Auth-ready gating | `starter/src/hooks/useAuthReady.ts` | READY |
| Authentication | Login / logout screens | — | **GAP** — first app to build them contributes back |
| Authentication | Forgot / reset password flow | — | **GAP** |
| Navigation | Section tabs (scrolling, keyboard-operable) | `starter/src/components/TabRow.tsx` | READY |
| Navigation | App shell: header / footer | — | **GAP** |
| UI | Input dialog (focus, unsaved-changes, no backdrop dismiss) | `starter/src/components/Dialog.tsx` | READY |
| UI | Wide-table column control | `starter/src/components/ColumnControl.tsx` + `useColumnPrefs.ts` | READY |
| UI | Bulk-action bar | `starter/src/components/BulkBar.tsx` | READY |
| UI | Common form patterns | — | **GAP** |
| States | Permission-denied state | `starter/src/components/NoAccess.tsx` | READY |
| States | Async loading (always terminates) | `starter/src/hooks/useAsync.ts` | READY |
| Data | API client (single door) | `starter/src/lib/api-client.ts` | READY |
| Data | Error taxonomy + customer wording | `starter/src/lib/errors.taxonomy.ts` | READY |
| Data | Idempotent writes | `starter/src/lib/upsert.ts` | READY |
| Data | Transactions | `starter/supabase/functions/_shared/tx.ts` | READY |
| Data | Server function pipeline | `starter/supabase/functions/_shared/http.ts` | READY |
| Data | Dates (entry/display/storage) | `starter/src/lib/dates.ts` | READY |
| Data | Reference schema (RLS, tenant isolation, idempotency) | `starter/supabase/migrations/00000000000000_reference_migration.sql` | READY |

### Adding a stack

A new stack gets its own subsection here with the same concern rows, pointing at its
implementation repository (a path or a repo URL — one pointer per stack, never scattered).
Rows start as GAP and turn READY as the first app on that stack builds and contributes each
one. The concerns column is the contract; the implementations differ per stack.

## 4. The contribute-back loop (after building)

A component built from scratch for a **baseline concern** (section 1) is contributed back in
the same change: generalize it (no domain words — the lexicon grep from `workflows/promote.md`
Filter 2 applies), place it in the stack's implementation location, and flip this registry's
row from GAP to READY. Baseline concerns were declared common *in advance*, so they skip the
rule of three.

Any **other** component that looks reusable goes through `workflows/promote.md` unchanged:
stated domain-free, parked at n=1 in `CANDIDATES.md`, promoted at n=2 from a different app.
An eager registry fills with one app's accidents — the museum problem — which is exactly what
the promotion gate exists to prevent.

**Standards are not relaxed by reuse or contribution.** A registered component meets the same
bar as anything else: canonical patterns, semantic tokens only, keyboard operability (CP-22),
all states, both themes, tenant scoping where it touches data — and a contributed component
carries its tests with it.
