# Semantic index generator

Everything the GUI knows about what a BIP-39 word *means* is computed here,
once, and committed as [`data/semantic-index.json`](../data/semantic-index.json).
The app ships no model, makes no network calls, and needs no server: the
wordlist is fixed at 2048 entries, so its relationships can be worked out
ahead of time and shipped as data.

```
data/english.txt ──┬─▶ WordNet 3.0      ─┐
                   ├─▶ ConceptNet 5.7   ─┼─▶ fuse ─▶ rank ─▶ cluster ─▶ semantic-index.json
                   └─▶ Numberbatch 19.08 ┘
```

## Regenerating

Needs Python 3.11+, about 1 GB of downloads and a couple of minutes.

```bash
python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt

CORPORA=~/corpora && mkdir -p "$CORPORA"

# WordNet, via NLTK's data repository (~11 MB).
mkdir -p "$CORPORA/nltk/corpora"
curl -fsSL https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/wordnet.zip \
  -o /tmp/wordnet.zip && unzip -q /tmp/wordnet.zip -d "$CORPORA/nltk/corpora"

# ConceptNet assertions (~500 MB) and Numberbatch English vectors (~325 MB).
curl -fL -o "$CORPORA/conceptnet-assertions-5.7.0.csv.gz" \
  https://s3.amazonaws.com/conceptnet/downloads/2019/edges/conceptnet-assertions-5.7.0.csv.gz
curl -fL -o "$CORPORA/numberbatch-en-19.08.txt.gz" \
  https://conceptnet.s3.amazonaws.com/downloads/2019/numberbatch/numberbatch-en-19.08.txt.gz

.venv/bin/python tools/build_index.py --corpora "$CORPORA" --nltk-data "$CORPORA/nltk"
python3 tools/check_index.py
```

The corpora are not committed — they are large and versioned upstream. The
output is committed, and `build_index.py` is deterministic, so the same three
files always produce the same index.

## What each module does

| File | Role |
|---|---|
| `bip39_semantics/relations.py` | The relation vocabulary all three sources map onto, and how specific each one is. |
| `bip39_semantics/wordnet_source.py` | Typed lexical relations, sense weighting, and choosing which definition to show. |
| `bip39_semantics/conceptnet_source.py` | Common-sense assertions, streamed from the full dump. |
| `bip39_semantics/numberbatch_source.py` | Embedding neighbours — the associative layer. |
| `bip39_semantics/merge.py` | Fuses the three into one ranked neighbour list per word. |
| `bip39_semantics/cluster.py` | Louvain communities over the fused graph, as emergent topics. |
| `build_index.py` | Orchestrates the above and writes the JSON. |
| `check_index.py` | Validates the committed index. Run it after every regeneration. |

Each module's docstring explains the judgement calls in it — they are not
obvious, and several were arrived at by watching the output get worse.

## Output format

```jsonc
{
  "schema": 1,
  "wordlist": { "sha256": "2f5eed53…", "count": 2048 },
  "relations": { "is-a": { "label": "is a kind of", "rank": 2 }, … },
  "topics": [ { "id": 0, "label": "food", "size": 76, "signature": [...], "members": [...] } ],
  "words": [
    { "w": "bird",
      "g": "warm-blooded egg-laying vertebrates…",   // definition
      "p": "n",                                       // part of speech
      "t": 3,                                         // topic id
      "n": [ [1237, "kind", 98, 3], … ] }             // neighbours
  ]
}
```

`words` is index-aligned to `data/english.txt`, so `words[1237].w` is the word
at line 1238. A neighbour row is `[word index, relation, score 0-100, source
mask]`, ranked strongest first. The source mask is a bitfield: `1` WordNet,
`2` ConceptNet, `4` Numberbatch — so `7` means all three agreed.

One record per line: fully-indented JSON triples the size, and a minified
single line is unreviewable. This way changing how one word scores touches
one line of the diff.

## What is deliberately *not* in here

Relations derivable from the letters themselves — prefix, substring,
edit distance, phonetic key, anagram — are computed in the browser on every
keystroke. A pass over 2048 short strings costs well under a millisecond, so
precomputing them would only add weight to the download and a second place
for the rules to live.

## Known limitations

- **18 words have no WordNet entry**, mostly function words (`that`, `when`,
  `you`) plus `satoshi`. They get embedding neighbours or none at all.
- **`satoshi` has one neighbour** (`coin`) and belongs to no topic. That is
  the honest answer for a word coined after every one of these corpora.
- **Topic assignment is fuzzy at the edges.** Louvain optimises the whole
  partition, so a word with few strong edges lands wherever its one good
  edge points — `buffalo` sits in the bird topic because its strongest tie is
  to other animals that happen to cluster there. The topics are a browsing
  aid, not a taxonomy.
- **Sense conflation survives in ConceptNet.** Its concepts have no senses,
  so where an assertion carries no WordNet sense tag there is nothing to
  disambiguate against.

## Licensing

The generated index is derived from ConceptNet, which is **CC BY-SA 4.0** —
so `data/semantic-index.json` carries that licence and attribution regardless
of what the rest of the repository is under. WordNet's licence is BSD-like
and requires attribution. Both are recorded in the index's own `sources`
field so the file travels with its provenance.
