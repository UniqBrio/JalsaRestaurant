# Manual Test Checklist

> For what a machine genuinely cannot judge. **Append-only** — a new dated section per release.
>
> **What must NOT be here:** a computable property that ended up manual because writing the
> assertion looked like work. Overlap, clipping, occlusion, truncation, reachability, focus and
> computed contrast are all computable, and left "manual" they are the cases that sit unrun for
> months while the exact defect they guard against ships.
>
> Every skipped automated test names its manual entry:
> `// MANUAL: MT-04 — requires a physical device`

---

## Real device
- [ ] The app is usable one-handed on the **narrowest supported viewport**.
- [ ] Touch targets are comfortable in practice, not merely 44px in the inspector.
- [ ] The on-screen keyboard does not cover the field being typed into.
- [ ] Password managers and autofill work on the sign-in and payment forms.
- [ ] The app survives a backgrounded return after several minutes.
- [ ] It behaves sensibly on a slow, flaky connection — not just offline.

## Installation and updates
- [ ] Install works on each supported platform.
- [ ] An update is picked up without a manual cache clear.
- [ ] The app recovers from a stale build rather than showing a blank screen.

## Perception — the judgement calls
- [ ] **Does the primary action look primary?** Ask someone who has not seen the screen.
- [ ] **Is the copy right?** Not merely grammatical — does it sound like the product?
- [ ] Does anything *feel* slow, even where it measures fine?
- [ ] Could a first-time user complete the main task without instructions?

## Screen reader
- [ ] The main flow is completable using only a screen reader.
- [ ] Announcements make sense in sequence, not just individually.
- [ ] Dialogs announce on open and return focus on close.
- [ ] Nothing is announced twice — a themed image is the usual offender.

## Both themes, on a real screen
- [ ] Every touched screen, in light and dark, **looked at** — not inferred from the token gate.
- [ ] The logo is legible on every surface it appears on.
- [ ] Nothing disappears in either theme.

---

## Run log

### DD-MMM-YYYY — release `<version>`
**Device / OS / browser:** · **Tester:**

| Item | Result | Notes |
|---|---|---|
