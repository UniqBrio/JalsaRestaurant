import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'No signal' };

/**
 * The page the service worker serves when a navigation cannot reach the server.
 *
 * IT IS DELIBERATELY HONEST ABOUT WHAT IT DOES NOT KNOW
 *   It cannot say whether a round was sent, because it cannot reach anything that would know.
 *   So it says exactly that, and it names the one thing that is always still true in a
 *   restaurant: there is a person standing a few metres away. A dead end with no route onward
 *   turns a dropped signal into an abandoned table (Standard 1.6).
 */
export default function Offline() {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center gap-4 px-6 text-center"
      data-testid="offline-page"
    >
      <h1 className="text-[22px] font-semibold">No signal right now</h1>
      <p className="m-0 text-[13.5px] leading-relaxed text-[var(--text-muted)]">
        Your phone cannot reach us at the moment, so this page could not load. Nothing is lost — your table and your
        bill are held on our side, not on your phone.
      </p>
      <p className="m-0 text-[13.5px] leading-relaxed text-[var(--text-muted)]">
        If you were sending a round, we cannot tell from here whether it arrived. When the signal comes back, reopen
        the code on your table and your order will be there. In a hurry, your captain is quicker than the wifi.
      </p>
      {/* A real navigation, not a router link. This page is served by the service worker when
          the network failed — a client-side route change would re-render the same shell without
          ever touching the network, which is the one thing this button must do. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        data-testid="offline-retry"
        href="/"

        className="mx-auto mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--primary)] px-6 text-[14px] font-semibold text-[var(--on-primary)]"
      >
        Try again
      </a>
    </main>
  );
}
