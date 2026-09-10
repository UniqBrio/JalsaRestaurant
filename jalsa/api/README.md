# Server endpoints

Every endpoint uses `createRoute` from
[`../src/lib/api-handler.ts`](../src/lib/api-handler.ts), which makes the correct behaviour the
default and the incorrect behaviour extra work:

- **Authenticated unless `public: true` is written down deliberately** — and a public route must
  carry a `reason`, or it throws at construction. An unexplained public endpoint is an
  unreviewed one.
- **Tenant scope resolved once** and handed to the handler, so no query can forget it.
- **One response envelope**, so clients need one parser.
- **Internal error detail reaches the log and never the response body.**
- **A non-idempotent write declares its idempotency header**, so a double-tap cannot be applied
  twice.

Auth **fails closed**, including when the identity provider is unreachable. Failing open there
converts a provider outage into an authorisation bypass.

See [docs/07-SECURITY-AND-PRIVACY.md](../../docs/07-SECURITY-AND-PRIVACY.md).
