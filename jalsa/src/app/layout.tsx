import type { Metadata, Viewport } from 'next';
import { Poppins, Noto_Sans } from 'next/font/google';
import './globals.css';
import { ThemeProvider, themeNoFlashScript } from '@/theme/ThemeProvider';
import { ToastProvider } from '@/components/ui/toast';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';
import { themeValues } from '@/theme/tokens.generated';

/**
 * The root layout. Three surfaces share it, and they share it deliberately: one theme, one
 * toast host, one service worker, one set of fonts on the wire.
 *
 * FONTS ARE SELF-HOSTED, NOT LINKED
 *   `next/font` downloads Poppins and Noto Sans at build time and serves them from this origin.
 *   The design set links them from Google's CDN; for a PWA that must open on a phone with a
 *   dead spot in a thick-walled dining room, a third-party font request is a render-blocking
 *   dependency on a host we do not control. Same typefaces, same weights — one fewer thing
 *   between a guest and the menu.
 */
const display = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
});

const body = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Jalsa Restaurant · Hosur',
    template: '%s · Jalsa',
  },
  description: 'Order from your table, round after round, one bill at the end.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Jalsa',
  appleWebApp: { capable: true, title: 'Jalsa', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/brand/favicon-light.svg', type: 'image/svg+xml' },
      { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/brand/apple-touch-icon.png',
  },
  // The guest surface is reached by scanning a physical code in a room. There is nothing here
  // for a crawler, and a half-indexed table page is worse than none.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom stays available. Disabling it is the single most common accessibility failure in
  // "app-like" web builds, and this menu is read by people who need to enlarge it.
  maximumScale: 5,
  viewportFit: 'cover',
  /* The browser chrome colour is a REAL value, not a var() — the OS paints it, and it cannot
   * read a stylesheet. It is therefore taken from the generated token map rather than typed
   * here, so a rebrand carries the address bar with it instead of leaving it behind. */
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: themeValues.light.background },
    { media: '(prefers-color-scheme: dark)', color: themeValues.dark.background },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable}`}>
      <head>
        {/* Applies the stored theme before the first paint, so nobody sees a cream flash on a
            dark phone. It runs before the bundle on purpose. */}
        <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
