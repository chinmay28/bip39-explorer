# CLAUDE.md

Guidance for working in this repository.

## What this is

An offline explorer for the 2048-word BIP-39 English list. A **client-server
app with no server logic**: the Go binary serves static files, and the client
carries the whole dataset.

- `apps/web` (`@bip39-explorer/web`) — the PWA (Vite + React + TypeScript).
  All the behaviour lives here.
- `server/` — a static Go binary with the PWA embedded. No database, no API,
  no state.
- `tools/` — the Python pipeline that generates `data/semantic-index.json`.
  Run offline, output committed.
- `data/` — the wordlist and the generated index.
- `apps/android` — BIP-39 Explorer for Android: the single-file page
  (`dist/bip39-explorer.html`) packaged in the APK and served to a web view by
  WebViewAssetLoader. `:core` (plain Kotlin, JVM-tested) decides, `:app` is
  glue. See `apps/android/README.md`.

## Commands

```bash
npm install
npm test           # vitest (engine + app) · tools/check_index.py · go test ./...
npm run typecheck  # tsc --noEmit + go vet
npm run build      # client → single-file bundle → embed → Go binary
npm run dev        # http://localhost:5173
npm run icons      # regenerate the Android icons from apps/web/public/icon-512.png
```

Android (JDK 17+, Android SDK; build the page first with `npm run build:web`,
or pass `-PbuildWeb=true`):

```bash
cd apps/android && ./gradlew :core:test :app:lintDebug :app:assembleRelease
```

Single test file: `npx vitest run src/lib/graph.test.ts` inside `apps/web`.
Single Go package: `go test ./internal/httpserve` inside `server`.

No linter or formatter beyond `gofmt`/`go vet` and TypeScript strict mode.

## The rule that shapes everything

**The app makes no network requests.** Not to an API, not to a CDN, not for
fonts. The semantic index is imported into the bundle rather than fetched so
the app works from `file://` and from an installed PWA with the network off,
and the server sends `connect-src 'none'` so a regression fails loudly in the
browser rather than quietly in review.

If a change would introduce a fetch, it is the wrong change.

The Android app makes the same rule a system one: **it holds no permissions,
INTERNET above all**. `check<Variant>Permissions` fails the Gradle build if
the merged manifest requests anything, and CI checks the APK again. Don't add
a permission, a share target, or anything that accepts pasted text.

## Two kinds of knowing, kept apart

- **Meaning** comes from the committed graph — expensive, external, generated
  by `tools/`, and shown in the coloured map.
- **Spelling and sound** are computed live in `apps/web/src/lib/letters.ts` —
  a pass over 2048 short strings is sub-millisecond, so precomputing them
  would only add download weight and a second place for the rules to live.

The UI keeps them visually separate on purpose. Don't merge them.

## The engine is pure

`apps/web/src/lib/graph.ts` and `letters.ts` take their data as arguments and
return values. That is what lets `graph.test.ts` exercise the traversal rules
against a ten-word fixture you can reason about by hand, instead of the real
28,000-edge index. Keep new logic there rather than in components.

## Regenerating the index

`tools/README.md` has the corpus downloads (~1 GB, not committed). The build
is deterministic, so the same three source files always produce the same
output. **Always run `python3 tools/check_index.py` afterwards** — it caught a
topic size/members mismatch that nothing else would have.

The judgement calls in `tools/bip39_semantics/*.py` are documented in the
module docstrings, and several were arrived at by watching the output get
worse. Read them before changing a weight.

## Versioning

`vYEAR.MONTH.<git commit count>` — a calendar version, matching SandHarbor's.
YEAR.MONTH is the month of HEAD's **committer date, in the committer's own
timezone** (`git log -1 --format=%cI`, first seven characters); the patch is
`git rev-list --count HEAD`. There are no constants to bump: the line moves by
itself with the first commit of a new month, and it is never the build clock,
so a rebuild of an old commit still names what it shipped as. The month is
unpadded (semver forbids a leading zero).

`scripts/version.mjs` is the one place it is assembled: `--patch`, `--date`
and `--ldflags` (the `-X …version.Patch/Date` flags every Go build stamps:
`build:server`, `quickstart.sh`, the release workflow), Vite's `define` inlines
the string into the bundle (`apps/web/build-version.ts`), and the release
passes it to Gradle as `-PappVersionName/-PappVersionCode` for the APK. An
unstamped `go build` reports the build clock's month and patch `0`. **Don't
assert a literal version in a test** — it changes with every commit. A shallow
clone deliberately reports patch `0` rather than a plausible lie, so anything
that builds a release needs the full history (`fetch-depth: 0`,
`--filter=blob:none`).

Releases: `.github/workflows/release.yml` runs on `v*` tags, pushes to `main`
and manual dispatch. It refuses patch 0 and a tag that is not its commit's
version, and the gate is a `## <version>` heading in `CHANGELOG.md` — a push
to main without one is skipped, a tag without one fails. It publishes
`bip39-explorer-<version>-linux-{arm64,amd64}`, `bip39-explorer.html`,
`bip39-explorer.apk` (a fixed name, so `…/releases/latest/download/bip39-explorer.apk`
always works) and `SHA256SUMS`. Keep work-in-progress notes under
`## Unreleased`, which never matches a version.

## Design language

Lifted from [CountRoster](https://github.com/chinmay28/countroster): the same
token block, 12 px radius, `prefers-color-scheme` dark, BEM-ish class names.
Added for this subject: monospace for every word and number, and seven
relation-family hues which are information, not decoration — the colour says
what kind of knowledge an edge is, the label says which relation exactly.

Both themes are defined at token level on bare `:root`, then redefined under
`prefers-color-scheme: dark`. Never give a colour its only definition inside a
media query.

## Safety

There is deliberately nowhere to type twelve words in a row. The bits view
stops at the individual word — index, hex, eleven bits. Don't add phrase-level
tooling, checksum validation, or anything that would want a field people put a
real seed into.
