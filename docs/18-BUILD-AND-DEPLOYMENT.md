# 18 — Build and Deployment

---

## 1. The boundary

```
  commit → CI gate → preview deploy → [HUMAN APPROVAL] → production
           ────────automated────────                    ──approved──
```

**Automation ends at the preview environment.** Production promotion is always a separate,
explicitly approved step.

Not because automation is untrustworthy, but because the *decision* to expose a change to real
users is a business decision, and it should be made by someone who can be asked why.

---

## 2. Build

Deterministic and reproducible:

- **Committed lockfile.** `npm ci`, never `npm install`, in CI.
- **The commit SHA is the build identity**, injected as `PUBLIC_BUILD_ID`.
- **The build fails on any gate failure.** A build that succeeds while a check failed is a build
  that taught everyone to ignore the checks.
- **No environment-specific code paths.** The same artifact runs in staging and production; only
  configuration differs. `if (isProduction)` branches mean staging never tested what shipped.

---

## 3. Caching, which is where the subtle bugs live

| Asset | Header | Why |
|---|---|---|
| Content-hashed assets | `max-age=31536000, immutable` | The filename changes when the content does |
| HTML | `no-store` | It references the hashed assets; a cached one references *deleted* files |
| Service workers | `no-store` | A cached service worker cannot be replaced — the worst version of this bug |
| API responses | Explicit, per endpoint | Never accidental |

The classic failure: HTML cached for an hour, referencing bundles that no longer exist after a
deploy. The user gets a blank page and a chunk-load error, and a hard refresh "fixes" it — which
is why it survives so long undiagnosed.

---

## 4. Stale-build recovery, guarded

Client compares its baked `PUBLIC_BUILD_ID` against the server's `/api/version`.

Rules, and every one of them exists because its absence produced an incident:

1. **Reload only on a CONFIRMED mismatch.** Never on a generic failure.
2. **Guard every reload with a session-scoped flag.** A momentary inconsistency must not loop.
3. **At most one reload**, then surface a real message. An ungated reload loop on a blank screen
   leaves the user no way out at all.
4. Chunk-load errors from failed dynamic imports route through the **same** guarded path — they
   are the same condition wearing a different error name.

---

## 5. Database changes deploy in a specific order

**Expand → migrate → contract.** Never a destructive change in one step.

```
1. Add the new column, nullable. Deploy.                    ← old code still works
2. Backfill. Deploy code that writes BOTH old and new.      ← both work
3. Deploy code that reads the new.                          ← old code still works
4. Only once nothing reads the old: drop it.                ← separate release
```

The reason is not caution for its own sake: during any rolling deploy, **old and new code run
simultaneously**. A migration that assumes otherwise breaks the instances that have not restarted
yet, and it breaks them in production, under load.

Adding a `NOT NULL` column with no default to a table with existing rows fails immediately.
Adding one *with* a default rewrites the whole table and locks it. Neither is what you wanted
at 4pm on a Friday.

---

## 6. Pre-deployment

[checklists/RELEASE_READINESS.md](../checklists/RELEASE_READINESS.md). The blocking items:

- Gate verdict is **PASS**, with no unaccepted BLOCKED classes.
- **Schema parity is clean** between environments, or every difference is explicitly
  acknowledged. *"It worked in staging" means nothing while a parity diff is open.*
- Migrations are ordered and each one's rollback is written.
- Configuration exists in the target environment. A missing variable is an outage at boot.
- Rollback plan written **and previously executed at least once**.
- Someone is watching for the next hour, and they know what they are watching for.

---

## 7. Rollback

**Practise it before you need it.** Execute a rollback deliberately, once, while nothing is at
stake. A rollback procedure that has never been run is a hypothesis, and the moment you need it
is the worst possible moment to discover it does not work.

- Code rollback: redeploy the previous build. Fast, and it should be a single command.
- **Database rollback is different and harder.** A migration that dropped a column cannot be
  undone by redeploying old code. This is the real reason for expand/migrate/contract: it keeps
  every intermediate state rollback-safe.
- Some changes are **irreversible** — a destructive migration, a sent message, an external
  side effect. Identify them in the plan and treat them as one-way doors: slower approval, more
  verification, a smaller blast radius.

---

## 8. After deploying

**+1 hour and +24 hours:**

- Group errors by **signature** (message shape), not instance.
- **Diff against the pre-deploy window.** A high error count that was equally high yesterday is
  not caused by this release.
- Map new signatures to the change only where the link is **defensible**. Correlation during a
  deploy window is weak evidence, and a wrong attribution sends everyone in the wrong direction.
- Check the things that fail silently: scheduled jobs still running, queues draining, webhooks
  acknowledged, outbound messages actually sending.

A scheduled job that stopped produces no error. It produces nothing, which looks exactly like
having nothing to do. **Alert on absence**, not just on failure.
