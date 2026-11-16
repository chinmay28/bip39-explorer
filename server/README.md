# server

One static Go binary that serves the built PWA. No database, no API, no state.

```bash
go test ./...
go vet ./...
go build ./cmd/bip39-explorer      # unstamped: reports patch 0
```

From the repo root, `npm run build` stages the built client into
`cmd/bip39-explorer/webdist/`, stamps the version and produces
`server/bin/bip39-explorer`.

## CLI

```
bip39-explorer serve [flags]   # also the default with no arguments
bip39-explorer version
```

| Flag | Env fallback | Default | Meaning |
|---|---|---|---|
| `--host` | `HOST` | `0.0.0.0` | bind address |
| `--port` | `PORT` | `8788` | listen port |
| `--web-dist` | `WEB_DIST` | — | serve this directory instead of the embedded client |

Each flag wins over its env var, which wins over the default.

## Version

`vYEAR.MONTH.PATCH` — a calendar version, where YEAR.MONTH is the month of the
commit being built (its committer date, in the committer's timezone) and patch
is the repository's commit count. Nothing is bumped by hand. Both are stamped at
link time as `version.Date` and `version.Patch` by the flags
`node scripts/version.mjs --ldflags` prints, the same script the client and the
Android app read, so all three always agree. The month is unpadded so the string
stays valid semver. An unstamped `go build` reports the build clock's month and
patch `0`, which is visibly a non-release rather than a plausible lie.

## The handler

`internal/httpserve` is deliberately not an `http.ServeMux` over an
`http.FileServer`. Both answer awkward paths with a 301 — `/index.html`
bounces to `/`, a traversal attempt bounces to its cleaned form — which is
safe but makes the reply depend on a redirect the caller has to follow.
Resolving the path in one function keeps every response direct and every rule
in one place.

Unknown paths fall back to `index.html`: they are the client's routes, not
missing files.

The `Content-Security-Policy` is load-bearing rather than decorative. This app
makes no network requests, so `connect-src 'none'` turns that from a claim in
a README into something the browser enforces — if a future change ever tried
to phone home, it would fail loudly.
