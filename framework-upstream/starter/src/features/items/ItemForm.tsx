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
import { SearchableSelect } from '../../components/SearchableSelect';
import type { Option } from '../../lib/select-options';
import { itemStatus } from './types';
import type { Item, ItemDraft, ItemStatus } from './types';

export function ItemForm({
  open, existing, draft, busy, onSave, onClose, categories = [], onCreateCategory,
}: {
  open: boolean;
  /** Present -> edit mode, populated from this record. Absent -> create mode. */
  existing?: Item;
  /** A draft to restore - the words the user typed before a save failed. Wins over `existing`. */
  draft?: ItemDraft;
  busy: boolean;
  onSave: (draft: ItemDraft) => void;
  onClose: () => void;
  /** The category set this app already knows. Supplied by the screen; the form does not fetch. */
  categories?: readonly Option[];
  /** Persist a newly added category to the app's own store - see SearchableSelect's note. */
  onCreateCategory?: (label: string) => Option | Promise<Option>;
}) {
  const mode = existing ? 'edit' : 'create';
  const [name, setName] = useState(draft?.name ?? existing?.name ?? '');
  const [status, setStatus] = useState<ItemStatus>(draft?.status ?? existing?.status ?? 'active');
  const [categoryId, setCategoryId] = useState<string | null>(
    draft?.categoryId ?? existing?.categoryId ?? null,
  );
  const dirty = name !== (existing?.name ?? '')
    || status !== (existing?.status ?? 'active')
    || categoryId !== (existing?.categoryId ?? null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    onSave({ name: name.trim(), status, categoryId });
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
        {/* DR-5's worked example, and rendered in EDIT mode only for the reason the header
            gives: in create mode the name field is followed DIRECTLY by Save, and a control
            between them is a Tab the keyboard journey does not press. A category is not a
            decision on a new record, exactly as status is not. */}
        {/* DR-8: these two edit-only controls share a row while the space allows it and stack
            when it does not - decided by `.form-grid` from the available width, not by a device
            breakpoint. Create mode is untouched: there, Name is followed DIRECTLY by Save, and
            that tab order is a contract this layout must not quietly lengthen. */}
        {mode === 'edit' && (
          <div className="form-grid">
          <SearchableSelect
            label="Category"
            testId="item-category"
            options={categories}
            value={categoryId}
            onChange={(o) => setCategoryId(o?.id ?? null)}
            onCreateOption={onCreateCategory}
            placeholder="Search or add a category…"
            {...(onCreateCategory ? {} : { storageKey: 'reference.categories' })}
          />
          <fieldset className="field">
            <legend className="field__label">Status</legend>
            <div className="field__group">
              {/* CP-32: `value` is canonical and drives the testid, the check and the state;
                  `label` is the only thing rendered. They are deliberately not one string. */}
              {itemStatus.options().map(({ value, label }) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    data-testid={`item-status-${value}`}
                    checked={status === value}
                    onChange={() => setStatus(value)}
                  />{' '}
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          </div>
        )}
      </form>
    </Dialog>
  );
}
