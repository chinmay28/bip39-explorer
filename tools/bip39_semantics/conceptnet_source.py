"""ConceptNet edges: the common-sense half of the index.

WordNet is a dictionary and thinks like one — it will tell you a hammer is a
tool but not that you use it on a nail. ConceptNet is crowd- and
Wiktionary-sourced and knows the everyday associations a dictionary omits:
that a canoe is found on a river, that fire causes smoke, that a ticket is
used for a train.

The download is the full multilingual assertions dump (~500 MB gzipped, ~34 M
rows), which is easier to justify than 2048 API calls: it is one artifact,
it pins a version, and re-running the build offline gives byte-identical
output. Rows are streamed and discarded on the fly, so peak memory is the
size of the surviving edge set, not the file.

Only single-token English concepts on both ends survive, and only relations
that a reader would accept as a reason two words sit next to each other —
`/r/ExternalURL` and the dbpedia relations are structural bookkeeping, not
meaning.

Two families of dataset are excluded. `/d/verbosity` came from a
word-guessing game, and its idea of an antonym is whatever the other player
said next: it is the sole source for "ocean is the opposite of lake" and
"ocean is the opposite of mass". Non-English Wiktionaries are dropped too —
the French Wiktionary is the only thing asserting that "bird" is a synonym
for "girl", which is true of a slang sense no one reaching for a BIP-39 word
means. Both land at the top of a word's list because "opposite" and
"synonym" are high-confidence relations, so a little bad data does an
outsized amount of visible damage.

ConceptNet is also sense-blind at the concept level — `/c/en/bird` is every
bird — but many assertions imported from WordNet keep their sense in the URI
(`/c/en/bird/n/wn/food`). Where that tag is present it is honoured, using the
same sense weights the WordNet source computed, so "bird is a kind of meat"
is kept and correctly demoted rather than competing with the animal.
"""

import gzip
import json
from collections import defaultdict

# ConceptNet relation -> (our type, prior scale, symmetric?)
RELATION_MAP = {
    "/r/Synonym":       ("synonym", 1.00, True),
    "/r/Antonym":       ("opposite", 0.96, True),
    "/r/IsA":           ("is-a", 0.90, False),
    "/r/PartOf":        ("part-of", 0.84, False),
    "/r/HasA":          ("has-part", 0.76, False),
    "/r/MadeOf":        ("made-of", 0.80, False),
    "/r/UsedFor":       ("used-for", 0.74, False),
    "/r/AtLocation":    ("at", 0.72, False),
    "/r/CapableOf":     ("can", 0.66, False),
    "/r/Causes":        ("causes", 0.66, False),
    "/r/HasSubevent":   ("causes", 0.56, False),
    "/r/HasPrerequisite": ("causes", 0.56, False),
    "/r/MotivatedByGoal": ("causes", 0.54, False),
    "/r/HasProperty":   ("property", 0.62, False),
    "/r/SimilarTo":     ("similar", 0.80, True),
    "/r/DerivedFrom":   ("derived", 0.70, False),
    "/r/EtymologicallyRelatedTo": ("derived", 0.62, True),
    "/r/FormOf":        ("derived", 0.72, False),
    "/r/HasContext":    ("context", 0.46, True),
    # RelatedTo is ConceptNet's shrug. There are millions of them, many
    # single-attestation and inexplicable ("salmon relates to bicycle"), and
    # at a higher prior a lone one outranks real relations. Priced so that
    # one on its own stays out of a word's visible list, and only rises when
    # the embeddings independently agree.
    "/r/RelatedTo":     ("related", 0.34, True),
}

def _excluded(dataset):
    if dataset == "/d/verbosity":
        return True
    # /d/wiktionary/fr is the French Wiktionary's opinion about English.
    return dataset.startswith("/d/wiktionary/") and dataset != "/d/wiktionary/en"


def _concept(uri):
    """`/c/en/bird/n/wn/food` -> ('bird', 'food').

    The second element is the WordNet lexical domain when the URI carries
    one, else None. Returns None for anything that isn't a plain single-word
    English concept.
    """
    parts = uri.split("/")
    if len(parts) < 4 or parts[1] != "c" or parts[2] != "en":
        return None
    term = parts[3]
    if "_" in term:
        return None
    domain = parts[6] if len(parts) > 6 and parts[5] == "wn" else None
    return term, domain


def extract(words, path, domain_weights=None, progress=None):
    """Stream the assertions dump; return ({(a, b): {type: weight}}, rows).

    `domain_weights` is the {(word, domain): weight} map from the WordNet
    source. When supplied, sense-tagged assertions are damped by how much of
    each word's usage really lives in the tagged sense.
    """
    vocab = set(words)
    domain_weights = domain_weights or {}
    edges = defaultdict(lambda: defaultdict(float))

    def sense_scale(term, domain):
        if domain is None:
            return 1.0
        # An unknown tag means WordNet has no such sense for this word, which
        # is itself evidence the assertion is about something else.
        return domain_weights.get((term, domain), 0.25)

    def link(a, b, rtype, weight):
        if a != b and weight > edges[(a, b)][rtype]:
            edges[(a, b)][rtype] = weight

    seen = 0
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        for line in fh:
            seen += 1
            if progress and seen % 4_000_000 == 0:
                progress(seen, len(edges))

            # Cheap reject before paying for a split: the vast majority of
            # rows are neither English nor a relation we keep.
            if "/c/en/" not in line:
                continue

            try:
                _, rel, start, end, meta = line.rstrip("\n").split("\t")
            except ValueError:
                continue

            mapped = RELATION_MAP.get(rel)
            if mapped is None:
                continue

            head = _concept(start)
            if head is None or head[0] not in vocab:
                continue
            tail = _concept(end)
            if tail is None or tail[0] not in vocab:
                continue

            rtype, scale, symmetric = mapped
            try:
                info = json.loads(meta)
                if _excluded(info.get("dataset", "")):
                    continue
                w = float(info.get("weight", 1.0))
            except (ValueError, AttributeError):
                w = 1.0

            a, a_domain = head
            b, b_domain = tail

            # ConceptNet weights are unbounded but cluster around 1–3.
            # Squash so a heavily-attested edge outranks a lone one without
            # letting a single popular assertion dominate the whole graph.
            strength = scale * min(1.0, 0.45 + 0.28 * w)
            strength *= sense_scale(a, a_domain) * sense_scale(b, b_domain)
            link(a, b, rtype, strength)
            if symmetric:
                link(b, a, rtype, strength)

    return {k: dict(v) for k, v in edges.items()}, seen
