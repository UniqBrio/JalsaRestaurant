# Permission Matrix

> **A feature with no row here ships owner-only by accident — and accident is not a default.**
>
> Defaults are business decisions with a stated reason, never developer assumptions.
> Rows are append/supersede-only; never deleted.

---

## The five questions — answered in the plan, before build

1. Does this introduce a **new capability**? Should it appear in the permissions UI? If not, why
   (one line)?
2. Does an **existing permission change meaning**? Update its row in the same change.
3. **Which roles** get access, and the **business reason** for each?
4. **Default enabled or default disabled**, explicitly, **per role**?
5. **Owner-configurable**, or deliberately hidden from the permissions UI? If hidden, document why.

A change with no permission answer is not plannable, let alone shippable.

---

## Matrix

| Capability (permission key) | Owner | Admin | Member | Viewer | Configurable? | Reason | Decided |
|---|---|---|---|---|---|---|---|
| _example: `invoices.create`_ | ✅ on | ✅ on | ⬜ off | ⬜ off | Yes | _Members create invoices only where the tenant opts in; the default is off because a mis-issued invoice reaches a customer._ | _DD-MMM-YYYY_ |

Legend: ✅ default enabled · ⬜ default disabled · ➖ not applicable · 🔒 always on, not configurable

The **Reason** column carries real reasoning, not a restatement of the row. Good reasons look
like: *"owner-only by absence — the server exposes no such action at all, so this is not a
toggle"*; *"these two share one key because splitting them would let a user create a record they
cannot then see"*; *"registered but currently inert — the UI ships next release"*.

---

## Release validation

- [ ] The permission exists in the permissions UI (or its absence is documented).
- [ ] Defaults in the running system match this matrix.
- [ ] **Toggling it actually gates the surface** — the deep route and the API path, not just the
      button. *This is the gap most commonly shipped, because the UI change is visible and
      satisfying while the other two are invisible.*
- [ ] The role hierarchy is still coherent: no role can do something a role above it cannot.
- [ ] Impersonation and support-access paths short-circuit owner-only reads correctly.

---

## Backfill

Every feature that predates this register needs a row. Fill them in module by module, at each
touch, rather than in one sitting — a backfill done from memory records what someone *thinks*
the defaults are, which is exactly the problem this register exists to solve.
