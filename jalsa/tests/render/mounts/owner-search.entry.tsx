/** Mounts the REAL OwnerSearch over the screens the spec hands in (owner-search.render.spec.ts). */
import { createRoot } from 'react-dom/client';
import { OwnerSearch } from '../../../src/features/owner/OwnerSearch';
import { buildNavEntries, type NavSources } from '../../../src/lib/owner-search';

declare global {
  interface Window {
    __navSources: NavSources;
    __grants: string[];
    __opened: string[];
  }
}

window.__opened = [];
const host = document.createElement('div');
host.id = 'search-host';
host.style.cssText = 'padding:16px;box-sizing:border-box;width:100%';
document.body.prepend(host);
createRoot(host).render(
  <OwnerSearch
    entries={buildNavEntries(window.__navSources)}
    grants={window.__grants}
    onOpen={(e) => window.__opened.push(e.id)}
  />
);
