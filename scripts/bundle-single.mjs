#!/usr/bin/env node
/**
 * Fold the built client into one HTML file.
 *
 * The app has no server-side anything, so it can be a single document: paste
 * it on a USB stick, mail it, open it from a `file://` URL on a machine with
 * no network at all. That is a real property worth keeping, not a demo trick
 * — the whole point of precomputing the semantic index was that nothing has
 * to be fetched at runtime.
 *
 * Hand-rolled rather than vite-plugin-singlefile: it is thirty lines, it
 * avoids a build dependency that would have to be audited, and it fails
 * loudly if the build output ever stops looking the way it expects.
 *
 *   node scripts/bundle-single.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(repoRoot, 'apps/web/dist');
const output = join(repoRoot, 'dist/bip39-explorer.html');

if (!existsSync(join(dist, 'index.html'))) {
  throw new Error(`no build at ${dist} — run "npm run build --workspace @bip39-explorer/web" first`);
}

let html = readFileSync(join(dist, 'index.html'), 'utf8');
const inlined = [];

// Replacement strings go through a function so that `$&`, `$1` and friends in
// the bundle — and there are plenty inside the regexes this app ships — are
// not treated as substitution patterns.
const swap = (pattern, replace) => {
  html = html.replace(pattern, (...args) => replace(...args));
};

// A service worker cannot register from a file:// URL, and this build has
// nothing to cache anyway — every byte is already in the page. Strip these
// *before* inlining, or the registration script gets folded in as an ordinary
// module and then tries to fetch an sw.js that is not there.
swap(/<script[^>]*\sid="vite-plugin-pwa:register-sw"[^>]*><\/script>/g, () => '');
swap(/<link[^>]*\srel="manifest"[^>]*>/g, () => '');

swap(/<script[^>]*\ssrc="([^"]+)"[^>]*><\/script>/g, (_match, src) => {
  const file = join(dist, src.replace(/^\.?\//, ''));
  inlined.push(src);
  return `<script type="module">\n${readFileSync(file, 'utf8')}\n</script>`;
});

swap(/<link[^>]*\srel="stylesheet"[^>]*\shref="([^"]+)"[^>]*>/g, (_match, href) => {
  const file = join(dist, href.replace(/^\.?\//, ''));
  inlined.push(href);
  return `<style>\n${readFileSync(file, 'utf8')}\n</style>`;
});

// The favicon is a few hundred bytes of SVG; inlining it keeps the file from
// showing a broken icon when opened from disk.
swap(/<link[^>]*\srel="icon"[^>]*\shref="([^"]+)"[^>]*>/g, (match, href) => {
  const file = join(dist, href.replace(/^\.?\//, ''));
  if (!existsSync(file)) return match;
  const data = readFileSync(file).toString('base64');
  inlined.push(href);
  return `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${data}">`;
});

if (inlined.length === 0) {
  throw new Error('inlined nothing — the build output does not look the way this script expects');
}
if (/<(script|link)[^>]*\s(src|href)="(?!data:)/.test(html)) {
  throw new Error('something is still referenced externally; the bundle would not work offline');
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`wrote dist/bip39-explorer.html — ${kb} KB, inlined ${inlined.join(', ')}`);
