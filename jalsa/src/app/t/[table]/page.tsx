import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { NotConfiguredState, UnreachableState } from '@/components/ui/states';
import { attempt, configurationProblem, isConfigured } from '@/lib/supabase/server';
import { buildGuestPayload } from '@/lib/db/guest-view';
import { GuestApp } from '@/features/guest/GuestApp';

/**
 * /t/<table> — the address printed on the tabletop QR stand.
 *
 * THE URL IS THE DURABLE KEY, AND THAT IS THE WHOLE DESIGN.
 *   It contains a table name and nothing else: no session, no bill, no token. Everything the
 *   screen shows is resolved server-side from that name plus the phone's own cookie, which is
 *   why closing the browser, running out of battery or handing the phone to whoever is paying
 *   all lose nothing (Standard 6.5). It is also why the stands never need reprinting.
 *
 * The route is thin on purpose: it resolves, it renders. Every rule about what a guest may see
 * lives in `buildGuestPayload`, next to the rules about what they may do.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ table: string }> }): Promise<Metadata> {
  const { table } = await params;
  return { title: `Table ${table.toUpperCase()}` };
}

export default async function GuestTablePage({ params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;

  if (!isConfigured()) {
    return <NotConfiguredState problem={configurationProblem() ?? 'Configuration could not be read.'} />;
  }

  const loaded = await attempt('guest.page', () => buildGuestPayload(table));
  if (!loaded.ok) return <UnreachableState surface="guest" {...(loaded.detail ? { detail: loaded.detail } : {})} />;
  if (!loaded.value) return <UnknownTable name={table} />;

  return <GuestApp table={table} initial={loaded.value} />;
}

/**
 * A code that does not resolve to a table.
 *
 * Never a 404 page. A guest holding a phone over a laminated card does not need an HTTP status;
 * they need to know the card is wrong and that a person can fix it in ten seconds. Standard 1.6:
 * state the situation, give the fact needed next, offer what still works.
 */
function UnknownTable({ name }: { name: string }) {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center gap-4 px-6 text-center"
      data-testid="guest-unknown-table"
    >
      <h1 className="text-[21px] font-semibold">We cannot find table {name.toUpperCase()}</h1>
      <p className="m-0 text-[13.5px] leading-relaxed text-[var(--text-muted)]">
        The code you scanned points at a table this restaurant does not have — usually a card that has been moved, or
        one from an older set. Nothing is wrong at your end.
      </p>
      <p className="m-0 text-[13.5px] leading-relaxed text-[var(--text-muted)]">
        Show this screen to any of the team and they will bring you the right code, or take your order themselves.
      </p>
      <Button data-testid="guest-unknown-home" asChild variant="secondary">
        <Link data-testid="guest-unknown-home-link" href="/">
          Back to the start
        </Link>
      </Button>
    </main>
  );
}
