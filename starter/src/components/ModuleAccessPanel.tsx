'use client';
/**
 * ModuleAccessPanel - grant another member limited access: a role preset as the starting
 * point, then per-capability custom selection. The RBAC editor as a reusable component.
 *
 * WHAT THE HOST APP COMPOSES AROUND THIS
 *   Render it inside Dialog.tsx (focus trap, no backdrop dismiss, focus return come free).
 *   The login-lifecycle actions that usually sit beside it - enable/disable login, reset
 *   credential - are three ordinary buttons in the host's dialog: destructive ones isolated
 *   per docs/04 §5, confirmations per the dialog rules. They carry no logic worth a component.
 *
 * THE RULES THIS ENCODES (each is a line in module-access.ts, tested there)
 *   1. Deny-by-default: everything is off until granted - and the panel SAYS so.
 *   2. A preset is a starting point, applied then edited - reset-to-role, never a merge.
 *   3. Confidential capabilities are marked with a WORD, never a colour.
 *   4. The save button is honest: "No changes" / "Save N changes" - never silently disabled.
 *   5. Counts are text on collapsed section headers - the shape of access is visible
 *      without opening anything (same reasoning as ColumnControl's trigger count).
 *
 * KEYBOARD (CP-22): every control is a native button element; sections toggle with
 * Enter/Space, grants are role="switch" buttons, Tab order follows the visual order.
 */
import React, { useState } from 'react';
import {
  type Grants, type Presets, type SectionDef,
  applyPreset, changedCount, sectionCount, toggleGrant,
} from '../lib/module-access';

export function ModuleAccessPanel({
  memberName,
  role,
  sections,
  presets,
  savedGrants,
  onSave,
  testId = 'module-access',
}: {
  memberName: string;
  /** The member's role label; also the preset key offered by the apply button. */
  role: string;
  sections: SectionDef[];
  presets: Presets;
  savedGrants: Grants;
  onSave: (grants: Grants) => void;
  testId?: string;
}) {
  const [grants, setGrants] = useState<Grants>(savedGrants);
  const [openSections, setOpenSections] = useState<ReadonlySet<string>>(new Set());
  const changes = changedCount(savedGrants, grants);

  const toggleSection = (id: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="module-access" data-testid={testId}>
      <div className="module-access__subject">
        <span className="module-access__name">{memberName}</span>
        <span className="module-access__role">{role}</span>
        {presets[role] && (
          <button
            type="button"
            className="module-access__preset"
            data-testid={`${testId}-preset`}
            onClick={() => setGrants(applyPreset(presets, role))}
          >
            Apply {role} preset
          </button>
        )}
      </div>

      {/* The model, stated where the decision is made - not in a manual. */}
      <p className="module-access__hint">
        Everything is off until you grant it. Confidential fields are marked.
      </p>

      <ul className="module-access__sections">
        {sections.map((section) => {
          const { granted, total } = sectionCount(section, grants);
          const open = openSections.has(section.id);
          return (
            <li key={section.id} className="module-access__section">
              <button
                type="button"
                className="module-access__section-toggle"
                aria-expanded={open}
                data-testid={`${testId}-section-${section.id}`}
                onClick={() => toggleSection(section.id)}
              >
                <span>{section.label}</span>
                {section.comingSoon
                  ? <span className="module-access__soon">Coming soon</span>
                  : <span className="module-access__count">{granted}/{total}</span>}
              </button>

              {open && !section.comingSoon && (
                <ul className="module-access__caps">
                  {section.capabilities.map((cap) => {
                    const on = grants.has(cap.id);
                    return (
                      <li key={cap.id} className="module-access__cap">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          className="module-access__grant"
                          data-testid={`${testId}-cap-${cap.id}`}
                          onClick={() => setGrants((g) => toggleGrant(g, cap.id))}
                        >
                          <span>{cap.label}</span>
                          {/* A word, not a colour: readable to everyone, in every theme. */}
                          {cap.confidential && (
                            <span className="module-access__confidential">Confidential</span>
                          )}
                          <span className="module-access__state">{on ? 'On' : 'Off'}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="module-access__save"
        aria-disabled={changes === 0}
        data-testid={`${testId}-save`}
        onClick={() => { if (changes > 0) onSave(grants); }}
      >
        {changes === 0 ? 'No changes' : `Save ${changes} change${changes === 1 ? '' : 's'}`}
      </button>
    </div>
  );
}
