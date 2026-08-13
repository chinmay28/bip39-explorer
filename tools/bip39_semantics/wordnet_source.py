"""WordNet edges: the precise, hand-curated half of the index.

WordNet knows that a salmon is a fish, that a wing is part of a bird, and
that "arrive" is the opposite of "depart". Those are the edges worth putting
a label on in the UI, so this source is treated as the most trustworthy of
the three even though it is also the narrowest.

Three decisions shape everything here.

**Every sense counts, but not equally.** A BIP-39 word like "spring" has nine
senses and we have no context to disambiguate with — the user typed one word.
Discarding all but the first sense would lose "spring → summer"; keeping them
flat gives you "bird → girl", because one of bird's senses is British slang.
So each sense is damped by how often it is actually the meaning: WordNet
carries sense-tagged frequency counts, and bird-the-animal outscores
bird-the-woman 29 to 0. Where the counts are all zero — true of "crane",
whose useful senses are simply rare in the tagged corpus — the senses share
the weight and only mild rank damping separates them.

**Both ends of an edge are damped, not just one.** This is the subtle one.
"bird" is a rare synonym for "girl", but "girl" is a *common* word for a
girl, so damping only the sense we happen to be iterating from lets the
common end smuggle the rare pairing back in at full strength. An edge is
scaled by the sense weight of the word at each end, so a pair is only strong
when both words are usually being used that way.

**Named entities are dropped.** WordNet's first two senses of "crane" are
Stephen Crane and Hart Crane, which would make a word explorer announce that
crane is a kind of author. Instance synsets are skipped outright, for edges
and for the definition shown in the UI.

The definition shown gets one extra step, in `choose_glosses` — see there.
"""

import math
from collections import defaultdict

# Parent categories so broad that sharing one says nothing. Descending from
# these produces "cat is like cousin, both being organisms" — technically
# true, useless on a diagram.
TOO_BROAD = {
    "entity.n.01", "physical_entity.n.01", "abstraction.n.06", "object.n.01",
    "whole.n.02", "thing.n.12", "causal_agent.n.01", "matter.n.03",
    "psychological_feature.n.01", "attribute.n.02", "group.n.01",
    "relation.n.01", "measure.n.02", "event.n.01", "state.n.02",
    "artifact.n.01", "act.n.02", "cognition.n.01", "communication.n.02",
    "person.n.01", "organism.n.01", "living_thing.n.01", "unit.n.06",
    # The verb equivalents. WordNet roots most verbs at one of these, and
    # several of them ("change", "alter", "move", "act") are themselves
    # BIP-39 words — so without this, "dizzy" leads with "is a kind of
    # alter" and half the verbs in the list point at each other.
    "change.v.01", "change.v.02", "alter.v.01", "move.v.01", "move.v.02",
    "move.v.03", "act.v.01", "be.v.01", "have.v.01", "make.v.03",
    "cause.v.01", "create.v.01", "travel.v.01", "interact.v.01",
    "think.v.03", "communicate.v.02", "express.v.02", "transfer.v.05",
    "give.v.03", "get.v.01", "use.v.01", "affect.v.01", "happen.v.01",
}

MAX_SIBLING_FAMILY = 60

# A sense this much rarer than the word's dominant sense still contributes,
# but only enough to surface when nothing better exists.
RARE_SENSE_FLOOR = 0.08

# WordNet's sense counts come from a small tagged corpus, and most of this
# wordlist scores zero across every sense. Below this many observations the
# counts are noise, not frequency — "crane" is tagged twice as a verb and
# never as the machine, which does not make craning your neck the dominant
# sense. Under the threshold, senses are separated by WordNet's own ordering
# alone.
MIN_TRUSTED_COUNT = 3


def _usable_senses(word, wordnet):
    """Synsets worth mining, in order, each with a weight in (0, 1].

    Named-entity senses are dropped. The rest are weighted by their
    sense-tagged frequency relative to the word's most common sense, with a
    light rank penalty — which is the only signal when the corpus has too
    little to say.
    """
    senses = [s for s in wordnet.synsets(word) if not s.instance_hypernyms()]
    if not senses:
        return []

    counts = []
    for syn in senses:
        matching = [
            l for l in syn.lemmas()
            if l.name().lower().replace("_", " ") == word
        ]
        counts.append(matching[0].count() if matching else 0)

    top = max(counts)
    trusted = top >= MIN_TRUSTED_COUNT
    weighted = []
    for rank, (syn, count) in enumerate(zip(senses, counts)):
        frequency = (count + 1.0) / (top + 1.0) if trusted else 1.0
        weight = max(RARE_SENSE_FLOOR, frequency) / (1.0 + 0.25 * rank)
        weighted.append((syn, weight))
    return weighted


def choose_glosses(senses, neighbours):
    """Pick the definition to show for each word.

    WordNet's first sense of "shrimp" is "disparaging terms for small
    people", which is a poor caption for a word the finished index has
    sitting next to lobster, tuna and oyster. WordNet's own frequency data
    cannot fix that — every sense of "shrimp" is tagged zero times.

    So the choice is made against the answer instead of before it: each
    sense knows which other list words it is lexically related to, and the
    finished index knows which words this one actually ended up beside. The
    sense with the most overlap is the one this vocabulary is about. Ties,
    and words whose senses all miss, fall back to the sense weight.

    senses:     {word: [(synset, weight, related-words set)]}
    neighbours: {word: [neighbouring word, ...]} from the fused index
    """
    # A nudge, not a rule: where two senses explain the neighbourhood
    # equally well, the noun is usually the one a reader pictures. Enough to
    # caption "trumpet" as the instrument rather than the act of blowing
    # one; not enough to misfile the many BIP-39 words that are verbs first.
    part_of_speech_nudge = {"n": 1.0, "v": 0.9, "a": 0.86, "s": 0.86, "r": 0.86}

    meta = {}
    for word, options in senses.items():
        # Matching the word's strongest neighbour counts for more than
        # matching its twentieth: "trumpet" the instrument and "trumpet" the
        # verb both reach horn and drum, and only the ordering separates
        # them.
        company = {
            other: 1.0 / (1.0 + rank)
            for rank, other in enumerate(neighbours.get(word, ()))
        }

        def fit(option):
            synset, weight, reach = option
            nudge = part_of_speech_nudge.get(synset.pos(), 0.9)
            overlap = sum(company.get(other, 0.0) for other in reach)
            return (overlap * (0.5 + weight) * nudge, weight * nudge)

        best = max(options, key=fit)
        synset = best[0]
        meta[word] = {
            "gloss": synset.definition(),
            "pos": synset.pos(),
            "domains": sorted({s.lexname() for s, _w, _c in options[:4]}),
        }
    return meta


def extract(words, wordnet):
    """Return (edges, senses, domain_weights).

    edges:   {(a, b): {type: weight}} — directed; relations with a direction
             emit both sides (is-a / kind, part-of / has-part).
    senses:  {word: [(synset, weight, in-vocabulary related words)]} — fed to
             `choose_glosses` once the index is complete.
    domain_weights: {(word, short lexical domain): weight} — how much of a
             word's usage lives in each WordNet domain. The ConceptNet source
             reuses this to interpret sense-tagged URIs.
    """
    vocab = set(words)

    # Pass one: every word's sense weights, so an edge can be damped from
    # both ends rather than only the end we are iterating from.
    senses_of = {}
    sense_weight = {}
    domain_weights = defaultdict(float)
    for word in words:
        senses = _usable_senses(word, wordnet)
        if not senses:
            continue
        senses_of[word] = senses
        for syn, weight in senses:
            sense_weight[(word, syn.name())] = weight
            short = syn.lexname().split(".", 1)[-1]
            if weight > domain_weights[(word, short)]:
                domain_weights[(word, short)] = weight

    def weight_of(word, synset):
        """How much of `word`'s usage this synset accounts for."""
        return sense_weight.get((word, synset.name()), RARE_SENSE_FLOOR)

    edges = defaultdict(lambda: defaultdict(float))

    # Which other list words each sense reaches. `choose_glosses` matches
    # these against the finished index to caption each word correctly.
    company = defaultdict(set)
    current = None                          # (word, synset name) being mined

    def link(a, b, rtype, weight):
        if a == b or weight <= 0.0:
            return
        company[current].add(b if a == current[0] else a)
        if weight > edges[(a, b)][rtype]:
            edges[(a, b)][rtype] = weight

    def others(synset):
        """In-vocabulary lemmas of a synset, paired with their sense weight
        for that synset."""
        for name in synset.lemma_names():
            other = name.replace("_", " ")
            if other in vocab:
                yield other, weight_of(other, synset)

    for word, senses in senses_of.items():
        for syn, here in senses:
            current = (word, syn.name())
            for other, there in others(syn):
                link(word, other, "synonym", 1.00 * here * there)

            # Direct hypernyms, then grandparents at a discount.
            for hyper in syn.hypernyms():
                if hyper.name() in TOO_BROAD:
                    continue
                for other, there in others(hyper):
                    link(word, other, "is-a", 0.92 * here * there)
                    link(other, word, "kind", 0.90 * here * there)
                for grand in hyper.hypernyms():
                    if grand.name() in TOO_BROAD:
                        continue
                    for other, there in others(grand):
                        link(word, other, "is-a", 0.62 * here * there)
                        link(other, word, "kind", 0.60 * here * there)

            # Guarded on both sides: descending *from* an over-broad
            # category is as uninformative as climbing to one, and it is the
            # direction that produced "dizzy is a kind of alter" — emitted
            # while mining `alter`, not `dizzy`.
            for hypo in ([] if syn.name() in TOO_BROAD else syn.hyponyms()):
                for other, there in others(hypo):
                    link(word, other, "kind", 0.90 * here * there)
                    link(other, word, "is-a", 0.92 * here * there)

            for holo in syn.part_holonyms() + syn.member_holonyms():
                for other, there in others(holo):
                    link(word, other, "part-of", 0.84 * here * there)
                    link(other, word, "has-part", 0.82 * here * there)
            for mero in syn.part_meronyms() + syn.member_meronyms():
                for other, there in others(mero):
                    link(word, other, "has-part", 0.82 * here * there)
                    link(other, word, "part-of", 0.84 * here * there)
            for sub in syn.substance_meronyms():
                for other, there in others(sub):
                    link(word, other, "made-of", 0.80 * here * there)

            for sim in syn.similar_tos():
                for other, there in others(sim):
                    link(word, other, "similar", 0.74 * here * there)
                    link(other, word, "similar", 0.74 * here * there)

            for lemma in syn.lemmas():
                if lemma.name().lower().replace("_", " ") != word:
                    continue
                for ant in lemma.antonyms():
                    other = ant.name().replace("_", " ")
                    if other in vocab:
                        there = weight_of(other, ant.synset())
                        link(word, other, "opposite", 0.96 * here * there)
                        link(other, word, "opposite", 0.96 * here * there)
                for der in lemma.derivationally_related_forms():
                    other = der.name().replace("_", " ")
                    if other in vocab:
                        there = weight_of(other, der.synset())
                        link(word, other, "derived", 0.70 * here * there)
                        link(other, word, "derived", 0.70 * here * there)
                for pert in lemma.pertainyms():
                    other = pert.name().replace("_", " ")
                    if other in vocab:
                        there = weight_of(other, pert.synset())
                        link(word, other, "derived", 0.68 * here * there)

            # Co-hyponyms, damped by how crowded the family is.
            for hyper in syn.hypernyms():
                if hyper.name() in TOO_BROAD:
                    continue
                family = hyper.hyponyms()
                if len(family) > MAX_SIBLING_FAMILY:
                    continue
                crowd = 1.0 / math.log2(len(family) + 2)
                for sib in family:
                    for other, there in others(sib):
                        link(word, other, "sibling", 0.78 * here * there * crowd)

    annotated = {
        word: [(syn, w, company[(word, syn.name())]) for syn, w in senses]
        for word, senses in senses_of.items()
    }

    return (
        {k: dict(v) for k, v in edges.items()},
        annotated,
        dict(domain_weights),
    )
