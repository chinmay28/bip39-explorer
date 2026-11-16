# BIP-39 Explorer on Android

BIP-39 Explorer for Android is the explorer you know from the browser — Map,
Tree, Path, the letters-and-sound strip — as an app on your phone. It is the
same page, carried inside the app, and it never touches the network: the app
does not hold Android's network permission at all, so the system itself
refuses it any connection. There is no server to run and nothing to set up.

## Install the app

Every [release](https://github.com/chinmay28/bip39-explorer/releases) attaches
it as `bip39-explorer.apk`, and the latest is always at:

```
https://github.com/chinmay28/bip39-explorer/releases/latest/download/bip39-explorer.apk
```

Open that address on the phone, download the APK, and open it. Android asks
once to let your browser install apps; allow it. A newer release installs over
the old one. The release lists the APK's SHA-256 in `SHA256SUMS` if you want to
check what you downloaded.

It needs Android 10 or newer.

## Using it

Open the app and you are in the explorer, on *bird*, in Tree (on a phone the
map wants more width than a column gives it; the tab bar at the bottom switches
views). Everything works as it does in a browser, with the network off — there
is no network to turn off.

What the app does differently from the page in a browser:

- **Dark mode follows the phone.** Switch the system theme and the explorer
  switches with it, using its own dark palette (the page is never machine-
  darkened). Switching reloads the page, so you land back on *bird*.
- **Text size follows the phone.** *Settings → Display → Font size* grows the
  explorer's words as it grows everything else, while the app is open.
- **Your keyboard is asked not to learn.** Every word you type here is a
  BIP-39 word, and keyboards that learn often sync what they learn. The app
  asks the keyboard for incognito typing and no suggestions in every field
  (Gboard and most others honour it; Gboard shows its incognito icon).
- **Links leave the app.** The explorer has none today; if one appears, it
  opens in your browser, never inside the app.

## About

Long-press the app's icon and tap **About**, or tap the ⓘ button in the
explorer's header (it only appears inside the app). The About screen shows the
version (`vYEAR.MONTH.BUILD`, the same string the page shows under its name),
what the app does and does not do, a link to the source, and the developer
badge: tap it for the full badge, thrown up over the screen for three seconds
(tap again or press Back to end it early).

## Safety

There is nowhere in the explorer to type a seed phrase — the bits view stops
at a single word — and there never will be. The app takes no shared text, has
no share target, and no field that accepts a pasted phrase. **Never type a real
seed phrase into anything.**

Screenshots are allowed on purpose: everything on screen is the public BIP-39
list and what its words mean, and there is nothing to hide from the recent-apps
view either.

## Building it yourself

```bash
npm install && npm run build:web          # the page the app carries
cd apps/android && ./gradlew :app:assembleRelease
```

or let Gradle build the page first with `-PbuildWeb=true`. How the app is put
together, and why, is in [`apps/android/README.md`](../apps/android/README.md).
