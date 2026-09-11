# 10 — Documentation Standards

> **Documentation written "later" describes a system nobody remembers.** Every documentation
> obligation in this framework lands in the *same change* as the code, or it is explicitly
> declared unnecessary — out loud, in that change.

---

## 1. What exists, and who it is for

| Artifact | Audience | Updated when |
|---|---|---|
| `README.md` | Anyone arriving | Setup or purpose changes |
| `AGENTS.md` | Developers and AI agents, before every task | An architectural rule changes |
| `docs/modules/<module>.md` | Developers and support | **Every behaviour change in that module** |
| `docs/decisions/NNN-*.md` | Future maintainers | A hard-to-reverse decision is made |
| `docs/registers/*` | Everyone | Continuously — they are living documents |
| `CHANGELOG.md` | Users and support | Every release |
| `TEST_SUMMARY.md` | The team | Every gate run *(machine-written)* |
| Code comments | The next reader | When the **why** is not obvious |

---

## 2. Module documentation

One file per module, and it is the thing support and the next developer actually read.

**Purpose · Prerequisites · Entry points** (every route and tab state, not just the main one) ·
**Screen states · Roles** and what each may do · **Actions** with their test ids · **Data
writes** · **External sends** · **Scenarios**, including unhappy paths · **Known instrumentation
gaps**.

Two sections earn their place by experience:

- **External sends.** Any control that triggers an outbound message is named explicitly —
  especially a control whose label does not suggest it sends anything. That is precisely what an
  automated run fires by accident.
- **Known instrumentation gaps.** Declared, not discovered. "This flow cannot be automated
  because X" belongs in the document, not in a test run's surprise.

**Every statement traces to code or observed behaviour.** A module document containing a
plausible guess is worse than an absent one, because it will be believed.

Template: [templates/docs/MODULE_DOC.md](../templates/docs/MODULE_DOC.md).

---

## 3. The registers

Living documents. **Append-only, newest first. Never renumber; never backfill.**

| Register | Question it answers |
|---|---|
| `ROOT_CAUSE_REGISTER.md` | Has this class of bug happened before, and what fixed it? |
| `CANONICAL_PATTERNS.md` | What is the one blessed way to do this? |
| `KNOWN_LIMITATIONS.md` | Is this a bug or a platform limit? What do we tell the customer? |
| `RBAC_MATRIX.md` | Who can do this, by default, and why? |
| `FEATURE_TRUTH.md` | What does the product actually do today? |
| `ENVIRONMENTS.md` | Which environment is which, and who may write to it? |
| `TEST_ACCOUNTS.md` | Which credentials and destinations are safe to use in a test? |
| `PRODUCT_LEXICON.md` | What is the one approved word for this concept? |
| `AI_GOVERNANCE.md` | What AI ships to users, what leaves the product, who owns the risk? |
| `TECH_DEBT.md` | What did we accept, and what does it cost? |
| `DECISION_LOG.md` | Index of architecture decision records |

**Why registers beat prose documentation:** a register answers a question you have *right now*,
in the middle of work. Nobody re-reads a 40-page standards document, but everybody greps a
register for the module they are about to touch.

**Two rules that keep them useful:**

- **A limitation entry requires a reference proving the platform blocks it.** No reference, no
  entry — otherwise the register fills with bugs misfiled as limitations, and the real ones stop
  being trusted.
- **Nothing is hard-deleted.** A resolved limitation moves to a resolved section, dated, with
  what resolved it. Old screenshots and old support answers still contain it.

---

## 4. The copy layer

**Every visible string is product, not decoration:** labels, buttons, toasts, alerts, empty
states, validation errors, notification text, and text inside anything a customer downloads.

- **Author strings at design time**, in a string table — not during build, under time pressure,
  by whoever is implementing that branch.
- **One approved word per concept**, recorded in
  [registers/PRODUCT_LEXICON.md](./registers/PRODUCT_LEXICON.md). Two words for one thing is a
  support problem before it is a style problem — and without that file, the freeze rule below
  has nothing to be frozen to.
- **The freeze rule: shipped strings are frozen.** A new feature adopts the existing word; it
  does not coin a better synonym. If the label says "Monthly fee", it stays "Monthly fee".

  A silent rewording is a product change nobody approved. It breaks the user's muscle memory,
  invalidates every support answer that quoted the old word, and invalidates every test
  expectation that asserted it — **and none of those show up as a red test.**

- **The one exception:** when the string *was* the bug — a raw database error shown to a user, an
  untranslated code, a dead-end message with no next step, blame-the-user phrasing. Then
  rewriting it *is* the fix. Say which string changed and why the exception applied, and do not
  extend the rewrite to its neighbours.

---

## 5. Comments

Comment the **why**, not the what. The code already says what it does; it cannot say why it does
it that way.

```ts
// ✗ increment the counter
count++;

// ✓ Order matters: 403 is checked before the generic auth rule, or a permission
//   denial gets treated as an expired session and the user is signed out for
//   opening a page they simply cannot see.
```

Comments worth writing: a non-obvious constraint · a deliberate deviation from the obvious
approach · a workaround with the reason and the condition for removing it · a warning about a
subtle failure · a link to the decision record.

**A comment that describes a rule must say where the rule is enforced**, or say that it is not.
A comment claiming enforcement that does not exist is worse than silence.

---

## 6. Changelog

Every release, in the language of the user rather than the commit:

> ✗ `refactor: extract InvoiceStatusBadge`
> ✓ `Invoice status is now visible directly in the list, without opening each invoice.`

Group by Added / Changed / Fixed / Removed. Include the migration or action note when a user or
operator must do something.

---

## 7. The documentation gate

`scripts/hooks/pre-commit-guard.sh` guard **G5**: application code changed with no documentation
touched → blocked. The escape token requires a stated reason, and it is auditable in the git
history.

The gate deliberately does **not** accept the machine-written gate summary as documentation —
otherwise every commit that ran the gate would satisfy it for free, and the guard would be live
but vacuous. *(That was a real defect in this framework, found by
`scripts/hooks/guard-reachability.test.sh`.)*
