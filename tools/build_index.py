#!/usr/bin/env python3
"""Build data/semantic-index.json from the BIP-39 English wordlist.

The GUI ships no model and makes no network calls: everything it knows about
what a word means is computed here, once, and committed. Re-running this on
the same three source files produces the same output byte for byte, so the
index is reviewable in a diff like any other source file.

    python3 tools/build_index.py --corpora ~/corpora

See tools/README.md for how to fetch the corpora (they are large and are not
committed).
"""

import argparse
import hashlib
import json
import os
import sys
import time
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from bip39_semantics import cluster, conceptnet_source, merge, numberbatch_source, relations, wordnet_source  # noqa: E402

REPO = Path(__file__).resolve().parent.parent
WORDLIST = REPO / "data" / "english.txt"
OUTPUT = REPO / "data" / "semantic-index.json"

SOURCE_NOTES = [
    {
        "name": "WordNet 3.0",
        "role": "Typed lexical relations — synonyms, hypernyms, meronyms, antonyms.",
        "url": "https://wordnet.princeton.edu/",
        "license": "WordNet 3.0 License (BSD-like)",
    },
    {
        "name": "ConceptNet 5.7.0",
        "role": "Common-sense assertions — what a thing is used for, where it is found.",
        "url": "https://conceptnet.io/",
        "license": "CC BY-SA 4.0",
    },
    {
        "name": "ConceptNet Numberbatch 19.08 (en)",
        "role": "Retrofitted word embeddings — associative similarity.",
        "url": "https://github.com/commonsense/conceptnet-numberbatch",
        "license": "CC BY-SA 4.0",
    },
]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def log(msg):
    print(f"  {msg}", flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--corpora", type=Path, required=True,
                    help="directory holding the three downloaded source files")
    ap.add_argument("--nltk-data", type=Path, default=None,
                    help="NLTK data directory containing corpora/wordnet")
    ap.add_argument("--output", type=Path, default=OUTPUT)
    args = ap.parse_args()

    if args.nltk_data:
        os.environ["NLTK_DATA"] = str(args.nltk_data)
    from nltk.corpus import wordnet as wn

    words = [w.strip() for w in WORDLIST.read_text().splitlines() if w.strip()]
    if len(words) != 2048:
        raise SystemExit(f"expected 2048 words, got {len(words)}")
    index_of = {w: i for i, w in enumerate(words)}

    started = time.time()

    print("WordNet")
    wn_edges, senses, domain_weights = wordnet_source.extract(words, wn)
    log(f"{len(wn_edges)} directed edges over {len(senses)} words with a synset")

    print("ConceptNet")
    cn_path = args.corpora / "conceptnet-assertions-5.7.0.csv.gz"
    cn_edges, rows = conceptnet_source.extract(
        words, cn_path, domain_weights=domain_weights,
        progress=lambda seen, kept: log(f"{seen//1_000_000}M rows, {kept} edges"),
    )
    log(f"{len(cn_edges)} directed edges from {rows} rows")

    print("Numberbatch")
    nb_path = args.corpora / "numberbatch-en-19.08.txt.gz"
    nb_edges, covered = numberbatch_source.extract(words, nb_path)
    log(f"{len(nb_edges)} directed edges, {covered}/{len(words)} words have a vector")

    print("Fusing")
    fused = merge.fuse([
        (merge.WORDNET, wn_edges),
        (merge.CONCEPTNET, cn_edges),
        (merge.NUMBERBATCH, nb_edges),
    ])
    log(f"{len(fused)} distinct directed pairs")

    print("Clustering")
    topics, assignment = cluster.build(words, fused)
    log(f"{len(topics)} topics covering {len(assignment)} words")

    print("Ranking")
    ranked = merge.neighbours(words, fused)

    print("Captioning")
    meta = wordnet_source.choose_glosses(
        senses,
        {w: [e[3] for e in edges] for w, edges in ranked.items()},
    )
    log(f"{len(meta)} definitions chosen against the finished neighbourhoods")

    type_counts = Counter()
    degree = Counter()
    entries = []
    for i, word in enumerate(words):
        nbrs = ranked.get(word, [])
        degree[word] = len(nbrs)
        payload = []
        for score, rtype, mask, other in nbrs:
            type_counts[rtype] += 1
            payload.append([index_of[other], rtype, round(score * 100), mask])
        info = meta.get(word, {})
        entry = {"w": word, "n": payload}
        if info.get("gloss"):
            entry["g"] = info["gloss"]
            entry["p"] = info["pos"]
        if word in assignment:
            entry["t"] = assignment[word]
        entries.append(entry)

    isolated = [w for w in words if not ranked.get(w)]

    document = {
        "schema": 1,
        "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "wordlist": {
            "file": "data/english.txt",
            "count": len(words),
            "sha256": sha256(WORDLIST),
        },
        "sources": SOURCE_NOTES,
        "relations": {
            name: {"label": relations.LABELS[name], "rank": relations.RANK[name]}
            for name in relations.RELATIONS
        },
        "note": (
            "Neighbour rows are [word index, relation, score 0-100, source mask]. "
            "Source mask bits: 1 WordNet, 2 ConceptNet, 4 Numberbatch. Word "
            "entries are index-aligned to data/english.txt."
        ),
        "stats": {
            "pairs": len(fused),
            "edges_kept": sum(degree.values()),
            "mean_degree": round(sum(degree.values()) / len(words), 2),
            "words_without_neighbours": len(isolated),
            "isolated": isolated,
            "by_relation": dict(type_counts.most_common()),
            "topics": len(topics),
        },
        "topics": topics,
        "words": entries,
    }

    write(args.output, document)
    size = args.output.stat().st_size
    print(f"\nwrote {args.output.relative_to(REPO)} — {size/1024:.0f} KB "
          f"in {time.time() - started:.0f}s")


def write(path, document):
    """One line per word, one per topic; everything else pretty-printed.

    Fully-indented JSON triples the file size for no benefit — a neighbour
    row is meant to be read across, not down — and a single minified line
    makes the index unreviewable. One record per line keeps `git diff`
    honest: changing how "bird" is scored touches one line.
    """
    words = document.pop("words")
    topics = document.pop("topics")
    with open(path, "w", encoding="utf-8") as fh:
        head = json.dumps(document, indent=1, ensure_ascii=False)
        fh.write(head[:-2].rstrip() + ",\n")     # drop the closing brace
        fh.write(' "topics": [\n')
        fh.write(",\n".join(
            "  " + json.dumps(t, ensure_ascii=False, separators=(",", ":"))
            for t in topics
        ))
        fh.write("\n ],\n")
        fh.write(' "words": [\n')
        fh.write(",\n".join(
            "  " + json.dumps(w, ensure_ascii=False, separators=(",", ":"))
            for w in words
        ))
        fh.write("\n ]\n}\n")
    document["topics"] = topics
    document["words"] = words


if __name__ == "__main__":
    main()
