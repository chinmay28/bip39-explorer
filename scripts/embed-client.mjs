#!/usr/bin/env node
/**
 * Copy the built client into the Go binary's embed directory.
 *
 * `go:embed` can only take files that exist inside the module at compile
 * time, so the PWA has to be staged there before `go build`. Doing it in the
 * build script rather than only in the quick-start means a plain
 * `npm run build` produces a binary that serves on its own, with no
 * --web-dist and no adjacent directory of assets.
 *
 * The staged copy is generated, and .gitignore keeps it out of the tree.
 */
import { cpSync, existsSync, mkdirSync, rmSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(repoRoot, 'apps/web/dist');
const target = join(repoRoot, 'server/cmd/bip39-explorer/webdist');

if (!existsSync(join(source, 'index.html'))) {
  throw new Error(`no build at ${source} — run "npm run build --workspace @bip39-explorer/web" first`);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });

// //go:embed fails on an empty directory, so the placeholder has to survive a
// checkout with no build in it.
writeFileSync(
  join(target, 'README.txt'),
  'Generated. `npm run build` copies apps/web/dist here so the Go binary can\n' +
    'embed the PWA. Kept out of git; this file exists so //go:embed still has\n' +
    'something to find in a fresh checkout.\n',
);

console.log(`staged ${readdirSync(target).length} entries into server/cmd/bip39-explorer/webdist`);
