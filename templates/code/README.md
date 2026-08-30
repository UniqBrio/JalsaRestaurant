# Code templates

**Deliberately thin.** The reference implementations in `starter/src/` *are* the code templates —
each one is a working file with the reasoning in its header comment, and it is verified by the
same gates as everything else.

A parallel folder of code snippets would be a second copy that drifts, and the drifted copy is
always the one someone finds first. See [docs/09](../../docs/09-CODE-QUALITY.md) on dead weight.

| Pattern | Copy from |
|---|---|
| Error taxonomy (pure) + facade | `starter/src/lib/errors.taxonomy.ts`, `errors.ts` |
| Fail-fast configuration | `starter/src/lib/config.ts` |
| API route with fail-closed auth | `starter/src/lib/api-handler.ts` |
| Data client: one place for auth, retry, timeouts | `starter/src/lib/api-client.ts` |
| Signature-based logging | `starter/src/lib/logger.ts` |
| Tri-state identity resolution | `starter/src/lib/session.ts` |
| Idempotent writes | `starter/src/lib/upsert.ts` |
| Date entry / display / storage | `starter/src/lib/dates.ts` |
| Theme provider, themed images, toggle | `starter/src/theme/` |
| Dialog that never eats work | `starter/src/components/Dialog.tsx` |
| Honest permission denial | `starter/src/components/NoAccess.tsx` |
| Scrolling tab row | `starter/src/components/TabRow.tsx` |
| Bulk selection with partial-failure reporting | `starter/src/components/BulkBar.tsx` |
| Migration with RLS and rollback | `starter/supabase/migrations/` |
| Cloud function pipeline | `starter/supabase/functions/_shared/http.ts` |
| Transactions and compensation | `starter/supabase/functions/_shared/tx.ts` |
| Calling a model provider | `starter/supabase/functions/_shared/provider.ts` |
| Unit / render / functional specs | `starter/tests/` |
