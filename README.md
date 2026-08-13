# bip39-explorer

A GUI for exploring the [BIP-39 English wordlist](https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt)
— 2048 words — with a search box that finds words by more than substring.

> **Status: design + data.** The semantic index is built, validated and
> committed. The GUI exists as a working single-file prototype; the production
> stack is still an open question.

## Try it

**[`docs/design/orbit.html`](./docs/design/orbit.html)** — the Orbit prototype.
Open it from disk; it needs no server and makes no network request of any
kind. Three views of the same graph, and every word in all of them is a door
to the next one:

- **Map** — the orbit. The word at the centre, its relations on spokes. Tap the
  `+` beside any neighbour to fan out *its* links without leaving the page, so
  you can follow one branch two or three steps without losing the centre.
- **Tree** — the same graph unrolled as far down as you like, 1 to 4 levels,
  every branch foldable. Ancestors are pruned from each branch, so a subtree
  always walks outward rather than doubling back on itself.
- **Path** — name any second word and the app finds the strongest chain of
  relations joining the two. `bird → sea → ocean`, with each link's relation,
  strength and sources shown.

The frame is measured from what actually got drawn, so a sparse word gets a
small map and an opened branch gets room, on a phone as much as a desktop.

**[`docs/design/concepts.html`](./docs/design/concepts.html)** — the original
four-concept pitch that Orbit was chosen from.

## The map

Each word sits at the centre of its own relation map. Spokes are grouped by
relation and coloured by *family* — seven hues for eighteen relations, because
the colour should say what kind of knowledge an edge is and the label should
say exactly which relation.

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
edges, 62 topics, 831 KB (274 KB gzipped). No runtime model, no API, fully
offline.

| Source | Contributes |
|---|---|
| **WordNet 3.0** | Typed lexical relations. Precise: a wing is *part of* a bird, arrive is the *opposite* of depart. |
| **ConceptNet 5.7** | Common sense a dictionary omits: a canoe is found on a river, a ticket is used for a train. |
| **Numberbatch 19.08** | Association — words that keep company, like winter and sweater. |

Each edge records which sources vouched for it, so `7` means all three agreed.
Evidence combines as noisy-OR; the *label* is chosen by specificity, not
strength, because a vaguer true label is worse than a precise one.

Topics are not a taxonomy anyone wrote down — they are Louvain communities
over the fused graph, named after their most central member: food, animal,
emotion, payment, illness, weapon.

See **[tools/README.md](./tools/README.md)** for how to regenerate it, what
each module decides and why, and the known limitations.

```bash
python3 tools/check_index.py       # validate the committed index
python3 tools/build_prototype.py   # re-splice it into the prototype
```

## What the app works out for itself

The index is a starting position, not the answer. All of this is computed in
the page, from the graph, with no network and no server:

| | |
|---|---|
| **Both directions** | The index is directed; the app merges it into an undirected graph at load — 16,425 links, 16 per word — relabelling reverse edges by their inverse so a wing is *part of* a bird rather than having one. |
| **Trees to any depth** | Breadth-first from the current word, pruning ancestors so branches keep going outward. |
| **Strongest path** | Dijkstra over −log(strength), so a route costs the *product* of its links, not their count: three near-certainties beat one lucky guess. The graph turns out to be small-world — 2047 of the 2048 words are mutually reachable, median distance three. |
| **Two steps out** | Words tied to several of your word's neighbours but not to your word. It suggests `pilot` for `bird` — nobody wrote that edge down; the evidence is in the company they share. |
| **Letters and sound** | Prefix, substring, subsequence, Damerau–Levenshtein and a phonetic key, over all 2048 words on every keystroke. |

## Search: a ladder of match reasons

Finding the word is a separate problem from knowing what it means, and it
needs no precomputation — a pass over 2048 short strings costs well under a
millisecond, so this half runs live in the browser on every keystroke.

| Rung | Catches | Example |
|---|---|---|
| exact | The word itself | `bird` |
| starts with | Normal typing — and at four characters, exactly one word (BIP-39 guarantees unique 4-letter prefixes) | `sil` → `silent` |
| contains | Half-remembered middles and endings | `-tion` |
| 1–2 edits | Transcription slips, via Damerau–Levenshtein | `recieve` → `receive` |
| sounds like | Dictation and accents, via a phonetic key | `krane` → `crane` |
| letters in order | Skipped letters and shorthand | `dscvr` → `discover` |

The word page shows these too, in a strip under the map, kept visually
separate from the semantic relations — they are a different kind of knowing.

## On a phone

Not the desktop layout scaled down. Below 860 px the header nav becomes
CountRoster's bottom tab bar; below 700 px the map switches to a portrait
frame with tighter rings and four spokes rather than six, and the app opens on
Tree, which is the view that suits a narrow column. Touch targets are sized
for fingers — the map's open/close controls carry an invisible disc twice
their drawn size — the search field is 16 px so iOS does not zoom on focus,
and nothing needs hover to be discoverable.

## Adopted from [CountRoster](https://github.com/chinmay28/countroster)

- **Design tokens** — the same custom-property block: teal `#4ecdc4` on
  `#fafafa`, 12 px radius, two-step shadow, `prefers-color-scheme` dark,
  BEM-ish class names, system UI type. Added here: monospace for every word
  and number, and the seven relation-family hues, which are information
  rather than decoration.
- **Versioning** — `vMAJOR.MINOR.<git commit count>`, assembled by one script,
  stamped at build time, shown under the wordmark in tabular monospace. A
  build without git reports patch `0`; a shallow clone is refused rather than
  allowed to report a plausible lie.
- **QuickStart** — `curl … | sudo bash`: root check, dedicated system user,
  hardened systemd unit, health poll with rollback, re-runnable to upgrade.
  Simpler here in one way — no database, so the snapshot/restore half of the
  script drops out.

## Safety

This is a static, offline word reference. There is deliberately nowhere in the
UI to enter twelve words in a row: no phrase field, no network calls, no
storage. **Never type a real seed phrase into anything.**

## Data

- [`data/english.txt`](./data/english.txt) — the 2048-word list, sha256
  `2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda`, matching
  the hash published in the BIP-39 text.
- [`data/semantic-index.json`](./data/semantic-index.json) — the generated
  relation index. Derived from ConceptNet, so it carries **CC BY-SA 4.0**
  regardless of the rest of the repository; provenance travels inside the file.

## Still open

1. **Packaging** — CountRoster's Go binary and systemd unit, or a plain static
   bundle? *Default: both — a static bundle plus a small Go binary that embeds
   it, so the QuickStart story survives.*
2. **Stack** — mirror CountRoster's Vite + React + TypeScript, or stay
   dependency-free? *Default: Vite + React + TypeScript, with Vitest.*
3. **Scope of the bits view** — index and binary only, or a full checksum
   explainer? *Default: index, hex and 11 bits per word; no phrase-level
   tooling.*

## License

See [LICENSE](./LICENSE), and the note above about `data/semantic-index.json`.
