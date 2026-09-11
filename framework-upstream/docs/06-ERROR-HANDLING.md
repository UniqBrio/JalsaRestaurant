# 06 — Error Handling

> Two audiences, one event. **The user gets a calm sentence with a next step; the engineer gets
> the machine detail.** Never trade one for the other — and never give either one the other's
> version.

---

## 1. Classify by what must be DONE, not by where it came from

Without a taxonomy, every catch site invents its own handling, and the same backend condition
produces a different experience on every screen.

The classes in `src/lib/errors.taxonomy.ts` are chosen by required response:

| Class | Meaning | Required response |
|---|---|---|
| `forbidden` | Valid identity, no permission | Honest no-access state. **Never re-authenticate.** |
| `unauthenticated` | Credentials missing or expired, recoverable | Re-auth boundary, in place |
| `session-dead` | Recovery impossible | Re-auth boundary. **Never a forced redirect.** |
| `conflict` | Uniqueness or version collision | "Just changed elsewhere; refresh and retry" |
| `validation` | Submitted values are wrong | Field-level, actionable |
| `not-found` | Does not exist | Honest empty state |
| `rate-limited` | Too many requests | Back off; say when to retry |
| `stale-client` | Client older than the server contract | Prompt a refresh |
| `offline` / `network` | Connectivity | Retry affordance |
| `server` | Backend failed | Calm apology. **Never its internals.** |
| `unknown` | Genuinely unclassified | Fallback — but logged, never swallowed |

**Order is the contract.** `403` is checked *before* the generic auth rule. Reversed, a
permission denial is treated as an expired session — and the user is either stuck in a refresh
loop or signed out for opening a page they simply cannot see. That is the single most common
bug this file prevents, which is why there is a test pinning the order.

---

## 2. Pure classification, separate from the side effect

```
lib/errors.taxonomy.ts   PURE. No DOM, no framework, no I/O. All the branches.
lib/errors.ts            The facade. One decision per catch site, and the ONE side effect.
```

The branches are where the bugs live, and this split makes every branch testable in a plain
runner with no browser and no mocks. `tests/unit/errors.taxonomy.unit.spec.ts` is the reference.

---

## 3. Three things an error handler must never do

1. **Never sign the user out.** Sign-out is an explicit user action. An expired token routes to
   an in-place re-auth boundary that preserves the screen and any unsaved input. A forced
   redirect discards work the user was in the middle of.
2. **Never reload the page**, except through the guarded stale-build path — which requires a
   *confirmed* version mismatch and a loop guard. An ungated reload-on-error loops forever on a
   blank screen with no way out.
3. **Never refresh credentials on `forbidden`.** A refresh cannot grant a permission, so the
   only possible outcome is an infinite refresh loop against a policy denial.

---

## 4. One wording table for the whole application

Copy lives in `userMessageFor()`, never at the call site. The same condition then reads
identically on every screen and can be reviewed in one place.

Two rules for those strings:

- **No machine detail ever.** Not a constraint name, not a code, not "undefined", not a stack.
  There is a test asserting this, because it is the rule that erodes first under deadline.
- **`null` is a valid message.** For the auth classes, the recovery UI *is* the message. A toast
  beside a re-auth screen contradicts it.

---

## 5. A fallback that hides a failure is a defect

For every `catch`, default value and skipped branch, ask three questions:

1. What actually triggers this?
2. Is it observable — does anything record that it happened?
3. **Could a user mistake its output for real data?**

A silent empty array that renders as a legitimate "no results" is how a failed read becomes a
destructive write: the code reads nothing, concludes there is nothing, and saves that.

For every fetch that feeds a save, force the fetch to fail and assert **(a)** the failure
surfaces, and **(b)** the save does not overwrite fields derived from the failed read.

Programmer errors — reference errors, type errors, syntax errors — are never rendered as
legitimate results. They are bugs, and they should look like bugs.

---

## 6. Logging: signature, not instance

Post-release monitoring groups errors by the message **shape**. Interpolating an id into the
message —

```
"user 41f9c2 not found"   ← one signature per user; grouping is destroyed
```

— produces thousands of unique signatures and makes a spike invisible. Variable data goes in
the structured `data` field:

```ts
logError('invoice.load', err, { invoiceId, tenantId });
```

Also: never log secrets, tokens or personal data. A log is a datastore with weaker access
controls and a longer retention period than you think.

---

## 7. Prove the failure path

The failure path is the least-exercised code in any application and the code that runs when
things are already going badly.

- **Test it explicitly.** Force the error, assert the user-visible result.
- **Fail-first evidence:** run every new error test against the pre-fix tree and record the
  failure. A test never observed failing is not evidence that it can fail.
- **Assert the DATA, not the toast.** A success message is what the application *claims*
  happened. Several classic data-loss bugs are the application cheerfully reporting a save that
  never landed.
