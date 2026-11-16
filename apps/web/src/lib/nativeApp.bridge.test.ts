import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { nativeApp } from './nativeApp';

/**
 * The page side of the Android app's bridge, against the real script the app
 * injects (apps/android/app/src/main/assets/bip39-bridge.js), with the native
 * side played by a fake `Bip39Android` port.
 */
const script = readFileSync(
  // __dirname rather than import.meta.url: under jsdom the latter is not a file URL.
  resolve(__dirname, '../../../android/app/src/main/assets/bip39-bridge.js'),
  'utf8',
);

function inject(host: Record<string, unknown>) {
  host.window = host;
  runInNewContext(script, host);
  return host;
}

describe('the Android bridge script', () => {
  it('gives the page an app whose About posts one message', () => {
    const posted: unknown[] = [];
    const host = inject({ Bip39Android: { postMessage: (m: unknown) => posted.push(m) } });
    const app = nativeApp(host);
    expect(app).not.toBeNull();
    app?.about();
    expect(posted).toEqual(['about']);
  });

  it('cannot be replaced by the page afterwards', () => {
    const host = inject({ Bip39Android: { postMessage: () => {} } });
    const first = host.bip39explorerApp;
    expect(() => runInNewContext('"use strict"; window.bip39explorerApp = {}', host)).toThrow();
    expect(host.bip39explorerApp).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it('defines nothing without the native port', () => {
    expect(nativeApp(inject({}))).toBeNull();
  });
});
