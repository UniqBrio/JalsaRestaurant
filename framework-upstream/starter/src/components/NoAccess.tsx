/**
 * CP-6 — permission denial is an HONEST state.
 *
 * THE BUG THIS PREVENTS
 *   Rendering an empty list when a query was refused tells the user there is nothing here.
 *   They then act on that: they re-create a record that already exists, or they report data
 *   loss. An empty state and a denial look identical and mean opposite things.
 *
 * TWO RULES
 *   1. Never re-authenticate on a denial. A refresh cannot grant a permission, so the only
 *      possible outcome is a refresh loop against a policy that will keep saying no.
 *   2. Say who can help. "Access denied" ends the conversation; "ask an administrator to
 *      enable X" continues it.
 */
import React from 'react';

export function NoAccess({
  what = 'this',
  whoCanHelp = 'an administrator',
  testId = 'no-access',
}: { what?: string; whoCanHelp?: string; testId?: string }) {
  return (
    <div className="no-access" role="status" data-testid={testId}>
      <p className="no-access__title">You do not have permission to view {what}.</p>
      <p className="no-access__detail">
        If you need access, ask {whoCanHelp} to enable it for your role.
      </p>
      {/* Deliberately no "Retry" and no "Sign in again". Neither can change the answer, and
          offering them sends the user round a loop that always ends here. */}
    </div>
  );
}
