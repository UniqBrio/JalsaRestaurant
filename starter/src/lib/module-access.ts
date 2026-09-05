/**
 * module-access - the PURE logic behind a role-preset + per-capability grant editor.
 *
 * THE MODEL (deny-by-default, on purpose)
 *   A grant set starts EMPTY: everything is off until someone grants it. The dangerous
 *   default in access tooling is allow-by-omission - a capability added to the app next
 *   month must arrive OFF for every existing member, which only works if absence means no.
 *
 * PRESET vs CUSTOM
 *   A role preset is a STARTING POINT the owner applies and then edits - never a mode the
 *   member is locked into. Applying a preset REPLACES the working set (it is a "reset to
 *   role", not a merge): merging would silently keep grants the preset never included, and
 *   an access reviewer reading "Manager preset" would be wrong about what the member has.
 *
 * WHY THIS FILE HAS NO REACT IN IT
 *   Everything with branches lives here, exported and unit-testable without a browser.
 *   The component (ModuleAccessPanel.tsx) renders state; it never computes it.
 */

export interface CapabilityDef {
  id: string;
  label: string;
  /** Marked visibly in the UI (a word, never a colour): grants access to sensitive fields. */
  confidential?: boolean;
}

export interface SectionDef {
  id: string;
  label: string;
  capabilities: CapabilityDef[];
  /** Rendered, visible, not grantable yet - an announced section users can see coming. */
  comingSoon?: boolean;
}

/** Capability ids currently granted. Absence = denied. */
export type Grants = ReadonlySet<string>;

/** A named role preset: the capability ids that role starts with. */
export type Presets = Readonly<Record<string, readonly string[]>>;

export const emptyGrants = (): Grants => new Set();

/** Replace the working set with the preset (reset-to-role, never a merge - see header). */
export function applyPreset(presets: Presets, role: string): Grants {
  return new Set(presets[role] ?? []);
}

export function toggleGrant(grants: Grants, capabilityId: string): Grants {
  const next = new Set(grants);
  next.has(capabilityId) ? next.delete(capabilityId) : next.add(capabilityId);
  return next;
}

/** "9/16" per section - the count is text on the section header, readable while collapsed. */
export function sectionCount(section: SectionDef, grants: Grants): { granted: number; total: number } {
  const total = section.capabilities.length;
  const granted = section.capabilities.filter((c) => grants.has(c.id)).length;
  return { granted, total };
}

/**
 * How many capabilities differ from the saved state - drives the save button's HONEST label:
 * "No changes" at 0, "Save N changes" otherwise. A silently disabled save button leaves the
 * user unable to tell whether it is broken or they are (screen checklist item 2).
 */
export function changedCount(saved: Grants, working: Grants): number {
  let n = 0;
  for (const id of working) if (!saved.has(id)) n++;
  for (const id of saved) if (!working.has(id)) n++;
  return n;
}
