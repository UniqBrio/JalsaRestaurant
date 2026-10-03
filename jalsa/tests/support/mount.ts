/**
 * mount - bundle a small TSX entry that renders REAL application components, for a render spec
 * to inject into a page that already carries the application's stylesheet (03-Oct-2026).
 *
 * The render tier measures real components in a real browser. Most of its specs copy a
 * component's classes onto a probe; that measures layout but not behaviour. For a component
 * whose behaviour is the point - a keyboard-driven list, a game's scoring - the component itself
 * is bundled (React included) and mounted, and the spec drives it with real key presses and taps.
 * Nothing is mocked: the entry imports the component from `src/` exactly as the app does.
 */
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '../..');

/** The entry, bundled for the browser as one IIFE script. */
export async function bundleForBrowser(entry: string): Promise<string> {
  const out = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    jsx: 'automatic',
    tsconfig: join(APP, 'tsconfig.json'),
    define: { 'process.env.NODE_ENV': '"development"' },
    logLevel: 'silent',
  });
  return out.outputFiles[0]!.text;
}
