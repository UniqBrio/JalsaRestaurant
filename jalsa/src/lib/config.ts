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

interface RequiredSpec {
  name: string;
  description: string;
  publicVar?: boolean;
}

const CLIENT_REQUIRED: RequiredSpec[] = [
  { name: 'PUBLIC_APP_URL', description: 'Canonical origin, used for links and CORS.', publicVar: true },
  { name: 'PUBLIC_API_URL', description: 'Base URL of the backend API.', publicVar: true },
];

const CLIENT_REQUIRED_SUPABASE: RequiredSpec[] = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL', description: 'Supabase project URL.', publicVar: true },
  {
    name: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    description: 'Supabase publishable key (world-readable by design).',
    publicVar: true,
  },
];

const SERVER_REQUIRED: RequiredSpec[] = [
  {
    name: 'SUPABASE_SECRET_KEY',
    description:
      'Supabase secret key. Bypasses row-level security, so it is the ONLY thing that may read or write the restaurant tables - and it may never be imported from client code.',
  },
  { name: 'SESSION_SECRET', description: 'Signing key for the staff PIN session cookie.' },
];

const read = (name: string): string | undefined => {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : undefined;
};

function requireAll(specs: RequiredSpec[], scope: string): void {
  const missing = specs.filter((s) => !read(s.name));
  if (missing.length === 0) return;
  const lines = missing.map((m) => `  ${m.name.padEnd(24)} ${m.description}`).join('\n');
  throw new Error(
    `Configuration error: ${missing.length} required ${scope} variable(s) are missing.\n\n${lines}\n\n` +
      `Copy .env.example to .env and fill these in. See docs/10-CONFIGURATION-MANAGEMENT.md.`
  );
}

const rawEnv = read('APP_ENV') ?? 'development';
if (!['development', 'test', 'staging', 'production'].includes(rawEnv)) {
  throw new Error(`APP_ENV must be development|test|staging|production, got "${rawEnv}".`);
}
const appEnv = rawEnv as AppEnv;

requireAll([...CLIENT_REQUIRED, ...CLIENT_REQUIRED_SUPABASE], 'client');

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

  supabaseUrl: read('NEXT_PUBLIC_SUPABASE_URL')!,
  supabasePublishableKey: read('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')!,

  /**
   * The origin printed into every tabletop QR code. Separate from appUrl because the QR codes
   * are PHYSICAL objects: they outlive a preview deployment, and reprinting twenty laminated
   * stands because a build pointed at the wrong host is not a mistake worth making twice.
   */
  qrOrigin: read('NEXT_PUBLIC_QR_ORIGIN') ?? read('PUBLIC_APP_URL')!,
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
    supabaseSecretKey: read('SUPABASE_SECRET_KEY')!,
    sessionSecret: read('SESSION_SECRET')!,
    /**
     * Destructive and outbound-messaging operations are gated OFF by default and must be
     * enabled deliberately per environment. A default of "on" means a test run can reach a
     * real customer; a default of "off" means the worst case is a test that does not send.
     */
    allowOutboundMessages: read('ALLOW_OUTBOUND_MESSAGES') === 'true',
    outboundAllowlist: (read('OUTBOUND_ALLOWLIST') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
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
