import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

/** This file's own directory — the application root, whatever the command was run from. */
const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Next configuration.
 *
 * Deliberately small. Every switch here is a behaviour the application depends on, so each one
 * states why it exists — a config value nobody can explain is a config value nobody can safely
 * change.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * A second instance of this app must be able to run beside the first.
   *
   * The degraded-state suite boots a copy pointed at a database it cannot reach, to prove the
   * app shows a designed screen rather than a stack trace. Two `next dev` processes sharing one
   * `.next` directory overwrite each other's build output and fail in ways that look like
   * application bugs. Unset — every ordinary run — nothing changes.
   */
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),

  /* This app lives inside the framework repository, which has a lockfile of its own. Naming
   * the root explicitly stops the bundler inferring the wrong one and resolving modules from
   * a directory that is not this application. */
  turbopack: { root: here },

  /* The typed-routes check is what stops a renamed route from becoming a 404 discovered by a
   * guest mid-order. It costs nothing at runtime. */
  typedRoutes: true,

  async headers() {
    return [
      {
        /* Every response (26-Oct-2026 audit, SEC-04). Nothing here is ever framed - not by this
         * app, not by anyone - so a page that could be laid invisibly over a decoy was a
         * clickjacking surface on the owner's console for no benefit. `frame-ancestors` is the
         * whole CSP on purpose: a script policy needs per-request nonces for Next's inline
         * scripts, and that is its own change (SECURITY_REMEDIATION_PLAN.md, SEC-11). */
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // The service worker must never be served from a stale cache, or a released fix can
        // sit unapplied on a guest's phone for as long as the old worker lives.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
