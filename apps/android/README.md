# BIP-39 Explorer for Android

The explorer's own page in a web view, served from inside the APK. No server,
no localhost port, no network permission. Using it is in the
[guide](../../docs/android.md); this page is how it is put together and why.

```
 ┌──────────────────────── the phone ─────────────────────────┐
 │  MainActivity                                               │
 │   PrivateKeyboardWebView  (blockNetworkLoads, no file://)   │
 │     │ https://appassets.androidplatform.net/                │
 │     ▼                                                       │
 │   PageServer ── WebViewAssetLoader "/" ── assets/web/index.html
 │     │            (one page; any other path 404, any other    │
 │     │             origin 403, CSP connect-src 'none')        │
 │     │                                                       │
 │   bip39-bridge.js ⇄ Bip39Android ── about() ── AboutActivity │
 └─────────────────────────────────────────────────────────────┘
          no INTERNET permission: no sockets at all
```

## Embedded, not a server

The explorer has no server logic — the Go binary only serves static files —
so the phone needs none of it. The app carries the single-file build
(`dist/bip39-explorer.html`, made by `npm run build:web`), which already has
its script, styles, icons and the whole semantic index inline, and answers
the web view's requests itself through `androidx.webkit.WebViewAssetLoader` on
`https://appassets.androidplatform.net/`. That origin is a stable https one, so
the page gets a secure context and the same storage on every launch, without
`file://` access, and without a service worker (the single-file build strips
its registration).

The Gradle task `bundleWebPage` copies the page into the APK's assets as
`web/index.html` and fails the build loudly when it is missing (or still
references a file outside itself). `-PbuildWeb=true` runs `npm run build:web`
first.

## No network, enforced three times

1. **No permission.** The manifest requests nothing and removes `INTERNET`
   and `ACCESS_NETWORK_STATE` should a library ever ask. Without `INTERNET`,
   Android gives the process no sockets. `check<Variant>Permissions` reads the
   *merged* manifest and fails `assemble`, `lint` and `check` if it requests
   anything beyond AndroidX's own `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`;
   CI checks the built APK again with `aapt2 dump permissions`.
2. **The web view.** `blockNetworkLoads`, no file or content access, no
   multiple windows; `PageServer` answers *every* request — the one page, a
   404 for any other path, a 403 for any other origin — so nothing reaches the
   network stack. Safe Browsing and WebView metrics are off: the page is the
   app's own.
3. **The page.** It is served with a Content-Security-Policy of
   `default-src 'none'; connect-src 'none'; …` (`core/PageAssets`), the same
   promise the Go server makes, adjusted for inline scripts. A regression fails
   in the page's console as it would in a browser.

## Navigation

`core/NavigationPolicy` decides every navigation: the app's origin stays;
`http(s)` anywhere else goes to the phone's browser through an `ACTION_VIEW`
the person sees; every other scheme (`intent:`, `javascript:`, `file:`,
`content:`, `data:`, `mailto:`…) is refused. The page has no links out today.

## Native where it pays

- **Dark mode.** The theme is Material3 DayNight. A web view takes
  `prefers-color-scheme` from its activity's theme, so this is what lets the
  page use its own dark tokens; algorithmic darkening is turned off so it is
  never repainted on top. `uiMode` is not a handled config change: switching
  theme recreates the activity, and the web view reads the new one.
- **Text size.** `core/TextZoom` maps the system font scale to the web view's
  text zoom (clamped to 50–300 %), on creation and live when the scale changes.
- **Keyboard privacy.** `PrivateKeyboardWebView` adds
  `IME_FLAG_NO_PERSONALIZED_LEARNING` and, on text fields,
  `TYPE_TEXT_FLAG_NO_SUGGESTIONS` to every input connection
  (`core/KeyboardPrivacy`). Every word typed into the explorer is a BIP-39
  word, and a learning keyboard that syncs its dictionary is the one place a
  seed could leak from this app. Autofill is off for the web view.
- **About screen and the developer badge.** `AboutActivity`: version from
  `BuildConfig`, the badge in a 44dp target, and the full-screen flash done
  natively (`DevFlash`, on `core/DevFlashTimeline`, a port of the page's CSS
  keyframes and cubic-béziers, with the screen behind blurred on Android 12+).
  With animations off in system settings the badge is shown still.

Deliberately **not** built: a share target, any field that takes pasted text,
a settings screen (there is nothing to set), downloads (the page offers none).
And **no `FLAG_SECURE`**: the screen only ever shows the public wordlist and a
graph of what its words mean, with nowhere to type a phrase. Blocking
screenshots would protect nothing, would get in the way of sharing what the
explorer shows, and would imply a secret the design ensures is never there.

## The page bridge

`assets/bip39-bridge.js` is added at document start, before the page's own
scripts, and the `Bip39Android` message object it posts to is injected — both
for the app's origin alone (`addDocumentStartJavaScript`,
`addWebMessageListener`). It defines a frozen `window.bip39explorerApp` with
one method, `about()`; `core/Bridge` accepts that one message, from the top
frame of the app's origin, and nothing else. The page feature-detects it
(`apps/web/src/lib/nativeApp.ts`) to show its ⓘ button; in a browser there is
none. Both sides are tested together in
`apps/web/src/lib/nativeApp.bridge.test.ts`, against the real script.

## The icon

Every launcher icon is derived from the web app's `apps/web/public/icon-512.png`
(a full-bleed square: the teal plate and three bars) by
`server/cmd/bip39-icons` (`npm run icons`), and `go test ./cmd/bip39-icons`
fails if a committed copy has drifted, or if any `@drawable/`/`@mipmap/`
reference names a missing file. Never edit a derived file by hand.

| File | Shape |
|---|---|
| `mipmap-*/ic_launcher.png` | 48dp, corners rounded at 7/32 of the width (the favicon's `rx`), on transparency |
| `mipmap-*/ic_launcher_foreground.png`, `mipmap-anydpi/ic_launcher.xml`, `values/ic_launcher_background.xml` | adaptive: the artwork filling the 72dp a launcher shows, over its own plate colour |
| `mipmap-*/ic_launcher_monochrome.png` | the bars alone, for Android 13 themed icons |
| `drawable-nodpi/bip_logo.png` | the mark on the About screen |
| `drawable-nodpi/dev_badge*.png` | copied verbatim from `apps/web/src/assets/` |

The app posts no notifications, so it has no status-bar icon.

## Code layout

```
apps/android/
├── core/   plain Kotlin, JVM-tested, no Android:
│           AppOrigin, PageAssets, NavigationPolicy, TextZoom,
│           KeyboardPrivacy, Bridge, DevFlashTimeline
└── app/    the Android shell: MainActivity, PageServer,
            PrivateKeyboardWebView, PageBridge + assets/bip39-bridge.js,
            AboutActivity, DevFlash
```

```bash
./gradlew -PcoreOnly :core:test                     # no Android SDK needed
./gradlew :core:test :app:lintDebug :app:assembleRelease
```

The version is `-PappVersionName` (the release's `vYEAR.MONTH.PATCH`) and
`-PappVersionCode` (the commit count, which only grows); a local build is
`dev`, code 1. The release build is signed with the debug key so it sideloads
as it stands.
