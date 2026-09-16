/**
 * config - fail-fast, typed, single-source environment configuration.
 *
 * THE TRUST BOUNDARY IS IN THE NAME
 *   PUBLIC_*  is bundled into the client. Assume every value is world-readable, forever.
 *   Everything else is server-only and must never be imported from client code.
 *   Making the prefix the rule means a reviewer can spot a leaked secret by NAME, without
 *   tracing an import graph. That is the whole reason to accept a noisy prefix.
 *
 * FAIL FAST, NOT AT 3AM
 *   Missing configuration is detected at process start with a message naming every missing
 *   variable at once - not lazily, at the first request that happens to need it, in production.
 *
 * ENVIRONMENT SEPARATION
 *   `APP_ENV` is explicit and independent of NODE_ENV, because "production build" and
 *   "production data" are different questions. A staging deploy is a production BUILD pointed
 *   at non-production DATA, and conflating them is how a test run reaches live customers.
 */

export type AppEnv = 'development' | 'test' | 'staging' | 'production';

interface RequiredSpec { name: string; description: string; publicVar?: boolean }

const CLIENT_REQUIRED: RequiredSpec[] = [
  { name: 'PUBLIC_APP_URL', description: 'Canonical origin, used for links and CORS.', publicVar: true },
  { name: 'PUBLIC_API_URL', description: 'Base URL of the backend API.', publicVar: true },
];

const SERVER_REQUIRED: RequiredSpec[] = [
  { name: 'DATABASE_URL', description: 'Primary datastore connection string.' },
  { name: 'SESSION_SECRET', description: 'Signing key for session tokens.' },
];

/**
 * PUBLIC values are read STATICALLY, by name, and only then dynamically.
 *
 * A bundler inlines `process.env.PUBLIC_API_URL` - a literal member access it can see at build
 * time - and inlines nothing for `process.env[name]`, which it cannot. This module read every
 * variable through the dynamic form, so in the browser every PUBLIC_* value was undefined, and
 * the "fail fast" below fired in every client component that imported the API client. Nothing
 * noticed for as long as the functional gate could not boot the app; the first run that could
 * showed "2 required client variable(s) are missing" on a server that had both set.
 *
 * The static table is the fix, and its shape is the point: adding a PUBLIC_* variable means
 * adding a line here AND to next.config.mjs, and the check below fails loudly if one is
 * forgotten - on the client, at import, which is where it would otherwise fail silently.
 */
const STATIC_PUBLIC: Readonly<Record<string, string | undefined>> = {
  APP_ENV: process.env.APP_ENV,
  PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
  PUBLIC_API_URL: process.env.PUBLIC_API_URL,
  PUBLIC_BUILD_ID: process.env.PUBLIC_BUILD_ID,
};
const read = (name: string): string | undefined => {
  const v = name in STATIC_PUBLIC ? STATIC_PUBLIC[name] : process.env[name];
  return v && v.trim() !== '' ? v.trim() : undefined;
};

function requireAll(specs: RequiredSpec[], scope: string): void {
  const missing = specs.filter((s) => !read(s.name));
  if (missing.length === 0) return;
  const lines = missing.map((m) => `  ${m.name.padEnd(24)} ${m.description}`).join('\n');
  throw new Error(
    `Configuration error: ${missing.length} required ${scope} variable(s) are missing.\n\n${lines}\n\n` +
      `Copy .env.example to .env and fill these in. See docs/05-CONFIGURATION-MANAGEMENT.md.`
  );
}

const rawEnv = read('APP_ENV') ?? 'development';
if (!['development', 'test', 'staging', 'production'].includes(rawEnv)) {
  throw new Error(`APP_ENV must be development|test|staging|production, got "${rawEnv}".`);
}
const appEnv = rawEnv as AppEnv;

requireAll(CLIENT_REQUIRED, 'client');

/** Safe to import anywhere, including client components. */
export const publicConfig = Object.freeze({
  env: appEnv,
  isProduction: appEnv === 'production',
  appUrl: read('PUBLIC_APP_URL')!,
  apiUrl: read('PUBLIC_API_URL')!,
  /**
   * Build identity, injected by CI from the commit SHA. The client compares this against the
   * server's /api/version to detect that it is running a bundle the server has replaced -
   * the mechanism behind guarded stale-build recovery. Never hand-set it.
   */
  buildId: read('PUBLIC_BUILD_ID') ?? 'dev',
});

/**
 * Server-only. Importing this from client code must be a build error - enforce it with a lint
 * rule (see .eslintrc) rather than a comment, because a comment does not fail a build.
 */
export function serverConfig() {
  if (typeof window !== 'undefined') {
    throw new Error('serverConfig() was called in the browser. Server secrets must never reach the client bundle.');
  }
  requireAll(SERVER_REQUIRED, 'server');
  return Object.freeze({
    ...publicConfig,
    databaseUrl: read('DATABASE_URL')!,
    sessionSecret: read('SESSION_SECRET')!,
    /**
     * Destructive and outbound-messaging operations are gated OFF by default and must be
     * enabled deliberately per environment. A default of "on" means a test run can reach a
     * real customer; a default of "off" means the worst case is a test that does not send.
     */
    allowOutboundMessages: read('ALLOW_OUTBOUND_MESSAGES') === 'true',
    outboundAllowlist: (read('OUTBOUND_ALLOWLIST') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  });
}

/**
 * Feature flags. Defaults live in code so a missing flag is OFF, never undefined-truthy.
 * A flag is a temporary object: every entry carries the date it was added and the condition
 * for its removal, so the flag set does not silently become permanent configuration.
 */
export const featureFlags = Object.freeze({
  // exampleNewCheckout: { enabled: read('FLAG_NEW_CHECKOUT') === 'true', added: '2026-01-15', removeWhen: 'rollout reaches 100% for 2 weeks' },
});
