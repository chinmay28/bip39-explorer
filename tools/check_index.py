#!/usr/bin/env python3
"""Validate data/semantic-index.json against data/english.txt.

The index is generated, large, and consumed by a GUI that has no way to
complain — a neighbour pointing at index 5000 would simply render nothing.
This checks the invariants the GUI relies on, so a bad regeneration fails
here rather than in someone's browser.

    python3 tools/check_index.py

Exits non-zero on the first category of failure, printing every instance.
"""

import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
WORDLIST = REPO / "data" / "english.txt"
INDEX = REPO / "data" / "semantic-index.json"

# The published BIP-39 English list. Pinned here because every index built
# from a different list is silently wrong rather than loudly broken.
EXPECTED_SHA256 = "2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda"


def main():
    problems = []

    def require(condition, message):
        if not condition:
            problems.append(message)

    raw = WORDLIST.read_bytes()
    words = [w.strip() for w in raw.decode().splitlines() if w.strip()]
    require(len(words) == 2048, f"wordlist has {len(words)} words, expected 2048")
    require(len(set(words)) == len(words), "wordlist contains duplicates")
    digest = hashlib.sha256(raw).hexdigest()
    require(digest == EXPECTED_SHA256, f"wordlist sha256 is {digest}")

    index = json.loads(INDEX.read_text())
    require(index["schema"] == 1, f"unknown schema {index.get('schema')}")
    require(index["wordlist"]["sha256"] == digest,
            "index was built from a different wordlist than data/english.txt")

    entries = index["words"]
    require(len(entries) == len(words),
            f"index has {len(entries)} entries for {len(words)} words")

    known_relations = set(index["relations"])
    topic_ids = {t["id"] for t in index["topics"]}
    counts = Counter()

    for i, entry in enumerate(entries):
        where = f"words[{i}]"
        if i < len(words) and entry["w"] != words[i]:
            problems.append(f"{where}: {entry['w']!r} but wordlist has {words[i]!r}")
            continue
        if "t" in entry:
            require(entry["t"] in topic_ids, f"{where}: unknown topic {entry['t']}")

        seen = set()
        previous = 101
        for row in entry["n"]:
            require(len(row) == 4, f"{where}: malformed neighbour row {row}")
            target, relation, score, mask = row
            require(isinstance(target, int) and 0 <= target < len(words),
                    f"{where}: neighbour index {target} out of range")
            require(target != i, f"{where}: {entry['w']} is its own neighbour")
            require(target not in seen, f"{where}: duplicate neighbour {target}")
            require(relation in known_relations,
                    f"{where}: unknown relation {relation!r}")
            require(0 < score <= 100, f"{where}: score {score} out of range")
            require(score <= previous, f"{where}: neighbours are not ranked")
            require(1 <= mask <= 7, f"{where}: source mask {mask} out of range")
            seen.add(target)
            previous = score
            counts[relation] += 1

    for topic in index["topics"]:
        members = topic["members"]
        require(len(members) == topic["size"],
                f"topic {topic['label']}: size {topic['size']} but {len(members)} members")
        require(topic["label"] in members,
                f"topic {topic['label']}: label is not one of its members")
        for member in members:
            require(member in set(words), f"topic {topic['label']}: unknown word {member!r}")

    require(counts == Counter(index["stats"]["by_relation"]),
            "stats.by_relation does not match the edges in the file")

    if problems:
        print(f"{len(problems)} problem(s):", file=sys.stderr)
        for problem in problems[:40]:
            print(f"  {problem}", file=sys.stderr)
        if len(problems) > 40:
            print(f"  … and {len(problems) - 40} more", file=sys.stderr)
        return 1

    total = sum(counts.values())
    topics = len(index["topics"])
    print(f"ok — {len(entries)} words, {total} edges, {topics} topics, "
          f"{INDEX.stat().st_size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
