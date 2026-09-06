# 25 — Analytics and Dashboards

> A dashboard is not a collection of charts. It is a **decision-support interface**, and every
> element on it must answer: *what will the owner do differently because of this?*
>
> Reference implementation: `starter/src/components/analytics/` + `starter/src/lib/analytics/`.
> Canonical pattern: **CP-24**. Worked configurations for four businesses:
> `starter/src/lib/analytics/examples.ts`.

---

## 1. The shape of the thing

**Metric → Filter → Visualization → Breakdown → Action.** A dashboard exists to answer five
questions in this order, and the layout follows them:

1. **What is happening?** — the metric tiles.
2. **Is it good or bad?** — the comparison and the *worded* status on each tile.
3. **Why?** — the insight sentences and the charts under them.
4. **Where?** — the breakdown / drill-down ladder.
5. **What do I do?** — the action on the tile, the insight, or the row.

A screen that stops at (1) is a scoreboard. One that starts at (3) is homework.

**The ten-second test.** A business owner reading only the top of the screen should already
know whether today is fine. If the numbers are below the fold — behind an expanded filter
panel, a banner, a chart — that cost is paid on every visit, forever.

---

## 2. A dashboard is configuration, not code

The components are business-agnostic; the business ships a `DashboardConfig`. A restaurant, a
gym, a court-booking facility and an arts academy differ in metrics, filters and breakdowns —
**not in their dashboard**.

> **The rule that keeps this true:** if adding a domain requires editing a component, the
> config model is missing a field. Fix the model; never fork the component.
> `examples.ts` is the standing proof — four businesses, zero component edits.

```ts
const dashboard: DashboardConfig = {
  id: 'gym', title: 'This month',
  metrics: [ /* MetricDefinition[] */ ],
  filters: [ /* FilterDefinition[] */ ],
  sections: [ /* what renders, in what order */ ],
  defaultBreakdown: ['plan', 'member', 'payment'],
};
```

### The metric definition

`id · label · description · dataSource · aggregation · field · denominatorField · format ·
formatOptions · unit · higherIsBetter · comparisonPeriod · target · priority · visualization ·
breakdown · visibleTo · actions`

Aggregations: `count · sum · avg · min · max · distinct · ratio · percentage`.
Attendance is `percentage` of `present` over `scheduled`; growth is derived, never stored.

---

## 3. Four rules the implementation enforces

These are not style preferences — each one is a way dashboards routinely lie, closed in code
and covered by `starter/tests/unit/analytics.unit.spec.ts`.

| Rule | Why |
|---|---|
| **Direction is not sentiment.** `higherIsBetter: false` on expenses, churn, cancellations, outstanding, expiring. | A dashboard that colours every rise green calls a growing overdue balance good news. The arrow says which way; the **word** says whether that is good. |
| **Growth from zero is undefined, not infinite.** No prior period → `null` → "No prior period to compare". | "+∞%" and a silent "+100%" both invent a fact the data does not contain. |
| **An absent value is never zero.** `null` renders as `—`, and suppresses its comparison. | Zero revenue and unloaded revenue are different facts. Rendering them identically is the most expensive lie a tile can tell. |
| **Restricted metrics are removed, not hidden.** `resolveDashboard(config, role)` deletes them from the config. | CSS-hidden numbers are still in the payload and the DOM. Hiding is a permission bug wearing a stylesheet. Row-level access remains the data layer's job (RLS). |

---

## 4. Choosing a visualization

Pick by the **question**, never by novelty. The module ships the small set that earns its place:

| The question | Use | Shipped as |
|---|---|---|
| What is the number? | Metric tile | `MetricCard` |
| Which way is it moving? | Tile + sparkline | `MetricCard` (`visualization: 'sparkline'`) |
| How far to the target? | Progress bar + the number | `ProgressMeter` |
| Which are the top performers? | Horizontal bars (ranking) | `BarChart orientation="horizontal"` |
| How do a few categories compare? | Vertical bars | `BarChart orientation="vertical"` |
| What exactly happened? | Table | `AnalyticsTable` |
| What should I know without deriving it? | A sentence | `InsightCard` / `InsightList` |

**Deliberately not shipped** (and honest about it): donut, funnel, heatmap, calendar heatmap,
stacked and area charts, timeline. Each is a **GAP row** in
[registers/COMPONENT_LIBRARY.md](./registers/COMPONENT_LIBRARY.md) — the first application with
a real need builds it and contributes it back. Speculative components are dead weight, and this
framework has an audit that says so. **No charting dependency is used**: every visual here is
inline SVG or CSS, so the module costs nothing to install and inherits the theme automatically.

**Never**: 3D, decorative gradients, colour-only meaning, a donut for one value against a
target, a chart where a sentence would do.

---

## 5. Filters are CP-23, reused

The analytics table composes `useListControls` + `ListControls` — one search box across key
fields, contextual multi-select filters, the date presets (Today · This week · Last week · This
month · Custom range), and asc/desc sort. **Do not build a second filter system for analytics.**
A dashboard filter that behaves differently from a list filter is the inconsistency CP-23 exists
to end.

---

## 6. Drill-down

Progressive disclosure along a declared ladder — `breakdown: ['course', 'student', 'transaction']`:

```
Revenue → Course → Student → Transaction      (academy)
Revenue → Category → Item → Order             (restaurant)
Revenue → Court → Booking → Customer          (badminton)
```

`nextDimension` gives the next level or `null` at the end; `drillInto` / `drillUpTo` move along
it; `drillFilters` converts the crumbs to `{ dimension: value }` for the data layer. On a small
screen the destination is a bottom sheet or an expanded row — never a navigation stack the user
must climb back out of.

---

## 7. States, accessibility, responsiveness

Every component renders **loading · empty · error** explicitly; `AnalyticsTable` adds the
no-match empty state; `InsightList` treats "all clear" as a real, valuable state. No component
renders a blank area when data is unavailable.

Accessibility: charts announce a **summary**, not their coordinates; status is carried by a word
as well as a colour (rule A-4); bars are native controls when actionable, so the whole chart is
keyboard-operable (CP-22); the progress meter is a real `progressbar` with values; wide tables
scroll inside their own container, never the page (rule A-9).

Responsive: the metric grid is `auto-fit`/`minmax` — one column at the narrowest supported
width, filling out as space allows, with no per-device breakpoints. Below 48rem the table
**becomes cards** built from the priority columns, with the rest behind "More" — a squeezed
eight-column table is technically responsive and practically unreadable.

---

## 8. Integrating it into an application

1. Import `analytics.css` once (it is token-only; it inherits your theme).
2. Write a `DashboardConfig` — start from the nearest of the four in `examples.ts`.
3. Resolve it for the signed-in role: `const view = resolveDashboard(config, role)`.
4. Fetch or aggregate. Small sets: `computeMetric(def, rows, previousRows)`. Large sets:
   aggregate at the database and call `buildResult(def, value, previous, series)` — **never**
   pull thousands of rows into the browser to compute one KPI.
5. Render `DashboardShell`, returning the right content per section from `renderSection`.

### Adding a new metric
Add a `MetricDefinition` to the config. Nothing else changes. Mark cost-like metrics
`higherIsBetter: false`, and name the `breakdown` ladder if it drills.

### Adding a new visualization
Only when a question in §4 has no answer. Inline SVG or CSS; accessible summary; no colour-only
meaning; a unit spec for any logic; then flip its GAP row in the component library to READY.

### Adding a new business domain
Write a config. If you cannot express it without editing a component, **stop** — that is a
missing field in the model, and the fix belongs there.
