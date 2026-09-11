# 03 — Project Structure

> The layout is not the point. **The point is that every file has one obvious home**, so no one
> spends attention deciding where things go — or finding them later.

---

## The tree

```
my-app/
├── AGENTS.md                    Binding architectural rules. Read before every task.
├── README.md                    What this is, how to run it, where the docs are.
├── CHANGELOG.md                 What shipped, when. Append-only.
├── TEST_SUMMARY.md              Gate runs, newest first. Append-only, machine-written.
│
├── design/
│   └── tokens.json              THE single source of truth for every colour and scale.
│
├── src/
│   ├── app/                     Routes/pages. Thin: they compose, they do not implement.
│   ├── components/              Shared UI. Presentational, reusable, no data fetching.
│   ├── features/<feature>/      A vertical slice: its components, hooks, logic, types.
│   ├── hooks/                   Shared behaviour hooks.
│   ├── lib/                     Framework-agnostic logic: errors, config, logging, API.
│   ├── theme/                   ThemeProvider, ThemedImage, GENERATED token files.
│   └── types/                   Shared type declarations.
│
├── api/                         Server endpoints. One shape (see lib/api-handler.ts).
├── supabase/ (or db/)
│   ├── migrations/              Every schema change, ever. The system of record.
│   └── functions/               Cloud functions, with _shared/ for the common pipeline.
│
├── tests/
│   ├── unit/                    Pure logic + static audits. No page, no server, no creds.
│   ├── render/                  Real components in a real browser. Computed contrast, layout.
│   ├── functional/              Journeys with the network mocked at ONE boundary.
│   └── cases/                   The test-case registry.
│
├── docs/
│   ├── modules/<module>.md       One per module. What it does, states, actions, data.
│   ├── decisions/NNN-*.md        Architecture decision records.
│   └── registers/                The living registers.
│
├── scripts/                     Gates, audits, generators.
│   ├── audits/
│   └── hooks/
├── .baselines/                  Ratchet baselines. Committed. May only shrink.
└── public/brand/                Theme-specific logos and illustrations.
```

---

## The rules that make it hold

### Feature-first, not layer-first, past a certain size
`components/`, `hooks/`, `utils/` as the *only* organising principle works to about ten
screens. Past that, a single feature's code is scattered across five folders and nobody can
delete it safely.

`src/features/<feature>/` holds a feature's own components, hooks, logic and types. Something
graduates to `src/components/` when a **second** feature genuinely needs it — not when you
suspect one might.

### Dependency direction is one-way
```
app/ → features/ → components/ → lib/
                 ↘ hooks/    ↗
```

`lib/` imports nothing from the layers above it. That is what makes it testable in a plain
runner with no framework, no DOM and no mocks — which is why the unit tier always actually runs.

A `lib/` file importing from `features/` is not a style problem; it is a circular dependency
waiting to happen and a test that now needs a browser.

### Pure logic is split from its side effects
The pattern that pays for itself repeatedly:

```
lib/errors.taxonomy.ts    pure classification — every branch, no I/O, trivially testable
lib/errors.ts             the thin facade that performs the one side effect
```

The branches are where the bugs are, and the branches are now testable exhaustively without a
single mock.

### One alias source
Declare path aliases in **one** place. Declaring them in both the type checker and the bundler
produces two resolvers that disagree, and the divergence surfaces as an import that type-checks
and then fails at runtime.

### An exclusion names its replacement
Any directory excluded from the type checker (cloud functions on a different runtime, for
instance) must name the tool that checks it instead, and that tool runs as its own gate step.
**An exclusion without a named replacement is coverage deletion that looks like configuration.**

---

## Naming

| Kind | Convention | Example |
|---|---|---|
| Component file | `PascalCase.tsx` | `InvoiceCard.tsx` |
| Hook | `useThing.ts` | `useInvoiceList.ts` |
| Library module | `camelCase.ts`, one concern | `dateRange.ts` |
| Pure companion | `<name>.taxonomy.ts` / `.pure.ts` | `errors.taxonomy.ts` |
| Route/page | `kebab-case` | `invoice-detail` |
| Dialogs | `Add*` / `Edit*` / `Confirm*` | `ConfirmDeleteModal.tsx` |
| Unit spec | `<subject>.unit.spec.ts` | `errors.taxonomy.unit.spec.ts` |
| Render spec | `<subject>.render.spec.ts` | `contrast.render.spec.ts` |
| Functional spec | `<journey>.functional.spec.ts` | `invoice-create.functional.spec.ts` |
| Migration | `<UTC timestamp>_<snake_case>.sql` | `20260115093000_add_invoice_status.sql` |
| Test id | `<module>-<element>[-<entityId>]` | `invoices-row-8f21c3` |

Conventions are worth having mostly because they remove a decision. Consistency beats
correctness here: a mediocre convention followed everywhere beats a perfect one followed
half the time.

---

## Where NOT to put things

| Anti-pattern | Why | Instead |
|---|---|---|
| A root folder of loose planning documents | They accumulate, go stale, and nobody can tell which are current | `docs/features/<feature>/` |
| `utils/misc.ts`, `helpers.ts`, `common.ts` | A file whose name has no meaning collects everything | Name the concern, or put it where it is used |
| A `scripts/` folder of one-off generators nobody deletes | Grows until nobody knows which are live | Delete on completion; run `check-dead-weight` |
| Colours anywhere but `design/tokens.json` | See [11](./11-THEME-AND-COLOR-SYSTEM.md) | Semantic tokens |
| Business logic in a route file | Untestable without a browser | `features/<f>/` or `lib/` |
