import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { NotConfiguredState, UnreachableState } from '@/components/ui/states';
import { attempt, configurationProblem, isConfigured } from '@/lib/supabase/server';
import { readQueueEntry, listWaitlist } from '@/lib/db/queries';
import { GuestQueue } from '@/features/guest/GuestQueue';

/**
 * /q — the code on the door.
 *
 * ONE ADDRESS, NOT ONE PER PARTY
 *   The tabletop stands carry a table name because a table is a permanent thing. The door is
 *   one place, so it carries one address, and which party is looking at it is answered by the
 *   phone's own cookie rather than by the URL (Standard 6.5 again). That is what lets the same
 *   printed code serve every party, every night, without reprinting.
 *
 * WHY THE WAIT IS READ HERE AND NOT IN THE CLIENT
 *   "About 20 minutes right now" is the first sentence a party reads, and it has to be the same
 *   sentence the host would say. It comes from the live queue on the server, so the door and the
 *   desk cannot disagree.
 *
 * Guardrail 6: `attempt()`, never a bare await. A guest holding a phone at a door is exactly the
 * person who must not meet a stack trace.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Join the queue' };

const MINUTES_PER_PARTY = 6;

export default async function QueuePage() {
  if (!isConfigured()) {
    return <NotConfiguredState problem={configurationProblem() ?? 'Configuration could not be read.'} />;
  }

  const jar = await cookies();
  const id = jar.get('jalsa_queue')?.value ?? null;

  const loaded = await attempt('queue.page', async () => {
    const waiting = await listWaitlist();
    const entry = id ? await readQueueEntry(id) : null;
    return { waiting: waiting.length, entry };
  });
  if (!loaded.ok) return <UnreachableState surface="guest" {...(loaded.detail ? { detail: loaded.detail } : {})} />;

  const { waiting, entry } = loaded.value;
  const estimate = Math.max(5, Math.round((waiting * MINUTES_PER_PARTY) / 5) * 5);
  const waitLabel = waiting
    ? `About ${estimate} minutes right now.`
    : 'No wait at the moment — walk straight in.';

  return (
    <main className="mx-auto flex min-h-dvh w-full flex-col justify-center gap-6 px-4 py-10"
          style={{ maxWidth: 'var(--layout-guest-max-width)' }}>
      <GuestQueue initial={entry} waitLabel={waitLabel} />
    </main>
  );
}
