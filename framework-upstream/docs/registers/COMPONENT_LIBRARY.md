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
| Analytics & dashboards | Every business needs to know what is happening and what to do: configurable metric tiles · comparisons and targets · insight/exception cards · ranking and trend visuals · drill-down ladders · role-scoped visibility (CP-24) |
| Lists & tables | Every list/table view: search across key fields · contextual multi-select filters · date presets (Today · This week · Last week · This month · Custom) where dated · asc/desc sort on relevant columns · matching/total count (CP-23) · **row and header selection with bulk actions** (CP-18) · **column visibility and order** where wider than three columns (CP-21) |
| States | Empty · loading · error · offline · permission-denied, as shared treatments · a **designed full-surface wait** that names the work and stops pretending past a threshold (CP-3) |
| Support | A way for a stuck user to reach a human: email · phone · call and WhatsApp actions, with an expectation set |
| Confirmation | One confirm dialog for destructive and session-ending actions; reversible actions use undo instead — and the **undo itself is implemented**, as a deferred commit carried in the toast (CP-28) |
| Audit trail | Who changed what, from what, to what, when — wherever roles or access can be changed |
| Money | **Wherever the application shows an amount payable** — one itemised breakdown (items · adjustments · tax · payable), one renderer, pass-through kept out of revenue (CP-29). Conditional on the domain handling money at all; where it does not, this row is N/A, stated once. |
| Session | Session persists until the user signs out explicitly; sign-out confirms first and lives under the overflow menu |
| Install | **Every web application is installable**: generated manifest, maskable launcher icons, service worker, offline shell, and an install offer that is asked once (CP-30) |
| Settings | A settings area where the app's configurable details live — **not a peer of daily work** ([04 §5](../04-ARCHITECTURE-AND-DESIGN.md)) · typed fail-fast environment configuration · feature flags |
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
| UI | List controls — search across key fields, contextual filters, date presets + custom range, asc/desc sort, honest count (CP-23) | `starter/src/components/ListControls.tsx` + `starter/src/hooks/useListControls.ts` + `starter/src/lib/list-controls.ts` | READY |
| Analytics | Metric tile (value · comparison · target · sparkline), business-agnostic | `starter/src/components/analytics/MetricCard.tsx` | READY |
| Analytics | Metric model + aggregations + growth/target logic | `starter/src/lib/analytics/metrics.ts` | READY |
| Analytics | Value formatting (currency incl. lakh/crore, percent, compact, duration, dates) | `starter/src/lib/analytics/format.ts` | READY |
| Analytics | Dashboard config, role resolution, drill-down ladder | `starter/src/lib/analytics/dashboard.ts` | READY |
| Analytics | Dashboard shell (header, filter slot, metric grid, sections) | `starter/src/components/analytics/DashboardShell.tsx` | READY |
| Analytics | Insight / exception / recommendation / goal / alert cards | `starter/src/components/analytics/InsightCard.tsx` | READY |
| Analytics | Ranking + comparison bars, sparkline, progress meter (inline SVG, no chart dependency) | `starter/src/components/analytics/{BarChart,Sparkline,ProgressMeter}.tsx` | READY |
| Analytics | Analytics table (composes CP-23 controls; cards below 48rem) | `starter/src/components/analytics/AnalyticsTable.tsx` | READY |
| Analytics | Domain configs: restaurant · gym · academy · badminton | `starter/src/lib/analytics/examples.ts` | READY |
| Analytics | Donut / funnel / heatmap / calendar-heatmap / stacked / area / timeline | — | **GAP** — deliberately unbuilt; first app with a real need contributes back (docs/25 §4) |
| Confirmation | Confirm dialog — composes CP-14; destructive variant separated and named, never "OK" | `starter/src/components/ConfirmDialog.tsx` | READY |
| Confirmation | Undo — deferred commit, expiry, overflow and the composed message (CP-28) | `starter/src/lib/undo.ts` | READY |
| Confirmation | Toast host — the message that carries Undo; owns the clock and drains pending commits on unmount | `starter/src/components/ToastHost.tsx` | READY |
| States | Full-surface wait — configurable copy, named stages, and a route onward once stalled (CP-3) | `starter/src/lib/loading.ts` + `starter/src/components/LoadingScreen.tsx` | READY |
| Money | Price breakdown — line/adjustment/tax/pass-through arithmetic, rows that add up to the total (CP-29) | `starter/src/lib/pricing.ts` | READY |
| Money | Price panel — the one itemised breakdown for screen, dialog, export and print | `starter/src/components/PricingPanel.tsx` | READY |
| UI | Row + header selection — three-state header, visible-set scope, shift-range (CP-18) | `starter/src/lib/selection.ts` + `starter/src/components/SelectionColumn.tsx` | READY |
| UI | Shared component styling — tabs (DR-3), toasts, wait, price breakdown, selection; semantic tokens only | `starter/src/components/components.css` | READY |
| Audit trail | Audit model, redaction, set-diffing and the RBAC event builders (CP-27) | `starter/src/lib/audit.ts` | READY |
| Audit trail | Audit log table — read-only by construction; **composes CP-23** (search · module filter · date presets · sort) and **CP-21** (seven columns), never a second implementation of either | `starter/src/components/AuditLogTable.tsx` | READY |
| Navigation | Overflow menu with an isolated, confirm-routed sign out | `starter/src/components/MoreMenu.tsx` | READY |
| Support | Help and support — email · call · WhatsApp deep link, worded channels, honest empty state | `starter/src/components/HelpSupport.tsx` | READY |
| Copy | Sentence case for labels, headings and table cells (DR-1) — capitalises the first letter and never lowercases the rest | `starter/src/lib/text-format.ts` | READY |
| Session | JWT and username/password session persistence — survives reload and backgrounding; ends only on explicit sign out (DR-2) | — | **GAP** — first app to build it contributes back |
| Install | PWA — generated manifest, generated offline page, generated maskable icons, service worker, install and update prompts (CP-30) | `starter/src/lib/pwa.ts` + `starter/src/components/PwaProvider.tsx` + `starter/src/app/layout.tsx` + `starter/public/sw.js` + `scripts/theme-build.mjs` | READY — **AMENDED 10-Sep-2026**, and the amendment reverses this row's own previous wording. It read "an option in the customizer, never a silent default"; the owner has directed that every generated application be installable with no additional configuration, so it is now a default and not an option. The original caution is not discarded — it was about not IMPOSING behaviour on a user, and that survives in CP-30's fourth rule: the app is installable, but nothing installs itself, the offer is asked once and remembered, and an update is offered rather than applied. `PwaProvider` takes `quiet` for a surface that must not be interrupted. |
| UI | Bulk-action bar — composes CP-28 (delete confirms with the count and scope named; archive is one click plus Undo) and `selectionSummary`, never a second wording | `starter/src/components/BulkBar.tsx` | READY |
| UI | Common form patterns | — | **GAP** |
| Settings | Typed, fail-fast config (env trust boundary, `PUBLIC_` prefix rule) | `starter/src/lib/config.ts` + `starter/.env.example` | READY |
| Settings | App customizer — per-module enable/disable, button reorder, always-on locks, enabled-only position badges | `starter/src/components/ModuleCustomizer.tsx` + `starter/src/lib/module-customizer.ts` | READY |
| Permissions | Module-access editor — role preset (reset-to-role) + per-capability custom grants, deny-by-default, worded confidential marks, honest save label | `starter/src/components/ModuleAccessPanel.tsx` + `starter/src/lib/module-access.ts` | READY |
| Settings | Settings screen shell (the configurable-details area) | — | **GAP** — placement rule already binding: configuration is never a peer of daily work |
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
