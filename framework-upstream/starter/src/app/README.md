# Routes

Route and page files live here.

**Keep them thin: they compose, they do not implement.** A route file containing business logic
is logic that cannot be tested without a browser — and therefore logic that ends up tested by
hand, or not at all.

- Business rules → `src/features/<feature>/` or `src/lib/`
- Presentation → `src/components/`
- Data access → `src/lib/api-client.ts` (CP-4: one client, no exceptions)

See [docs/03-PROJECT-STRUCTURE.md](../../../docs/03-PROJECT-STRUCTURE.md).
