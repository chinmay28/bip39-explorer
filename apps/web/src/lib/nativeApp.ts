/**
 * The Android app's hook into the page, when there is one.
 *
 * BIP-39 Explorer for Android shows this same page from inside the APK, and
 * gives it — before any of the page's own scripts run — a frozen
 * `window.bip39explorerApp` object (apps/android/app/src/main/assets/
 * bip39-bridge.js). That object is the only way the page can tell it is in the
 * app, and everything here is feature-detected on it: in a browser, from
 * `file://` or from the Go server it is absent and nothing changes.
 *
 * The bridge carries one message, "open the native About screen". It is
 * deliberately not a channel for words, input or anything else: there is
 * nothing on the page worth handing to the phone.
 */
export interface NativeApp {
  /** Open the app's own About screen (version, developer badge). */
  about(): void;
}

interface HostWindow {
  bip39explorerApp?: unknown;
}

export function nativeApp(host: HostWindow = window as unknown as HostWindow): NativeApp | null {
  const candidate = host.bip39explorerApp;
  if (typeof candidate !== 'object' || candidate === null) return null;
  const about = (candidate as { about?: unknown }).about;
  if (typeof about !== 'function') return null;
  return { about: () => (about as () => void).call(candidate) };
}
