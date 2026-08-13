#!/usr/bin/env python3
"""Splice the semantic index into the Orbit prototype.

    python3 tools/build_prototype.py

The prototype is one self-contained HTML file with the index inlined, so it
can be opened from disk, mailed to someone, or published without a server.
That costs a duplicated copy of the index in the repository, which is worth
it while this is a prototype and there is no build pipeline; the real client
will fetch `data/semantic-index.json` over HTTP instead.

Version follows CountRoster's scheme: vMAJOR.MINOR.<commit count>.
"""

import json
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
TEMPLATE = REPO / "docs" / "design" / "orbit.template.html"
INDEX = REPO / "data" / "semantic-index.json"
OUTPUT = REPO / "docs" / "design" / "orbit.html"

MAJOR, MINOR = 1, 0


def version():
    """vMAJOR.MINOR.<commit count>; patch 0 when git can't be trusted."""
    def git(*args):
        try:
            return subprocess.run(
                ["git", *args], cwd=REPO, capture_output=True, text=True, check=True
            ).stdout.strip()
        except (OSError, subprocess.CalledProcessError):
            return None

    if git("rev-parse", "--is-shallow-repository") == "true":
        print("  warning: shallow clone — reporting patch 0")
        return f"v{MAJOR}.{MINOR}.0"
    return f"v{MAJOR}.{MINOR}.{git('rev-list', '--count', 'HEAD') or '0'}"


def main():
    index = json.loads(INDEX.read_text())

    # Minified: this copy is for a parser, not a reader. The reviewable
    # copy is data/semantic-index.json. `</script>` cannot appear in a
    # wordlist, but escape the sequence anyway rather than rely on that.
    payload = json.dumps(index, separators=(",", ":")).replace("</", "<\\/")

    html = (TEMPLATE.read_text()
            .replace("__INDEX__", payload)
            .replace("__VERSION__", version()))
    OUTPUT.write_text(html)
    print(f"wrote {OUTPUT.relative_to(REPO)} — {OUTPUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
