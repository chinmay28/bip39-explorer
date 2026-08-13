"""Numberbatch edges: the associative half of the index.

The other two sources only connect words someone has explicitly written down
a relationship for. Embeddings connect words that simply keep company —
"winter" and "sweater", "guitar" and "stage" — which is most of what a person
means when they say two words are related.

Numberbatch rather than plain GloVe or word2vec: it is retrofitted against
ConceptNet's graph, which pulls apart the pairs raw co-occurrence famously
conflates. In an untrained space "hot" and "cold" are near-identical
neighbours because they appear in identical sentences; here they land where a
reader would expect, and antonyms come back labelled as antonyms by the
ConceptNet source rather than smuggled in as similarity.

Only the 2048 rows we care about are kept, so the 300-dimension table costs
about 2.5 MB of memory and the all-pairs cosine is a single 2048×2048 matmul.
"""

import gzip

import numpy as np


def load_vectors(words, path):
    """Read only our words out of the embedding table."""
    wanted = set(words)
    found = {}
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        fh.readline()                       # "<rows> <dims>" header
        for line in fh:
            term, _, rest = line.partition(" ")
            if term in wanted:
                found[term] = np.fromstring(rest, sep=" ", dtype=np.float32)
                if len(found) == len(wanted):
                    break
    return found


def extract(words, path, top_k=24, floor=0.20):
    """Return ({(a, b): {"associated": score}}, coverage_count).

    `floor` is a similarity below which a neighbour is not worth showing.
    Numberbatch cosines run lower than word2vec's — 0.20 is already a clear
    association, 0.45 is a near-synonym.
    """
    vectors = load_vectors(words, path)
    present = [w for w in words if w in vectors]
    if not present:
        return {}, 0

    matrix = np.vstack([vectors[w] for w in present])
    matrix /= np.linalg.norm(matrix, axis=1, keepdims=True)
    sims = matrix @ matrix.T
    np.fill_diagonal(sims, -1.0)

    edges = {}
    k = min(top_k, len(present) - 1)
    for i, word in enumerate(present):
        row = sims[i]
        for j in np.argpartition(-row, k)[:k]:
            score = float(row[j])
            if score > floor:
                # Rescale so the visible band (floor..0.75) spans most of
                # 0..1; raw cosines all sit in a narrow range and would make
                # every associative edge look equally strong.
                scaled = min(1.0, (score - floor) / (0.75 - floor))
                edges[(word, present[j])] = {"associated": round(scaled, 4)}

    return edges, len(present)
