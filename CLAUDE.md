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

## Commands

```bash
npm install
npm test           # vitest (engine + app) · tools/check_index.py · go test ./...
npm run typecheck  # tsc --noEmit + go vet
npm run build      # client → single-file bundle → embed → Go binary
npm run dev        # http://localhost:5173
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

`vMAJOR.MINOR.<git commit count>`. Major and minor are constants in
`server/internal/version/version.go` — the single declaration in the tree,
which `scripts/version.mjs` parses so the client and the binary can never
disagree. Keep them in a form that file's regex can find. Patch is stamped at
link time; a shallow clone deliberately reports `0` rather than a plausible
lie.

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
