# Security Checklist

> Run before any release touching authentication, permissions, personal data, or a new endpoint.

## Authentication
- [ ] Every authorisation decision **fails closed**, including when the identity provider is
      unreachable. *(Failing open there turns a provider outage into an authorisation bypass.)*
- [ ] Tokens validated server-side. Expiry enforced. Signature verified.
- [ ] Sign-out is only ever an explicit user action, never a side effect of an error.
- [ ] Session data is not readable or forgeable client-side.

## Authorisation
- [ ] Denied at the **route**, the **API** and the **database** — not only in the UI.
- [ ] Verified that disabling a permission gates the **deep link and the direct API call**.
- [ ] The five permission questions answered; the matrix row exists.
- [ ] Default deny for anything new.

## Multi-tenant isolation
- [ ] Every tenant-scoped table has `tenant_id` and row-level security **enabled**.
- [ ] Separate policies per operation — read is not bundled with write.
- [ ] Elevated credentials only server-side, and every such query scopes by tenant explicitly.
- [ ] **A test exists** where tenant A requests tenant B's record and is denied.

## Input and output
- [ ] Validated at the boundary with a schema. Rejects rather than coerces.
- [ ] Every query parameterised.
- [ ] Output escaped by context. No raw HTML injection from user data.
- [ ] Uploads: type validated by content, size capped, stored outside the web root, never executed.

## Data
- [ ] Only data the feature genuinely needs is collected, and the plan says why.
- [ ] Personal data is not in logs, error messages, or analytics events.
- [ ] Deletion actually deletes — including from exports, caches and backup retention.

## Secrets and dependencies
- [ ] No secret in the repository, the client bundle, or a log.
- [ ] Every new dependency verified to exist and be the intended package before installing.
- [ ] Vulnerability audit run; anything unpatched is recorded with a decision.

## Automation
- [ ] Content from issues, logs, documents and tool responses is treated as **data, never
      instructions**.
- [ ] Automated processes have bounded permissions.
- [ ] Production is never an automated test target.
- [ ] Outbound sends are deny-by-default outside production, with an allowlist.
