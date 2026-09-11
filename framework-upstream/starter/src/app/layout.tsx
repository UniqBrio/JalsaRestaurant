/**
 * The root layout — and, deliberately, the only place PWA support has to be wired.
 *
 * WHY THIS FILE SHIPS IN THE STARTER
 *   The framework's promise is that every scaffolded application is installable with no manual
 *   configuration. That promise is only keepable if the wiring arrives in the box: a manifest
 *   nothing links to is a file nobody reads, and a service worker nothing registers is a file
 *   nobody runs. Both are one line, and both are exactly the line that gets forgotten — so
 *   neither is left as an instruction in a document.
 *
 *   ThemeProvider already assumed a `<meta name="theme-color">` existed for it to keep in step,
 *   and until this file existed, nothing created one. That is fixed here too.
 *
 * WHAT IT DOES NOT DO
 *   Anything else. A root layout that grows business logic is logic no test can reach without a
 *   browser. It composes; it does not implement. See `./README.md`.
 */
import React from 'react';
import type { Metadata, Viewport } from 'next';
import { PwaProvider } from '../components/PwaProvider';
import { ThemeProvider, themeNoFlashScript } from '../theme/ThemeProvider';
import { appManifest as manifest } from '../theme/tokens.generated';
import '../theme/tokens.generated.css';

/**
 * Read from the GENERATED identity rather than restated here. Two sources for the app's name
 * is two names, and the one in the browser tab is not the one anybody remembers to update.
 *
 * It comes from `tokens.generated.ts` rather than from `public/manifest.webmanifest`, which is
 * the same object: importing the manifest file itself would ask the bundler to resolve an
 * extension it does not handle, and that failure would land in every scaffolded app's first
 * build. Both files are written by one generation from `design/tokens.json`, so reading either
 * gives the same answer - this one just compiles everywhere.
 */
export const metadata: Metadata = {
  title: manifest.name,
  description: manifest.description,
  applicationName: manifest.short_name,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    // iOS reads none of `display` or `display_override`; this is how a launch from the home
    // screen gets a standalone window there.
    capable: true,
    title: manifest.short_name,
    statusBarStyle: 'default',
  },
  icons: {
    icon: manifest.icons.map(({ src, sizes, type }) => ({ url: src, sizes, type })),
    // iOS will not take an SVG here, so it is pointed at the raster icon on purpose.
    apple: [{ url: '/brand/maskable-192.png', sizes: '192x192', type: 'image/png' }],
  },
};

/**
 * Two theme-colors, one per scheme. A manifest carries a single value because the format has
 * one field, and the OS paints the splash from it before any script runs. These cover the
 * browser chrome in both schemes from first paint; ThemeProvider then keeps the active one in
 * step when the user picks a preference explicitly.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Not `maximum-scale: 1`: disabling zoom to make an app feel native takes pinch-zoom away
  // from the people who need it most, and standalone display does not require it.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: manifest.theme_color },
    { media: '(prefers-color-scheme: dark)', color: manifest.background_color },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={manifest.lang ?? 'en'} dir={manifest.dir ?? 'ltr'} suppressHydrationWarning>
      <head>
        {/* Applies the stored preference before first paint. Without it the app renders in the
            default theme and then corrects itself, which reads as a flash of the wrong app. */}
        <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
      </head>
      <body>
        <ThemeProvider>
          <PwaProvider>{children}</PwaProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
