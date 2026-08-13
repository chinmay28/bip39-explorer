"""The relation vocabulary the whole pipeline agrees on.

Three sources feed the index and each names its edges differently. They are
all mapped onto the vocabulary below, so the GUI only ever sees these types
and every one of them is something a person can read off a diagram: "is a
kind of", "is part of", "opposite of".

`PRIOR` is how much a relation is worth before any source-specific weight is
applied — roughly, how confident a reader would be that two words really
belong next to each other given only the relation name. `RANK` breaks ties
when several sources describe the same pair: the most specific description
wins, so a pair that WordNet calls a hypernym and ConceptNet merely calls
"related to" is displayed as "is a kind of".
"""

# type -> (human label, prior weight, display rank; lower rank = more specific)
RELATIONS = {
    "synonym":   ("means the same", 1.00, 0),
    "opposite":  ("opposite of",    0.95, 1),
    "is-a":      ("is a kind of",   0.90, 2),
    "kind":      ("kinds of it",    0.88, 3),
    "part-of":   ("is part of",     0.82, 4),
    "has-part":  ("has as a part",  0.80, 5),
    "made-of":   ("is made of",     0.80, 6),
    "sibling":   ("same family as", 0.72, 7),
    "used-for":  ("is used for",    0.70, 8),
    "at":        ("is found at",    0.68, 9),
    "can":       ("is able to",     0.62, 10),
    "causes":    ("leads to",       0.62, 11),
    "property":  ("is described as", 0.60, 12),
    "derived":   ("shares a root",  0.66, 13),
    "similar":   ("is similar to",  0.72, 14),
    "context":   ("same context",   0.45, 15),
    "related":   ("relates to",     0.50, 16),
    "associated": ("turns up with", 0.45, 17),
}

LABELS = {k: v[0] for k, v in RELATIONS.items()}
PRIOR = {k: v[1] for k, v in RELATIONS.items()}
RANK = {k: v[2] for k, v in RELATIONS.items()}


# Relations that are each other's mirror image. Two sources can disagree
# about which way a pair points — WordNet files an eagle under birds, while
# some ConceptNet contributor wrote "bird IsA eagle" — and picking the
# more specific label without noticing would print the taxonomy upside down.
INVERSE = {
    "is-a": "kind",
    "kind": "is-a",
    "part-of": "has-part",
    "has-part": "part-of",
}


def best_type(types):
    """The most specific relation among several descriptions of one pair.

    `types` maps each proposed relation to how well attested it is, as
    (from WordNet?, weight). Direction conflicts are settled first, on
    evidence; specificity only decides among what survives.
    """
    surviving = dict(types)
    for name, opposite in INVERSE.items():
        if name in surviving and opposite in surviving:
            loser = min((name, opposite), key=lambda t: surviving[t])
            del surviving[loser]
    return min(surviving, key=lambda t: RANK[t])
