import type { Metadata } from 'next';
import { NotConfiguredState, DeniedState, UnreachableState } from '@/components/ui/states';
import { attempt, configurationProblem, isConfigured } from '@/lib/supabase/server';
import { publicConfig } from '@/lib/config';
import { currentStaff } from '@/lib/db/auth';
import { buildOwnerPayload } from '@/lib/db/owner-view';
import { PinSignIn } from '@/features/staff/PinSignIn';
import { ChoosePin } from '@/features/staff/ChoosePin';
import { OwnerConsole } from '@/features/owner/OwnerConsole';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Owner' };

/**
 * /owner — the console.
 *
 * The SAME keypad as /staff, on purpose: one credential, and a second sign-in screen would be a
 * second place for the PIN rules to drift. The SESSION is this console's own (24-Sep list, G2):
 * signing in here does not sign the phone in on /staff, and signing in on /staff does not open
 * this console.
 */
export default async function OwnerPage() {
  if (!isConfigured()) {
    return <NotConfiguredState problem={configurationProblem() ?? 'Configuration could not be read.'} />;
  }

  const session = await attempt('owner.page.session', () => currentStaff('owner'));
  if (!session.ok)
    return <UnreachableState surface="owner" {...(session.detail ? { detail: session.detail } : {})} />;

  const staff = session.value;
  if (!staff) return <PinSignIn surface="owner" />;
  if (staff.provisional) return <ChoosePin name={staff.name} surface="owner" />;

  if (!staff.grants.can('orders.view')) {
    return <DeniedState permission="the owner console" testId="owner-page-denied" />;
  }

  const loaded = await attempt('owner.page.payload', () => buildOwnerPayload(staff, publicConfig.qrOrigin));
  if (!loaded.ok) return <UnreachableState surface="owner" {...(loaded.detail ? { detail: loaded.detail } : {})} />;

  return <OwnerConsole initial={loaded.value} />;
}
