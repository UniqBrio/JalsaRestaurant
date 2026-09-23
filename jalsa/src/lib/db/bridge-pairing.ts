import 'server-only';
import { randomBytes } from 'node:crypto';
import { db } from '@/lib/supabase/server';
import { hashToken } from '@/lib/bridge-token';
import { hashPairingCode, pairingVerdict, type PairingVerdict } from '@/lib/bridge-pairing-code';

/**
 * bridge-pairing — turning a code the owner read off a screen into a bridge credential.
 *
 * THE ONLY UNAUTHENTICATED WRITE IN THE PRINTING SYSTEM, AND WHY THAT IS SAFE
 *   The computer being paired has nothing to authenticate with yet; that is the problem pairing
 *   solves. So the code is the credential, and the whole of its safety is in four properties,
 *   each enforced below rather than hoped for:
 *     1. It is SINGLE-USE — spent by one conditional UPDATE (`used_at is null`), so two installers
 *        racing with the same code get one token between them, never two.
 *     2. It EXPIRES — the same update carries `expires_at > now`.
 *     3. It is RESTAURANT-SCOPED BY WHERE IT CAME FROM — the new token takes `restaurant_id` from
 *        the code's own row. Nothing the PC sends can name a restaurant, so a code issued by
 *        Restaurant A can only ever produce a credential for Restaurant A.
 *     4. It is STORED HASHED, like the token it buys.
 *
 * WHAT IT BUYS IS THE GATE 1 CREDENTIAL, UNCHANGED. A `bridge_token` row with a SHA-256 hash,
 * revocable by timestamp, listing/claiming/reporting for one restaurant. Pairing sits on top of
 * that model; it replaces none of it.
 */

export type RedeemResult =
  | { ok: true; token: string; label: string; restaurantName: string }
  | { ok: false; verdict: Exclude<PairingVerdict, 'ok'> };

export async function redeemPairingCode(input: {
  code: string;
  hostname: string;
  bridgeVersion: string;
}): Promise<RedeemResult> {
  const now = new Date();
  const codeHash = hashPairingCode(input.code);

  // THE SPEND. One statement; whoever updates the row owns the code.
  const { data: spent, error } = await db()
    .from('bridge_pairing_code')
    .update({ used_at: now.toISOString() })
    .eq('code_hash', codeHash)
    .is('used_at', null)
    .gt('expires_at', now.toISOString())
    .select('id,restaurant_id,label');
  if (error) throw error;

  const row = (spent ?? [])[0];
  if (!row) {
    // Explain the refusal from the row as it now stands. Same code, same answer every time.
    const { data: existing } = await db()
      .from('bridge_pairing_code')
      .select('expires_at,used_at')
      .eq('code_hash', codeHash)
      .maybeSingle();
    const verdict = pairingVerdict(
      existing ? { expires_at: existing.expires_at as string, used_at: existing.used_at as string | null } : null,
      now
    );
    // `ok` here would mean the row became redeemable between two statements, which it cannot.
    return { ok: false, verdict: verdict === 'ok' ? 'used' : verdict };
  }

  const restaurantId = row.restaurant_id as string;
  const label = row.label as string;
  const token = `jbt_${randomBytes(32).toString('hex')}`;

  const { data: created, error: tokErr } = await db()
    .from('bridge_token')
    .insert({
      // FROM THE CODE'S ROW. Never from the request.
      restaurant_id: restaurantId,
      label,
      token_hash: hashToken(token),
      source: 'paired',
      hostname: input.hostname.slice(0, 100),
      bridge_version: input.bridgeVersion.slice(0, 40),
      last_seen_at: now.toISOString(),
    })
    .select('id')
    .single();
  if (tokErr) throw tokErr;
  const tokenId = created.id as string;

  await db().from('bridge_pairing_code').update({ used_by_token_id: tokenId }).eq('id', row.id as string);

  // PAIRING AGAIN UNDER THE SAME NAME REPLACES THAT COMPUTER — the reinstall case. The old
  // paired credential is revoked (a timestamp, never a delete: the history still names it) and
  // its printer mappings move to the new one, so a reinstalled kitchen PC keeps its printers.
  // Two live bridges sharing a label would also share `claimed_by`, and `report` matches on it.
  const { data: previous } = await db()
    .from('bridge_token')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('label', label)
    .eq('source', 'paired')
    .is('revoked_at', null)
    .neq('id', tokenId);
  const oldIds = (previous ?? []).map((p) => p.id as string);
  if (oldIds.length) {
    await db().from('bridge_printer').update({ bridge_token_id: tokenId }).in('bridge_token_id', oldIds);
    await db().from('bridge_token').update({ revoked_at: now.toISOString() }).in('id', oldIds);
  }

  const { data: restaurant } = await db().from('restaurant').select('display_name').eq('id', restaurantId).maybeSingle();

  // The label and the PC's own name, never the code and never the token.
  await db()
    .from('audit_entry')
    .insert({
      restaurant_id: restaurantId,
      action: 'Printer',
      detail: `Printing computer ${label} paired${input.hostname ? ` (${input.hostname.slice(0, 60)})` : ''}`,
      actor_staff_id: null,
      actor_label: 'Jalsa Print Bridge',
      confidential: true,
    });

  return { ok: true, token, label, restaurantName: (restaurant?.display_name as string) ?? 'Jalsa' };
}
