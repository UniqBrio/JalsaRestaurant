# Design Quality Checklist

> The judge for the design stage. Run **before Gate 3** on the design (spec + canvas), and
> again at build verification on the rendered screens. Method:
> [docs/24-DESIGN-PLANNING.md](../docs/24-DESIGN-PLANNING.md) · craft:
> [docs/23-DESIGN-CRAFT.md](../docs/23-DESIGN-CRAFT.md).
>
> **Protocol — validate, refine, re-validate.** Every area below gets a verdict:
> **PASS · NEEDS-IMPROVEMENT · CRITICAL**, with one line of evidence ("counted 4 interactions
> on scenario 2"), never a bare tick. Findings are fixed and the affected areas re-run.
> Gate 3 sees a design at **Production-ready or better** (docs/24 §11), or sees the blocking
> findings with a question — never a first draft presented as final.

---

## 1. User flow
- [ ] Each of the 3–5 core scenarios walked entry→exit; every step gathers a decision or was removed.
- [ ] Interaction counts recorded per scenario; over-budget flows carry a stated reason.
- [ ] After every action: visible result + obvious next step. Exits (cancel, back, Escape) leave a predictable state.

## 2. Information architecture
- [ ] Groups are task-named in the user's words (lexicon) — not schema-shaped.
- [ ] Placement decisions follow the table (docs/24 §4): tab / page / section / dialog / drawer / inline / disclosed / removed.
- [ ] The structure has an obvious home for the next three features (scalability).

## 3. Navigation
- [ ] Predictable: siblings mount alike, nothing moves between visits, entry points read as nouns.
- [ ] Key actions within the three-interaction budget, as counted in area 1.
- [ ] No duplicate paths, no dead ends, cold direct load works for every route.

## 4. Interaction design
- [ ] Every element maps to a blessed pattern (CP register) or carries a written justification.
- [ ] Quick actions are contextual (dialog/inline at the point of need), not round-trips.
- [ ] Feedback within 100ms; optimistic-vs-honest chosen per action, in the spec.

## 5. Visual hierarchy
- [ ] The one-second read works per screen: what is this · what matters · what do I do.
- [ ] One focal point; hierarchy carried by size, weight and spacing before colour.
- [ ] Spacing rhythm from tokens; edges aligned; no eyeballed gaps.

## 6. UI consistency
- [ ] One treatment per meaning across all touched screens; at most one primary per screen.
- [ ] Reuse → extend → refactor → create order respected; no local forks of shared components.
- [ ] Copy uses approved terms; shipped strings untouched (freeze rule).

## 7. Accessibility
- [ ] Keyboard model designed (not deferred): Tab order, Enter/Space semantics, focus plan, no traps ([13 §4](../docs/13-CONTRAST-AND-ACCESSIBILITY.md)).
- [ ] Semantic structure: real buttons/links/headings; names, roles, states for everything interactive.
- [ ] Contrast pairs declared for every new combination, both themes; status never colour-alone.

## 8. Responsive behaviour
- [ ] Per-breakpoint plan exists (docs/24 §7): what stays, collapses, moves, discloses — per screen.
- [ ] Narrowest width walked in the dry run; nothing lost, only rearranged; no page-level horizontal scroll.

## 9. Forms and data entry
- [ ] Required core visible; optional behind progressive disclosure; smart defaults pre-filled.
- [ ] Validation visible and specific (never a silently disabled submit); errors associated with fields.
- [ ] Typed work survives interruption (dialog rules); Enter submits when valid.

## 10. States and feedback
- [ ] State matrix (docs/24 §8) filled for every component — "N/A" is an answer, blank is not.
- [ ] Loading terminates and is layout-stable; success names the next step.

## 11. Error handling
- [ ] Every error state says what happened and what to do next, in customer wording (taxonomy).
- [ ] Failed API / slow network / offline walked in the scenarios; nothing hangs or lies.

## 12. Empty states
- [ ] Every list/section has a designed empty state that offers the first action — never just "nothing here".
- [ ] First-run experience teaches by doing, not by tour.

## 13. Dialogs and contextual actions
- [ ] Dialogs are actions, not places; small, focused, focus-trapped, focus-returning.
- [ ] No backdrop-dismiss on input; unsaved changes confirm; Escape only where nothing is lost.

## 14. Cognitive load
- [ ] What the user must hold in their head is counted per step, and minimised.
- [ ] Density matches the task (scan/decide/enter — docs/23 §4); nothing on screen that doesn't earn its place.

## 15. Design simplicity
- [ ] Substitution table applied; every removable step removed.
- [ ] Consolidations pass all four rules (docs/23 §2): nothing lost · logical groups · internal structure · scales.
- [ ] **Simplify the experience, not the capability** — capability inventory checked off.

## 16. Production readiness
- [ ] All roles walked: what each sees, cannot see, and the denial states.
- [ ] Large-dataset day designed (paging, search, density); performance budget stated.
- [ ] Permissions answered (five RBAC questions); analytics/instrumentation named if required.

## 17. Edge cases
- [ ] The realistic-records dry run done: duplicate, missing field, mistyped value, max-size record.
- [ ] Rare-but-critical workflows still findable; interruption/resume survivable.

## 18. Overall UX quality
- [ ] The craft bar (docs/23 §1) walked feeling-by-feeling with evidence.
- [ ] The anti-gimmick rule holds: no decoration doing hierarchy's job (docs/23 — what NOT to do).
- [ ] Grade computed (docs/24 §11) and stated: Basic · Acceptable · Production-ready · High quality · Exceptional.

---

## Output format

```
DESIGN QA — <feature> — <date>
Area                verdict      evidence
1  User flow        PASS         3 scenarios, max 3 interactions
2  IA               NEEDS-IMPR   "Settings" tab is a peer of daily lists — moving
…
Grade: Production-ready
Open findings: <none, or the list with the question for the requester>
Iterations: 2 (first pass: 4 NEEDS-IMPROVEMENT, 1 CRITICAL — resolved)
```

The verdict table travels with the design to Gate 3 and is re-run against the rendered
screens at build verification. A verdict without evidence is a guess wearing a checkmark.
