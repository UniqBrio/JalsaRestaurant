'use client';
/**
 * ItemForm - the one form for CREATE and EDIT, and the worked example of edit parity (CP-25).
 *
 * THREE THINGS AN EDIT FORM MUST DO THAT A CREATE FORM CANNOT BE TESTED FOR
 *   1. Arrive POPULATED. Every field carries the stored value; a multi-value control arrives
 *      with its values SELECTED. An empty edit form passes every "the form renders" assertion
 *      and reads to the user as "I had nothing set" - and their next save proves it.
 *   2. Say which mode it is in, and which record, by DATABASE id. Two rows can share a name.
 *   3. Never clear what it did not load. The submit sends the draft; the caller merges it over
 *      the whole existing record (items.api.ts), so a field this form never rendered
 *      (`schedule`) still round-trips.
 *
 * TAB ORDER IS PART OF THE CONTRACT
 *   In create mode the name field is followed DIRECTLY by Save. The keyboard-only journey is
 *   "open, type, Tab, Enter", and every control placed between the field and the button is a
 *   Tab the spec does not press. Status is not a decision on a new record - it is active - so
 *   the status group is rendered only when editing.
 */
import React, { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import type { Item, ItemDraft, ItemStatus } from './types';

const STATUSES: readonly ItemStatus[] = ['active', 'archived'];

export function ItemForm({
  open, existing, draft, busy, onSave, onClose,
}: {
  open: boolean;
  /** Present -> edit mode, populated from this record. Absent -> create mode. */
  existing?: Item;
  /** A draft to restore - the words the user typed before a save failed. Wins over `existing`. */
  draft?: ItemDraft;
  busy: boolean;
  onSave: (draft: ItemDraft) => void;
  onClose: () => void;
}) {
  const mode = existing ? 'edit' : 'create';
  const [name, setName] = useState(draft?.name ?? existing?.name ?? '');
  const [status, setStatus] = useState<ItemStatus>(draft?.status ?? existing?.status ?? 'active');
  const dirty = name !== (existing?.name ?? '') || status !== (existing?.status ?? 'active');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    onSave({ name: name.trim(), status });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit item' : 'New item'}
      hasUnsavedChanges={dirty}
      testId="item-form"
    >
      <form onSubmit={submit} className="dialog__body">
        <p className="field__mode">
          Mode: <span data-testid="item-form-mode">{mode}</span>
          {existing && <> · id <span data-testid="item-form-id">{existing.id}</span></>}
        </p>
        <label className="field">
          <span className="field__label">Name</span>
          <input
            className="field__input"
            data-testid="item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </label>
        {/* Save comes BEFORE any further control, in DOM order - see the header. */}
        <div className="dialog__footer">
          <button type="submit" className="btn--primary" data-testid="item-save" aria-busy={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn--quiet" data-testid="item-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
        {mode === 'edit' && (
          <fieldset className="field">
            <legend className="field__label">Status</legend>
            <div className="field__group">
              {STATUSES.map((s) => (
                <label key={s}>
                  <input
                    type="checkbox"
                    data-testid={`item-status-${s}`}
                    checked={status === s}
                    onChange={() => setStatus(s)}
                  />{' '}
                  {s}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </form>
    </Dialog>
  );
}
