/**
 * layout - resolve default paths in BOTH layouts these scripts ship in.
 *
 * The same scripts travel in two worlds: the framework repository, where the application
 * lives under starter/, and a scaffolded app, where the starter IS the repository root
 * (new-app.mjs copies scripts/ in and rewrites package.json for exactly that shift).
 * A default hard-coded to one layout makes every gate fail in the other - which is how a
 * scaffolded app's very first `npm run gate` dies on paths that no longer exist.
 *
 * The anchor is starter/design/tokens.json: present -> framework repo; absent -> app root.
 */
import fs from 'node:fs';
import path from 'node:path';

export function appPath(root, rel) {
  return fs.existsSync(path.join(root, 'starter', 'design', 'tokens.json'))
    ? `starter/${rel}`
    : rel;
}
