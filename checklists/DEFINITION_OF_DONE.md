# Definition of Done

> A change is not done when the code works. It is done when **every artifact that describes the
> system still tells the same story.**
>
> Each item below has been skipped in isolation on real projects, and every skip was invisible
> at the time. That is why this is a list and not a habit.

---

## Code
- [ ] Implements the approved plan. No unrequested scope.
- [ ] **Every changed line traces to the request.** A line you cannot justify is an unrequested
      change or a mistake.
- [ ] Follows the canonical pattern for every concern it touches — or a new pattern was blessed
      and recorded first.
- [ ] No colour literals. No magic numbers where a token exists.
- [ ] Dead weight deleted: the superseded module, the one-off script, the now-unimported helper.
- [ ] Every dependency introduced was **verified to exist and be the intended package** before
      installing, and is pinned.
- [ ] Any component built from scratch for a **baseline concern** was contributed back to
      `docs/registers/COMPONENT_LIBRARY.md` (GAP → READY); other reusable-looking components
      were routed through `/promote`, not silently kept app-local.

## Behaviour
- [ ] Every state exists and was **looked at**: empty, loading, error, offline, permission-denied.
- [ ] Loading always terminates, including on a forced error.
- [ ] The failure path was **exercised**, not assumed.
- [ ] Writes are idempotent against every unique constraint on the tables they touch.
- [ ] Multi-step writes go through one transaction.
- [ ] A save is proved against the **data**, never the toast.

## Appearance
- [ ] Screen checklist run per screen, with output.
- [ ] **Both themes verified visually.**
- [ ] Contrast asserted — token gate **and** computed, in every state the change can produce.
- [ ] Per-theme assets present and declared, if the change touched any brand asset.

## Security and permissions
- [ ] The five permission questions answered, and the matrix row added or updated.
- [ ] Disabling the permission gates the **deep route and the API path**, not just the button.
- [ ] Tenant scoping on every query the change touches.
- [ ] No secret in client code, in a log, or in the repository.

## Tests
- [ ] Cases added or updated, and the **registry delta stated and verified against the file**.
- [ ] All four dimensions addressed, or "covered — none needed" with a reason for each.
- [ ] **Fail-first evidence recorded** for every new behaviour test — or the honest negative.
- [ ] The gate ran. Verdict is PASS, or BLOCKED classes are named and explicitly accepted.

## Documentation
- [ ] Module document updated in **this** change.
- [ ] Feature register updated — or "no change needed" stated out loud.
- [ ] A root-cause entry appended, if this was a fix.
- [ ] A limitations entry added, if a genuine platform limit was found — **with a reference**.
- [ ] A decision record written, if a hard-to-reverse decision was made.
- [ ] Changelog line written in the language of the user.

## Business readiness
- [ ] **Tier stated out loud** (T0 / T1 / T2 / T3) and that tier's outputs delivered —
      [BUSINESS_READINESS.md](./BUSINESS_READINESS.md).
      *A change is done when every affected surface tells the same story, not when the code merges.*

## The learning check
- [ ] **Would a correctly functioning process have caught this?**
      No → say so in one line. Yes → run the framework-update workflow.
      *An application fix without the process fix means paying for the same lesson twice.*
