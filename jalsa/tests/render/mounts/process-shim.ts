/** A browser page has no `process`; Next.js inlines `process.env.*` at build time. Mount entries
 *  that pull in modules reading it import this first (08-Oct-2026). Test harness only. */
const g = globalThis as unknown as { process?: { env: Record<string, string> } };
g.process ??= { env: { NODE_ENV: 'development' } };
export {};
