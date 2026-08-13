"""Fuse the three sources into one ranked neighbour list per word.

Two questions have to be answered for every pair of words: how strong is the
connection, and what should we call it.

**Strength** combines the sources as independent evidence — noisy-OR, so
agreement compounds without ever exceeding 1. A pair that WordNet, ConceptNet
and the embeddings all vouch for ends up near the top; a pair only the
embeddings noticed stays where it belongs, present but modest.

**Name** is decided by specificity, not strength. If WordNet calls the pair a
hypernym and ConceptNet only manages "related to", the diagram says "is a
kind of". A vaguer true label is worse than a precise one, and the strength
number already carries the confidence.
"""

from collections import defaultdict

from .relations import best_type

WORDNET, CONCEPTNET, NUMBERBATCH = 1, 2, 4

# Neighbours kept per word. Enough for the detail view to group by relation
# and still have depth in each group; small enough that the whole index stays
# a file you can open in an editor.
TOP_N = 22

# After the top-N cut, each relation type a word participates in keeps at
# least this many of its best edges — so a word's single antonym is never
# pushed out by a crowd of associative neighbours.
MIN_PER_TYPE = 2

# Below this, an edge is one unsupported ConceptNet shrug. Padding a word's
# list out to a fixed length with those is worse than a short list: it
# implies a connection the data does not have. Words with nothing to say
# semantically — "satoshi" — are allowed to say nothing.
SCORE_FLOOR = 0.25


def fuse(sources):
    """sources: [(mask, {(a, b): {type: weight}})] -> {(a, b): (score, type, mask)}"""
    strength = defaultdict(lambda: [0.0, 0.0, 0.0])   # per-source best weight
    # pair -> {type: (attested by WordNet?, weight)}. WordNet's vote counts
    # for more than its weight when two sources point a relation opposite
    # ways: it is the only source with a curated sense of direction.
    types = defaultdict(dict)
    masks = defaultdict(int)
    slot = {WORDNET: 0, CONCEPTNET: 1, NUMBERBATCH: 2}

    for mask, edges in sources:
        i = slot[mask]
        for pair, by_type in edges.items():
            best = max(by_type.values())
            if best > strength[pair][i]:
                strength[pair][i] = best
            for name, weight in by_type.items():
                evidence = (1 if mask == WORDNET else 0, weight)
                if evidence > types[pair].get(name, (-1, -1.0)):
                    types[pair][name] = evidence
            masks[pair] |= mask

    fused = {}
    for pair, per_source in strength.items():
        combined = 1.0
        for s in per_source:
            combined *= (1.0 - min(1.0, max(0.0, s)))
        fused[pair] = (1.0 - combined, best_type(types[pair]), masks[pair])
    return fused


def neighbours(words, fused, top_n=TOP_N, min_per_type=MIN_PER_TYPE,
               floor=SCORE_FLOOR):
    """Ranked, capped neighbour lists keyed by word."""
    by_word = defaultdict(list)
    for (a, b), (score, rtype, mask) in fused.items():
        if score >= floor:
            by_word[a].append((score, rtype, mask, b))

    out = {}
    for word in words:
        ranked = sorted(by_word.get(word, []), key=lambda e: (-e[0], e[3]))
        kept = ranked[:top_n]
        keep_ids = {id(e) for e in kept}

        # Rescue the best few edges of any relation type the cut dropped
        # entirely or nearly so.
        per_type = defaultdict(int)
        for e in kept:
            per_type[e[1]] += 1
        for e in ranked[top_n:]:
            if per_type[e[1]] < min_per_type:
                kept.append(e)
                keep_ids.add(id(e))
                per_type[e[1]] += 1

        out[word] = sorted(kept, key=lambda e: (-e[0], e[3]))
    return out
