import type { Metadata } from 'next';
import { NotConfiguredState, UnreachableState } from '@/components/ui/states';
import { attempt, configurationProblem, isConfigured } from '@/lib/supabase/server';
import { currentStaff } from '@/lib/db/auth';
import { buildStaffPayload } from '@/lib/db/staff-view';
import { PinSignIn } from '@/features/staff/PinSignIn';
import { ChoosePin } from '@/features/staff/ChoosePin';
import { StaffApp } from '@/features/staff/StaffApp';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Staff' };

/**
 * /staff — the captain's and the waiter's phone.
 *
 * The gate is here rather than in middleware for one reason: the sign-in screen and the app are
 * the SAME route, so a session that expires mid-shift shows the keypad in place, on the screen
 * they were already on, and signing back in returns them to it. A redirect to /signin would
 * throw away where they were, which on a busy floor is the whole complaint.
 */
export default async function StaffPage() {
  if (!isConfigured()) {
    return <NotConfiguredState problem={configurationProblem() ?? 'Configuration could not be read.'} />;
  }

  const session = await attempt('staff.page.session', () => currentStaff('staff'));
  if (!session.ok)
    return <UnreachableState surface="staff" {...(session.detail ? { detail: session.detail } : {})} />;

  const staff = session.value;
  if (!staff) return <PinSignIn surface="staff" />;

  // An issued PIN opens this and nothing else. Not the floor with a banner over it — a banner is
  // a thing people dismiss, and the promise on the sign-in screen does not survive being
  // dismissed.
  if (staff.provisional) return <ChoosePin name={staff.name} surface="staff" />;

  const loaded = await attempt('staff.page.payload', () => buildStaffPayload(staff));
  if (!loaded.ok) return <UnreachableState surface="staff" {...(loaded.detail ? { detail: loaded.detail } : {})} />;

  return <StaffApp initial={loaded.value} />;
}
