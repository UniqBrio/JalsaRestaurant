'use client';
/**
 * ItemsScreen - the reference list. Every functional spec under tests/functional/ drives it.
 *
 * WHAT IT COMPOSES, AND WHAT IT DOES NOT BUILD
 *   Tabs (TabRow, CP-7/CP-17) · search (ListControls + useListControls, CP-23) · the add/edit
 *   dialog (ItemForm over Dialog, CP-14/CP-16/CP-25) · archive confirmation (ConfirmDialog,
 *   the destructive half of CP-14/CP-28) · the toasts (ToastHost). Nothing on this screen is
 *   a second implementation of a registered concern.
 *
 * THE TWO RULES EVERY WRITE FOLLOWS
 *   1. After a write, RE-READ. The rows on screen are never edited locally to look like the
 *      write happened. A row removed optimistically and never re-read passes every assertion
 *      and comes back the moment anyone refreshes (CP-26); the round trip is the assertion.
 *   2. The toast reports what the API said, in customer words (CP-11), and a failure never
 *      shows a success. `toast-success` and `toast-error` are the two ids the specs read.
 *
 * TAB ORDER: tabs, then Add, then Search. The keyboard spec pins that order; it is the visual
 * order, and the DOM order is the visual order because nothing here reorders with CSS.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ListControls } from '../../components/ListControls';
import { TabRow } from '../../components/TabRow';
import { ToastHost, useToasts } from '../../components/ToastHost';
import { useListControls } from '../../hooks/useListControls';
import { classifyError, userMessageFor } from '../../lib/errors.taxonomy';
import { ItemForm } from './ItemForm';
import { itemStatus } from './types';
import * as api from './items.api';
import type { Item, ItemDraft } from './types';
import '../../components/components.css';

const TABS = [{ id: 'overview', label: 'Overview' }, { id: 'details', label: 'Details' }];
const LIST = { searchFields: ['name'] } as const;

export function ItemsScreen() {
  const [rows, setRows] = useState<readonly Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState<{ open: boolean; existing?: Item; draft?: ItemDraft }>({ open: false });
  const [archiving, setArchiving] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const toasts = useToasts();
  const list = useListControls(rows, LIST);

  // CP-34 / docs/28 §9: LOAD FAILED is not EMPTY. This used to read `catch { setRows([]) }`, and
  // the screen then said "No items yet - Add the first item" after a failed read: a statement
  // about the user's business that the system did not know. `failed` is its own state, with its
  // own words and a retry, and the empty state is reached only when the read SUCCEEDED.
  const [loadFailed, setLoadFailed] = useState(false);
  const reload = useCallback(async () => {
    try { setRows((await api.list()) ?? []); setLoadFailed(false); }
    catch { setLoadFailed(true); }
    finally { setLoaded(true); }   // the loader terminates, whatever happened (CP-3)
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  /** One place turns a caught error into words a customer may read. Never the raw message. */
  const failed = (err: unknown) => toasts.show({
    id: 'error',
    tone: 'error',
    message: userMessageFor(classifyError(err)) ?? 'Something went wrong. Please try again.',
  });

  /**
   * SAVE HANDS CONTROL BACK AT ONCE. The dialog closes on submit and focus returns to the
   * opener before the API has answered; the outcome arrives as a toast. On failure the dialog
   * comes BACK, carrying the draft, so nothing typed is lost and the error is read where it
   * happened.
   *
   * Why not hold the dialog open with Save disabled until the response? Disabling the focused
   * control parks focus on <body>, and for the whole round trip the keyboard user is nowhere.
   * The keyboard journey in tests/functional asserts focus is back on the opener the moment
   * Enter lands - that is the contract, and it is the better behaviour: the user's next action
   * is never blocked on a network they cannot see.
   */
  const save = async (draft: ItemDraft) => {
    const target = editing.existing;
    setEditing({ open: false });                       // close now; focus returns to the opener
    setBusy(true);
    try {
      if (target) await api.update(target, draft); else await api.create(draft);
      toasts.show({ id: 'success', tone: 'success', message: 'Saved.' });
      await reload();
    } catch (err) {
      failed(err);
      // Back with the draft, not an empty form: a failed save must never cost the user the
      // words they typed.
      setEditing({ open: true, ...(target ? { existing: target } : {}), draft });
    } finally { setBusy(false); }
  };

  const confirmArchive = async () => {
    if (!archiving) return;
    setBusy(true);
    try {
      await api.archive(archiving.id);
      setArchiving(null);
      toasts.show({ id: 'success', tone: 'success', message: `Archived ${archiving.name}.` });
      await reload();   // the round trip - the list is whatever the read now says it is
    } catch (err) { failed(err); }
    finally { setBusy(false); }
  };

  const visible = list.result.rows;

  return (
    <main className="items">
      <TabRow tabs={TABS} activeId={tab} onSelect={setTab} testId="tabs" />

      <div className="items__head">
        <h1 className="items__title">Items</h1>
        <button type="button" className="btn--primary" data-testid="list-add"
          onClick={() => setEditing({ open: true })}>
          Add item
        </button>
      </div>

      <ListControls
        state={list.state} matching={list.result.matching} total={list.result.total}
        onQuery={list.setQuery} onToggleFilter={list.toggleFilter} onDate={list.setDate}
        onSort={list.sortBy} onClear={list.clearAll} testId="list"
      />

      {loaded && loadFailed ? (
        // The read did not succeed. Say that, and offer the one action that can change it.
        // Never the empty state: "no items" is a claim about the data, and we have no data.
        <div className="items__empty" data-testid="list-failed" role="alert">
          <p>These items could not be loaded.</p>
          <button type="button" className="btn--primary" data-testid="list-failed-retry"
            onClick={() => { setLoaded(false); void reload(); }}>
            Try again
          </button>
        </div>
      ) : loaded && rows.length === 0 ? (
        <div className="items__empty" data-testid="list-empty">
          <p>No items yet.</p>
          {/* An empty state that only says "nothing here" leaves the user with no next step. */}
          <button type="button" className="btn--primary" data-testid="list-empty-action"
            onClick={() => setEditing({ open: true })}>
            Add the first item
          </button>
        </div>
      ) : (
        <ul className="items__list">
          {visible.map((it) => (
            <li key={it.id} className="items__row" data-testid={`item-row-${it.id}`}>
              <span className="items__name">{it.name}</span>
              {/* CP-32: the canonical value stays on the record and in the testid; what the user
                  reads is the declared label. */}
              <span className="items__status">{itemStatus.label(it.status)}</span>
              <button type="button" className="btn" data-testid={`item-edit-${it.id}`}
                onClick={() => setEditing({ open: true, existing: it })}>
                Edit
              </button>
              {/* The verb matches the model: this archives, so it says so (CP-26, CP-11). */}
              <button type="button" className="btn--danger" data-testid={`item-delete-${it.id}`}
                onClick={() => setArchiving(it)}>
                Archive
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="items__footer">
        <button type="button" className="btn" data-testid="list-footer-action"
          onClick={() => window.scrollTo({ top: 0 })}>
          Back to top
        </button>
      </div>

      {/* Keyed by mode + id so the form remounts with fresh state for each record it opens. */}
      {editing.open && (
        <ItemForm
          key={editing.existing?.id ?? 'new'}
          open
          {...(editing.existing ? { existing: editing.existing } : {})}
          {...(editing.draft ? { draft: editing.draft } : {})}
          busy={busy}
          onSave={(d) => { void save(d); }}
          onClose={() => setEditing({ open: false })}
        />
      )}

      <ConfirmDialog
        open={archiving !== null}
        title="Archive this item?"
        message={archiving ? `${archiving.name} will leave the list. Its name becomes available again.` : ''}
        confirmLabel="Archive item"
        tone="destructive"
        busy={busy}
        onConfirm={() => { void confirmArchive(); }}
        onCancel={() => setArchiving(null)}
        testId="confirm"
      />

      <ToastHost state={toasts.state} onUndo={toasts.undo} onDismiss={toasts.dismiss} testId="toast" />
    </main>
  );
}
