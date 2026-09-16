/**
 * The feature's data access - every call goes through the ONE client (CP-4). Nothing here
 * builds a URL by hand or calls fetch; the client owns auth, timeouts, retry and the envelope.
 *
 * Every write is followed by a RE-READ through `list()` by the caller, never by a local edit
 * of the rows it already had. The delete-semantics spec exists because the two layers can be
 * self-consistent and still disagree; reading back through the same path the list uses is the
 * only assertion that catches it.
 */
import { get, patch, post } from '../../lib/api-client';
import type { Item, ItemDraft } from './types';

export const list = () => get<Item[]>('/items');

export const create = (draft: ItemDraft) => post<{ id: string }>('/items', draft);

/**
 * The WHOLE record is sent, edits merged over it. A form that submits only the fields it
 * rendered sends back everything it did not render as absent - and the stored value is gone,
 * silently, on a save that looked like a no-op (CP-25).
 */
export const update = (existing: Item, draft: ItemDraft) =>
  patch<{ id: string }>(`/items/${existing.id}`, { ...existing, ...draft });

export const archive = (id: string) => post<{ id: string }>(`/items/${id}/archive`, {});
