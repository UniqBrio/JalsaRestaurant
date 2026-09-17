/**
 * next.config - one job: carry the framework's PUBLIC_* convention into the client bundle.
 *
 * `src/lib/config.ts` makes the trust boundary a NAME - PUBLIC_* is world-readable, everything
 * else is server-only - so a reviewer can spot a leaked secret without tracing imports. Next
 * inlines only NEXT_PUBLIC_* by default, which would leave every PUBLIC_* value undefined in
 * the browser and make `publicConfig` throw at import in every client component. Found the
 * first time gate G8 could actually boot the app. Listing them here inlines them under the
 * framework's own prefix, so the convention and the bundler agree.
 */
/* global process */
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    APP_ENV: process.env.APP_ENV ?? 'development',
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL ?? '',
    PUBLIC_API_URL: process.env.PUBLIC_API_URL ?? '',
    PUBLIC_BUILD_ID: process.env.PUBLIC_BUILD_ID ?? '',
    PUBLIC_SUPABASE_MAX_ROWS: process.env.PUBLIC_SUPABASE_MAX_ROWS ?? '',
  },
};
export default nextConfig;
