# bip39-explorer

An offline explorer for the [BIP-39 English wordlist](https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt)
— 2048 words — that finds words by spelling, by sound, and by what they mean.

It is a **client-server app with no server logic**: a single static Go binary
serves an installable PWA that carries the entire dataset. There is no
database, no API, and **no network request of any kind** once the page has
loaded. `connect-src 'none'` in the server's Content-Security-Policy makes
that a rule the browser enforces rather than a claim in this file.

## Getting started

```bash
npm install                                    # Node >= 20.10 (build tooling only)
npm run dev                                    # http://localhost:5173
```

Or build the real thing:

```bash
npm run build          # client → single-file bundle → embed → static Go binary
./server/bin/bip39-explorer serve              # http://localhost:8788
```

`npm run build` produces three usable artifacts:

| Artifact | What it is for |
|---|---|
| `apps/web/dist/` | The PWA, for any static host. |
| `dist/bip39-explorer.html` | **One file, ~1 MB.** The whole app inlined — put it on a USB stick, mail it, open it from `file://` on a machine with no network at all. |
| `server/bin/bip39-explorer` | A static binary with the PWA embedded. No runtime dependencies. |

### Quick start on Linux (Ubuntu / Raspberry Pi)

Install as a hardened **systemd service** with one command:

```bash
curl -fsSL https://raw.githubusercontent.com/chinmay28/bip39-explorer/main/scripts/quickstart.sh | sudo bash
```

(or, from a checkout: `sudo ./scripts/quickstart.sh`)

It installs Node and Go if needed (build-time only), creates a dedicated
`bip39` system user, builds the PWA and the binary, and runs it under systemd
on `http://<host>:8788`.

**Re-run it any time to upgrade.** The new binary is built while the old one
keeps serving, so a failed build leaves the running service untouched; after
restart the script polls `/healthz` and rolls back to the previous binary if
the new one is unhealthy. Unlike its sibling project CountRoster there is
nothing to back up first — the service holds no state at all, so an upgrade
has nothing it could lose.

Override defaults with env vars (`PORT`, `HOST`, `BIP39_REF`, `BIP39_PREFIX`,
`BIP39_USER`, …). Manage it with `systemctl status bip39-explorer` and
`journalctl -u bip39-explorer -f`.

## The three views

Every word in all of them is a door to the next one.

- **Map** — the word at the centre, its relations on spokes, coloured by
  family. Tap the `+` beside any neighbour to fan out *its* links without
  losing the centre.
- **Tree** — the same graph unrolled 1 to 4 levels, every branch foldable.
- **Path** — name any second word and it finds the strongest chain of
  relations joining the two: `bird —is found at→ sea —means the same→ ocean`.

Seven hues carry eighteen relations: the colour says what *kind* of knowledge
an edge is, the label says which relation exactly.

| Family | Relations |
|---|---|
| same meaning | synonym, similar, shares a root |
| kinds and categories | is a kind of, kinds of it, same family as |
| parts and materials | is part of, has as a part, is made of |
| use, place and effect | is used for, is found at, is able to, leads to, is described as |
| opposites | opposite of |
| loosely related | relates to, same context |
| turns up together | statistical association only |

The last two are kept apart deliberately: something a source *asserted* is a
different claim from something the embeddings merely *observed*.

## Where the relations come from

Three sources, fused offline and committed as
[`data/semantic-index.json`](./data/semantic-index.json) — 2048 words, 28k
edges, 62 topics, 831 KB.

| Source | Contributes |
|---|---|
| **WordNet 3.0** | Typed lexical relations. Precise: a wing is *part of* a bird, arrive is the *opposite* of depart. |
| **ConceptNet 5.7** | Common sense a dictionary omits: a canoe is found on a river, a ticket is used for a train. |
| **Numberbatch 19.08** | Association — words that keep company, like winter and sweater. |

Each edge records which sources vouched for it. Evidence combines as noisy-OR;
the *label* is chosen by specificity, not strength, because a vaguer true
label is worse than a precise one. Topics are not a taxonomy anyone wrote
down — they are Louvain communities named after their most central member.

See **[tools/README.md](./tools/README.md)** for how to regenerate the index,
what each module decides and why, and the known limitations.

## What the app works out for itself

The index is a starting position, not the answer. All of this runs in the
page:

| | |
|---|---|
| **Both directions** | The index is directed; the client merges it into an undirected graph at load — 16,425 links, 16 per word — relabelling reverse edges by their inverse, so a wing is *part of* a bird rather than having one. |
| **Trees to any depth** | Ancestors are pruned per branch: relations run both ways, so without that every subtree would open with a step straight back where it came from. |
| **Branches that stay on subject** | Every hop optimising locally makes a branch drift. From the third level down, candidates are re-ranked by neighbours shared with the root, which turns `animal → female, head, joy` into `animal → rabbit, zoo, cat`. **Stay on topic** in the Tree bar turns it off so you can see both. |
| **Strongest path** | Dijkstra over −log(strength), so a route costs the *product* of its links, not their count. The graph is small-world — 2047 of 2048 words mutually reachable, median distance three. |
| **Two steps out** | Words tied to several of your word's neighbours but not to your word. It offers `pilot` for `bird` — nobody wrote that edge down; the evidence is in the company they share. |

## Search: a ladder of match reasons

Finding a word is a different problem from knowing what it means, and it needs
no precomputation — a pass over 2048 short strings costs well under a
millisecond, so this half runs live on every keystroke.

| Rung | Catches | Example |
|---|---|---|
| exact | The word itself | `bird` |
| starts with | Normal typing — and at four characters, exactly one word (BIP-39 guarantees unique 4-letter prefixes) | `sil` → `silent` |
| contains | Half-remembered middles and endings | `-tion` |
| 1–2 edits | Transcription slips, via Damerau–Levenshtein | `recieve` → `receive` |
| sounds like | Dictation and accents, via a phonetic key | `krane` → `crane` |
| letters in order | Skipped letters and shorthand | `dscvr` → `discover` |

The word page shows these too, in a strip kept visually separate from the
semantic relations — they are a different kind of knowing.

## On a phone

Not the desktop layout scaled down. Below 860 px the header nav is replaced by
CountRoster's bottom tab bar — replaced, not hidden, so screen readers get one
navigation landmark rather than two. Below 700 px the map takes a portrait
frame with tighter rings and four spokes instead of six, and the app opens on
Tree, which is the view that suits a narrow column. The map's frame is
measured from what was actually drawn, so a sparse word gets a small map and
an opened branch gets room. Touch targets are finger-sized, and the search
field is 16 px so iOS does not zoom on focus.

## Layout

```
bip39-explorer/
├── apps/web/          # @bip39-explorer/web — the PWA (Vite + React + TS)
├── server/            # the Go binary that serves it; no database, no API
├── tools/             # the Python pipeline that generates the semantic index
├── data/              # the wordlist and the committed index
└── scripts/           # version, single-file bundler, embed step, quickstart
```

## Testing and checks

```bash
npm test          # vitest (engine + app) · check_index.py · go test ./...
npm run typecheck # tsc --noEmit + go vet
```

`apps/web/src/lib/*.test.ts` covers the engine against a hand-built fixture;
`src/app/app.test.tsx` drives the assembled app through the DOM;
`tools/check_index.py` validates the committed index; the Go suite pins the
server's routing, headers and health contract.

## Adopted from [CountRoster](https://github.com/chinmay28/countroster)

- **Design tokens** — the same custom-property block: teal `#4ecdc4` on
  `#fafafa`, 12 px radius, two-step shadow, `prefers-color-scheme` dark,
  BEM-ish class names, system UI type. Added here: monospace for every word
  and number, and the seven relation-family hues, which are information rather
  than decoration.
- **Versioning** — `vMAJOR.MINOR.<git commit count>`, assembled by one script
  and stamped into both artifacts, shown under the wordmark in tabular
  monospace. A build without git reports patch `0`; a shallow clone is refused
  rather than allowed to report a plausible lie.
- **QuickStart** — root check, dedicated system user, hardened systemd unit,
  health poll with rollback, re-runnable to upgrade.

## Safety

There is deliberately nowhere in the UI to enter twelve words in a row: no
phrase field, no network calls, no storage. The bits view stops at the word —
index, hex and its eleven bits. **Never type a real seed phrase into
anything.**

## Data

- [`data/english.txt`](./data/english.txt) — the 2048-word list, sha256
  `2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda`, matching
  the hash published in the BIP-39 text.
- [`data/semantic-index.json`](./data/semantic-index.json) — the generated
  relation index. Derived from ConceptNet, so it carries **CC BY-SA 4.0**
  regardless of the rest of the repository; provenance travels inside the file.

## Design record

[`docs/design/concepts.html`](./docs/design/concepts.html) — the original
four-concept pitch this was chosen from.

## License

See [LICENSE](./LICENSE), and the note above about `data/semantic-index.json`.
