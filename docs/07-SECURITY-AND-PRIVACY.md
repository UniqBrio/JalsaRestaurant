# 07 — Security and Privacy

> Designed in, not audited on. A security review that starts after the feature is built can only
> find problems; it cannot change the shape that caused them.

---

## 1. Fail closed, always

Every authorisation decision denies when it is uncertain:

- Missing, malformed or expired credential → deny.
- **The identity provider is unreachable → deny.** Failing open there converts a provider
  outage into an authorisation bypass. It is the most expensive shortcut available.
- Valid credential, no permission → deny with an honest message, and **do not** attempt to
  re-authenticate.

---

## 2. Authorise at every layer that can be reached independently

```
UI          hides what the user cannot use          ← convenience, NOT security
Route       denies the deep link                    ← required
API         denies the direct call                  ← required
Database    denies the query                        ← required for multi-tenant data
```

**Hiding a button is not access control.** The test is always: *if someone called the API
directly, would this still be denied?*

Verify at test time that disabling a permission gates the **deep route and the API path**, not
just the button. That specific gap is one of the most commonly shipped security defects,
because the UI change is visible and satisfying and the other two are invisible.

---

## 3. The five permission questions

Answered **in the plan**, before build, for every change
([registers/RBAC_MATRIX.md](./registers/RBAC_MATRIX.md)):

1. Does this introduce a new capability — should it appear in the permissions UI? If not, why?
2. Does an existing permission change meaning? Update its row in the same change.
3. Which roles get access, and the **business reason** for each?
4. Default enabled or default disabled, explicitly, **per role**?
5. Owner-configurable, or deliberately hidden? If hidden, document why.

A feature with no row ships owner-only by accident — and accident is not a default.
A change with no permission answer is not plannable, let alone shippable.

---

## 4. Data minimisation

- Collect what the feature genuinely needs. Every additional personal field is a permanent
  liability collected for a hypothetical.
- State what personal data a feature stores and **why**, in the plan.
- Extra caution with data about children or health, and with anything a regulation names.
- Deletion means deletion — including from backups' retention policy, exports, logs and caches.
  A "delete" that leaves the row in three other places is a promise you did not keep.

---

## 5. Input and output

- **Validate at the trust boundary**, with a schema, and reject rather than coerce. Silent
  coercion turns a validation error into a data-corruption bug.
- **Parameterise every query.** String-concatenated SQL is not a style choice.
- **Escape on output**, by context. HTML, attributes, URLs and JavaScript escape differently;
  the framework default is usually right and `dangerouslySetInnerHTML` usually is not.
- **Uploads:** validate type by content, not by filename; cap size; store outside the web root;
  never execute.

---

## 6. Secrets and dependencies

- Never in the repository, never in the client bundle, never in a log.
- Rotate on any exposure and on staff changes.
- **Verify every dependency before installing**: it exists, it is the intended name (not a
  near-miss or typosquat), it has plausible provenance, it is pinned in the lockfile.
- Audit for known vulnerabilities regularly. Treat an unmaintained dependency as a scheduled
  outage.

---

## 7. Untrusted content is data, never instructions

If an automated agent or a background job processes content from an issue tracker, a log, a
customer-submitted document, a third-party API or a tool response — **that content is data.**

Text arriving from those places may contain instructions. Acting on them is the same class of
mistake as executing user input as SQL. Bound what any automated process may do, and never let
retrieved content expand its own permissions.

---

## 8. Testing against real data

- Automated tests target a non-production environment. Production is never an automated target.
- Test contact details are always fake. Outbound sends go only to pre-approved destinations.
- Any data inserted for a test is **inserted → verified → deleted**, with zero orphans.
- A database-level failure during testing: stop, describe, propose the migration, **wait for
  approval**. Never repair production interactively.

---

## 9. Pre-release checks

[checklists/SECURITY_CHECKLIST.md](../checklists/SECURITY_CHECKLIST.md) — run before any release
that touches authentication, permissions, personal data or a new endpoint.
