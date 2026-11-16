# Changelog

Releases are `vYEAR.MONTH.PATCH` — a calendar version, where YEAR.MONTH is the
month of the release's commit and the patch number is the repository's commit
count, so `v2026.11.42` is the 42nd commit, made in November 2026. See
[`server/internal/version/version.go`](./server/internal/version/version.go).

Each section below is the body of the corresponding GitHub release. A heading
must name the version exactly: the release workflow publishes a commit only
when this file has a `## <its version>` section, refuses a tag whose commit
builds a different version, and skips a push to `main` that names none. Work
not yet released sits under `## Unreleased`, which never matches a version;
rename it to the version when cutting the release.

## Unreleased

**Downloads:** `bip39-explorer-<version>-linux-arm64` and `-linux-amd64` (the
server, with the explorer embedded), `bip39-explorer.html` (the whole explorer
in one file, for a USB stick or a machine with no network) and, new,
**`bip39-explorer.apk`** — BIP-39 Explorer for Android. On the phone, open
`https://github.com/chinmay28/bip39-explorer/releases/latest/download/bip39-explorer.apk`
and install it; a newer release installs over it. All are in `SHA256SUMS`.

### BIP-39 Explorer for Android

The explorer as an app: Map, Tree, Path and the letters-and-sound strip, the
same page as in a browser, carried inside the app. It has **no network
permission at all** — Android itself refuses it any connection — and no server
to run or set up. See [`docs/android.md`](./docs/android.md).

- Dark mode and text size follow the phone's settings.
- The keyboard is asked not to learn the words you type into the explorer
  (incognito typing, no suggestions): every one of them is a BIP-39 word.
- An About screen — long-press the icon, or the ⓘ in the explorer's header
  inside the app — shows the version and the developer badge.
- Still nowhere to type a seed phrase, no share target, nothing that takes
  pasted text.

### The developer badge in the explorer

The header now carries the developer's mark, as SandHarbor and CountRoster do:
tap it and the full badge fills the screen for three seconds. It is inlined in
the page, so the single-file build carries it too and nothing is fetched.

### Versions come from the commit

The version's year and month are now the month of the commit being built, so
there is nothing to bump when a month turns; the patch is still the commit
count. The server binary, the page and the APK of one commit report the same
version.
