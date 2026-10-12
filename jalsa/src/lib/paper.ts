/**
 * paper - the one way this app prints a panel (12-Oct-2026).
 *
 * WHY NOT A BARE `window.print()`
 *   The screen may be in the dark theme; paper is not. Printed as it is on screen, a dark panel
 *   comes out as near-white text on white paper whenever the browser's "Background graphics" is
 *   off, which is its default: the table stand printed that way from a dark console. So the page
 *   is put in the light theme for the print and given back its own theme afterwards.
 *
 * WHY THE THEME COMES BACK ON `afterprint`, NOT AFTER THE CALL
 *   Desktop browsers hold `window.print()` until the print dialog closes (and fire `afterprint`
 *   before it returns); some phones return at once and print later. Restoring straight after the
 *   call would hand those phones the dark page again, so the restore waits for the browser to say
 *   the print is over.
 *
 * A theme left on light by an interrupted print is a page that looks lighter until the next
 * print or reload, never one that has lost anything - the reason this is safe as page state when
 * the print stylesheet itself deliberately avoids JavaScript state (globals.css).
 */
export function printOnPaper(): void {
  const root = document.documentElement;
  const own = root.getAttribute('data-theme');
  const restore = (): void => {
    if (own === null) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', own);
  };
  window.addEventListener('afterprint', restore, { once: true });
  root.setAttribute('data-theme', 'light');
  window.print();
}
