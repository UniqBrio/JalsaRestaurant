import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { NotConfiguredState, UnreachableState } from '@/components/ui/states';
import { attempt, configurationProblem, isConfigured } from '@/lib/supabase/server';
import { readQueueEntry, listWaitlist, readAllSettings, readRestaurant } from '@/lib/db/queries';
import { weekdayIn } from '@/lib/restaurant-time';
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
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export default async function QueuePage() {
  if (!isConfigured()) {
    return <NotConfiguredState problem={configurationProblem() ?? 'Configuration could not be read.'} />;
  }

  const jar = await cookies();
  const id = jar.get('jalsa_queue')?.value ?? null;

  const loaded = await attempt('queue.page', async () => {
    const [waiting, settings, entry, restaurant] = await Promise.all([
      listWaitlist(),
      readAllSettings(),
      id ? readQueueEntry(id) : Promise.resolve(null),
      // The door code shows the restaurant's own logo, and the owner can replace it.
      readRestaurant(),
    ]);
    const queue = (settings.queue ?? {}) as { open?: boolean };
    const hours = (settings.hours ?? {}) as {
      days?: Array<{ day: string; open: string; close: string; shut: boolean }>;
      note?: string;
    };
    const today = DAYS[weekdayIn()];
    return {
      waiting: waiting.length,
      entry,
      // Open unless somebody closed it — see the note on the owner's control.
      queueOpen: queue.open !== false,
      hoursRows: (hours.days ?? []).map((d) => ({
        day: d.day,
        hours: d.shut ? 'Closed' : `${d.open} – ${d.close}`,
        today: d.day === today,
      })),
      hoursNote: hours.note ?? '',
      logoUrl: (restaurant.logo_url as string) || '/brand/jalsa-badge.png',
    };
  });
  if (!loaded.ok) return <UnreachableState surface="guest" {...(loaded.detail ? { detail: loaded.detail } : {})} />;

  const { waiting, entry, queueOpen, hoursRows, hoursNote, logoUrl } = loaded.value;
  const estimate = Math.max(5, Math.round((waiting * MINUTES_PER_PARTY) / 5) * 5);
  const waitLabel = waiting
    ? `About ${estimate} minutes right now.`
    : 'No wait at the moment — walk straight in.';

  return (
    <main className="mx-auto flex min-h-dvh w-full flex-col justify-center gap-6 px-4 py-10"
          style={{ maxWidth: 'var(--layout-guest-max-width)' }}>
      <GuestQueue
        initial={entry}
        waitLabel={waitLabel}
        logoUrl={logoUrl}
        queueOpen={queueOpen}
        hoursRows={hoursRows}
        hoursNote={hoursNote}
      />
    </main>
  );
}
