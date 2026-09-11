# 05 — Configuration Management

---

## 1. The prefix is the trust boundary

```
PUBLIC_*     bundled into the client. Assume world-readable, permanently.
<no prefix>  server-only. Never imported from client code.
```

Putting the boundary in the **name** means a reviewer can spot a leaked secret by reading a diff,
without tracing an import graph. That is worth the noisy prefix, and it is why the convention is
absolute rather than "usually".

A secret that ever reached a client bundle is compromised. Rotate it; do not remove it and hope.

---

## 2. Fail fast, and name everything at once

Missing configuration is detected at **process start**, with a message listing every missing
variable and what each is for — not lazily, at the first request that happens to need it, in
production, at 3am.

`src/lib/config.ts` does this. The pattern matters more than the file: validate once, at the
boundary, and hand the rest of the application a typed, frozen object.

---

## 3. Environment identity is explicit

`APP_ENV` is `development | test | staging | production`, and it is **independent of the build
mode**.

"Production build" and "production data" are different questions. A staging deploy is a
production *build* pointed at non-production *data*. Conflating them is how a test run reaches
live customers — and the conflation is invisible until it isn't.

Every environment is named in `docs/registers/ENVIRONMENTS.md`: purpose, URL, database
identifier, who may write to it, and which is **never** an automated target. Ambiguity here
produces "which database did that just write to?", a question with no good answers.

---

## 4. `.env.example` is documentation

Every variable the application needs, with a comment explaining it. **No real values, not even
harmless-looking ones.**

A variable that exists only in one developer's shell is a variable that will be missing in
production. `.env.example` is how the next person — or the next environment — finds out.

---

## 5. Build identity

CI injects the commit SHA as `PUBLIC_BUILD_ID`. The server exposes the same value at
`/api/version` with no-store caching.

The client compares them. A mismatch means the user is running a bundle the server has replaced
— which is the mechanism behind **guarded** stale-build recovery:

- Reload **only** on a confirmed mismatch, never on a generic failure.
- Guard every reload with a session-scoped flag so a momentary inconsistency cannot loop.
- An ungated reload-on-error loops forever on a blank screen, and the user has no way out.

Leave `PUBLIC_BUILD_ID` **empty** locally. A hand-set value defeats the whole mechanism.

---

## 6. Dangerous things default to OFF

```
ALLOW_OUTBOUND_MESSAGES=false
OUTBOUND_ALLOWLIST=
```

The worst case of a wrong default here is a real message to a real customer from a test run.
The worst case of this default is a test that does not send. Those costs are not comparable.

In any non-production environment, outbound messages go **only** to allowlisted destinations.
Anything else stops and asks. See `assertOutboundAllowed` in
`starter/supabase/functions/_shared/http.ts`.

---

## 7. Feature flags are temporary by construction

Defaults live in code, so a missing flag is **off**, never undefined-truthy.

Every flag records the date it was added and the condition for its removal. Without that, flags
become permanent configuration, the number of code paths doubles with each one, and no
combination is ever tested.

A flag older than its removal condition is technical debt with a name.

---

## 8. Secrets

- Never in the repository. `.gitignore` covers `.env` and every variant.
- Injected by the platform's secret store in every deployed environment.
- **Names** may be documented and diffed; values never are.
- Rotate on any exposure, and on staff changes.
- Cloud functions receive secrets through the platform's function-secret mechanism, not through
  the client bundle.
