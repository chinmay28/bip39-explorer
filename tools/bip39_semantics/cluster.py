"""Find the wordlist's own topics instead of imposing ours.

An earlier draft of this project shipped forty hand-written topics — animal,
colour, money — which is fine until you notice it is one person's taxonomy
and that it silently leaves two thirds of the list untagged.

Louvain community detection over the fused graph asks the list instead: which
words does this graph actually bunch together? The answer comes out as
communities of genuinely varying shape — a tight cluster of kitchen words, a
sprawling one around motion and travel — and every word that has any semantic
edge at all lands in one.

Communities are named after their most central member, which reads better
than a number and is nearly always the word a person would have chosen:
food, animal, emotion, payment, illness, weapon. A variant that preferred
each community's category word — whatever its members point at with "is a
kind of" — was tried and dropped: it renamed the payment cluster "acquire"
and the body cluster "organ", which is more precise and less recognisable.
Getting the resolution right did the work instead.
"""

import networkx as nx

# Below this, an edge is a weak associative hunch. Including such edges in
# the clustering blurs communities into one another.
EDGE_FLOOR = 0.30

# A word joins a community only if it is really held there. "satoshi" has
# exactly one semantic edge in the whole list (to "coin"); calling it a
# member of the metals topic on that basis is a guess dressed as a fact.
JOIN_FLOOR = 0.36

# Louvain's knob. Above 1.0 favours more, smaller communities; the wordlist
# is small and broad, and the default produced a handful of giant blobs.
RESOLUTION = 4.0


def build(words, fused, floor=EDGE_FLOOR, resolution=RESOLUTION, seed=39):
    graph = nx.Graph()
    graph.add_nodes_from(words)
    for (a, b), (score, _rtype, _mask) in fused.items():
        if score < floor:
            continue
        existing = graph.get_edge_data(a, b, default={"weight": 0.0})["weight"]
        if score > existing:
            graph.add_edge(a, b, weight=score)

    communities = nx.community.louvain_communities(
        graph, weight="weight", resolution=resolution, seed=seed
    )

    topics = []
    assignment = {}
    for community in communities:
        community = set(community)
        centrality = {
            w: sum(d["weight"] for n, d in graph[w].items() if n in community)
            for w in community
        }
        held = {
            w for w in community
            if max((d["weight"] for n, d in graph[w].items() if n in community),
                   default=0.0) >= JOIN_FLOOR
        }
        if len(held) < 3:
            continue                       # a pair is not a topic

        ordered = sorted(held, key=lambda w: (-centrality[w], w))
        topic_id = len(topics)
        topics.append({
            "id": topic_id,
            "label": ordered[0],
            "signature": ordered[:4],
            "size": len(held),
            "members": sorted(held),
        })
        for w in held:
            assignment[w] = topic_id

    # Largest first, so topic 0 is the list's dominant theme; renumber to
    # match, since the ids are what the GUI stores.
    order = sorted(range(len(topics)), key=lambda i: -topics[i]["size"])
    remap = {old: new for new, old in enumerate(order)}
    topics = [topics[old] for old in order]
    for i, topic in enumerate(topics):
        topic["id"] = i

    return topics, {w: remap[t] for w, t in assignment.items()}
