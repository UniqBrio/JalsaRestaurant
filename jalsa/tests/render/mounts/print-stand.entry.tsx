/**
 * Mounts the REAL TableStandSheet (print-stand.render.spec.ts, 12-Oct-2026) as the owner sees it
 * from Settings: table A5, with a review link set. `window.print` is replaced by a recorder that
 * notes the theme the page was in at the moment of printing.
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { TableStandSheet } from '../../../src/features/owner/TableStandSheet';

declare global {
  interface Window {
    __printedIn: Array<string | null>;
  }
}
window.__printedIn = [];
window.print = () => {
  window.__printedIn.push(document.documentElement.getAttribute('data-theme'));
};

const host = document.createElement('div');
host.id = 'print-stand-host';
document.body.prepend(host);
createRoot(host).render(
  <TableStandSheet
    table="A5"
    onClose={() => undefined}
    qrOrigin="https://jalsa.example"
    restaurant={{}}
    settings={{ engagement: { reviewUrl: 'https://g.page/r/CVXvWzgULZeeEAE/review' } }}
  />
);
