# 08 — Cloud Integration and Hooks

> "Cloud hook" here means any place your application hands work to infrastructure you do not
> control: a serverless function, a scheduled job, a database trigger, an outbound webhook, an
> inbound webhook, a third-party API call.
>
> They share one property: **they fail differently from your application code, and they fail
> where nobody is watching.**

---

## 1. The single migration pipe

Every backend change — table, column, index, constraint, trigger, function, policy, secret,
however minor — exists as a **file in the migrations folder**.

Applied to the non-production environment first. Confirmed. Then the **identical file** applied
to production.

**Direct edits to either environment are drift by definition and are forbidden.** "Minor" is not
an exemption; in practice the most minor-looking edits cause the worst drift, precisely because
nobody writes them down.

### The migration ledger is the system of record
An object that exists in both databases but in **no migration file** is a blocking finding, not
a curiosity. It cannot be recreated in a new environment, reviewed, or rolled back. Backfill an
idempotent migration (`CREATE ... IF NOT EXISTS` — a no-op on live databases) before building
anything on top of it.

### The parity gate
Before backend work, and again before any production promotion: generate schema snapshots of
both environments and diff them. Any unacknowledged difference **blocks**. Production is the
source of truth; sync the other way, through migrations.

Snapshots are **generated**, never hand-maintained. A maintained snapshot becomes a third
environment that drifts, with the added problem that people trust it.

> "It worked in staging" means nothing while a parity diff is open.

---

## 2. Cloud functions: one shared pipeline

Every function goes through one wrapper
(`starter/supabase/functions/_shared/http.ts`) providing:

| Concern | Why it must be shared |
|---|---|
| CORS | Re-declared per function means N implementations and a header fixed in one, forgotten in N-1 |
| Preflight | Same |
| Authentication | The fail-closed rule must hold everywhere, not usually |
| Role checks | Same |
| Idempotency key | A write that can be applied twice will be |
| Response envelope | Clients need one parser, not one per endpoint |
| Error mapping | Internal detail must never reach a caller |
| Structured logging | Signature-based grouping only works if the shape is uniform |

**CORS defaults to an allowlist, not `*`.** Wildcard plus credentials is rejected by browsers
anyway; wildcard without credentials is a standing invitation for any origin to call your API.
Name your origins.

---

## 3. Outbound sends need a guard, not a convention

Any function that can reach a real human — email, SMS, chat, push — calls the outbound guard
**first**:

```ts
assertOutboundAllowed(destination, { allowOutbound, allowlist, appEnv });
```

**Deny by default outside production.** A test run that reaches a real customer cannot be
undone. A test run that fails to send costs one line in a log. Those are not comparable, so the
default is not a matter of taste.

---

## 4. Scheduled jobs

The failure mode is specific: a scheduled job that stops running **produces no error**. It
produces nothing at all, which is indistinguishable from "there was nothing to do".

- Every job records a run: started, finished, how many items processed — **including zero**.
- Alert on *absence*: "no run recorded in 25 hours" is the alert that matters, and it is the one
  nobody writes.
- Jobs are idempotent. Overlapping runs, retries and a manual re-run must be safe.
- Every job is manually triggerable. A job you cannot run on demand is a job you cannot debug.
- Process in bounded batches. A job that works at 100 records and times out at 100,000 fails
  exactly when the business is succeeding.

---

## 5. Webhooks

**Inbound:**
1. **Verify the signature before parsing the body.** An unverified webhook endpoint is an
   unauthenticated write endpoint.
2. **Assume redelivery.** Providers retry, and duplicates are normal. Deduplicate on the
   provider's event id.
3. **Acknowledge fast, process asynchronously.** Slow processing inside the handler causes the
   provider to time out and retry, multiplying the load at the worst moment.
4. **Log every receipt**, including ones you reject and why.

**Outbound:** sign what you send · retry with exponential backoff · cap the attempts · make the
final failure visible to someone; a silently abandoned webhook is a data-integrity problem in
another company's system.

---

## 6. Third-party APIs

- **One wrapper module per provider.** Every call goes through it. When the provider changes
  their contract — and they will — there is one place to change.
- **Timeouts on everything.** A call with no timeout is a hung request holding a connection.
- **Retry only what is retryable**: network failures and 5xx, with backoff. Never retry a 4xx —
  the answer will not change, and you have multiplied the load.
- **A circuit breaker** for anything on a critical path. Failing fast during a provider outage
  is better than queueing thousands of requests that will all time out.
- **Degrade gracefully, and visibly.** State what happens when the provider is down. "The
  feature is temporarily unavailable" is a fine answer. Silently rendering an empty result is
  not — it looks like real data.
- **Pin versions.** An unpinned API version changes under you, and the change arrives as a
  production incident with no deploy to correlate it to.

---

## 7. Cost and quota

Every cloud hook has a bill and a ceiling. State both before you build:
expected volume · cost at 10× that · rate limits · payload limits · execution-time ceiling ·
what happens at the ceiling.

The execution-time ceiling deserves particular attention. A synchronous report generator that
works for the first customer and times out for the largest one is a design problem discovered
in production — and the fix is usually a rewrite to an asynchronous job, not a tuning parameter.
