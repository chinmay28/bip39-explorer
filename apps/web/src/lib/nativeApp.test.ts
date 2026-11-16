import { describe, expect, it, vi } from 'vitest';
import { nativeApp } from './nativeApp';

describe('nativeApp', () => {
  it('is absent in a plain browser', () => {
    expect(nativeApp({})).toBeNull();
  });

  it('ignores anything that is not the bridge the app installs', () => {
    expect(nativeApp({ bip39explorerApp: null })).toBeNull();
    expect(nativeApp({ bip39explorerApp: 'yes' })).toBeNull();
    expect(nativeApp({ bip39explorerApp: { about: 'not a function' } })).toBeNull();
  });

  it('calls the bridge on its own object', () => {
    const bridge = { about: vi.fn(function (this: unknown) { return this; }) };
    nativeApp({ bip39explorerApp: bridge })?.about();
    expect(bridge.about).toHaveBeenCalledTimes(1);
    expect(bridge.about.mock.results[0]?.value).toBe(bridge);
  });
});
