# 27 — Stack Selection

> **Which frontend architecture a new application gets, and why.** Decided from delivery
> requirements, never from familiarity or from what the last project used.
>
> The decision is **executable**: `scripts/lib/stack-select.mjs`, proven against the cases in
> `scripts/stack-select.test.sh`. This file is the policy the function encodes; where they
> disagree, the function is what actually runs and the disagreement is a defect.

**Run it before scaffolding**, as part of the design phase ([workflows/design-phase.md](../workflows/design-phase.md) D1–D3).

---

## The two categories

### Category A — mobile-first universal business application

The product is a **business workflow** and needs a combination of: mobile-first experience · PWA ·
Android · iOS · mobile browser · tablet · desktop browser.

```
Expo · React Native · TypeScript · Expo Router · React Native Web · Supabase
a React Native-compatible cross-platform UI system (NativeWind or equivalent)
EAS Build / EAS Submit for native distribution · PWA support for the web target
```

One codebase, mobile as a first-class target — not a web application with mobile retrofitted.

### Category B — SEO-heavy web application

The product is primarily **public, SEO-driven, content-heavy, marketing, documentation, blog, or
server-rendered/indexable**, and PWA or native delivery is not a significant requirement.

```
Next.js · React · TypeScript · Supabase · a web UI/design system
```

**This is what `starter/` is**, and what `npm run new:app` produces.

---

## The distinction that decides most cases

> **Mobile-responsive website ≠ mobile-first universal application.**

"It must work on phones" is answered by a responsive Next.js application. **Mobile browser
support alone never selects Expo** — `mobileWeb` is deliberately not a universal signal in the
selector, and `stack-select.test.sh` case 2 exists to catch it if that ever changes.

What *does* select Category A: **installability (PWA), or app-store distribution now or later, or
mobile-first as a stated primary requirement.** Installability is the line — not the app stores.

---

## Hybrid

A product with **both** a significant SEO/public web experience **and** a mobile-first
authenticated application returns `HYBRID`: *evaluate a split*, Next.js for the public web and
Expo for the application.

**Evaluate — not adopt.** Weigh shared functionality, maintenance cost, code reuse,
authentication, deployment, team capability and product direction. A split is two products to
keep in step forever. Do not split merely because it is technically possible.

---

## Decision inputs

SEO importance · public vs authenticated/business · PWA required · mobile-first required ·
Android · iOS · mobile browser · tablet · desktop browser · likely future native distribution.

**Retrieve these from project artifacts first.** Ask only where the missing answer could change
the decision — the selector returns `ASK` with the single question that separates the paths, and
that question is about delivery, never about a UI pattern.

> An input nobody supplied is `unknown`, and unknown is not `false`. A selector that defaulted
> would decide an architecture from absent information, and "it picked Next.js" would be
> indistinguishable from "it knew Next.js was right".

---

## Existing applications

**The policy prefers a stack. It does not authorise a rewrite.**

For an application that already exists the selector returns `EXISTING` and stops. Evaluate
maturity, the real requirements, migration cost, business benefit, future needs and technical
constraints. **If the current stack meets the requirements, keep it.** A migration proposed
because a document prefers something else is the most expensive kind of tidying.

---

## The design-system rule for Category A

Do **not** make a web/DOM-only component library the foundation of the universal application
layer. The UI approach must support every required target and preserve visual consistency,
accessibility, responsive behaviour, touch interaction, keyboard/mouse interaction and
platform-appropriate behaviour. Web-specific components remain fine where genuinely necessary.

> This is why `new:app --category A` **refuses** rather than approximating. `starter/` is a DOM
> component library; handing it over labelled "mobile-first universal" would be the silent
> default wearing a better name.

---

## The record

Concise, and only for a real decision:

```text
APPLICATION TYPE:   Category A / Category B / Hybrid
PRIMARY MODEL:      <what the product is>
SEO:                High / Moderate / Low
PWA:                Required / Not Required
MOBILE-FIRST:       Yes / No
ANDROID:            Required / Future / Not Required
IOS:                Required / Future / Not Required
MOBILE WEB:         Required / Not Required
TABLET:             Required / Not Required
DESKTOP WEB:        Required / Not Required
SELECTED STACK:     <exact technologies>
RATIONALE:          <short, evidence-based>
KEY TRADE-OFF:      <what is gained and what is given up>
REVISIT TRIGGERS:   <what would reopen this>
```

`renderRecord()` in `scripts/lib/stack-select.mjs` produces this from the same inputs the
decision used, so the record cannot disagree with the decision it documents. File it in
[DECISION_LOG](./registers/DECISION_LOG.md) when the choice was material.

---

## Adding Category A to this framework

There is **no Expo/React Native implementation here**. Every UI row for that stack is a **GAP**
in [COMPONENT_LIBRARY](./registers/COMPONENT_LIBRARY.md) §3.

That is the designed path, not an oversight: §3's *Adding a stack* says a new stack gets its own
subsection with the same concern rows, pointing at its implementation repository, and rows turn
READY as the first app on that stack builds and contributes each one. The concerns are the
contract; the implementations differ per stack.

**Nothing should build that speculatively.** It is a second reference implementation to maintain
forever, and it should be driven by a real product that needs it.
