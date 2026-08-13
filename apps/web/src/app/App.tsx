import { useCallback, useEffect, useMemo, useState } from 'react';
import { AT, ENTRIES, INDEX, WORDS } from '../lib/index-data';
import { buildGraph } from '../lib/graph';
import { buildSoundGroups, letterNeighbours, searchWords } from '../lib/letters';
import { Orbit } from '../components/Orbit';
import { Tree, keysToDepth } from '../components/Tree';
import { PathFinder } from '../components/PathFinder';
import { WordCard } from '../components/WordCard';
import { Footnote, Header, Legend, Letters, Search, TabBar, Trail } from '../components/Chrome';
import type { ViewId } from '../components/Chrome';

/**
 * The whole application state, which is small enough to be honest about:
 * where you are, how you got here, which view you are in, and what you have
 * unfolded. Everything else is derived.
 *
 * The graph and the sound groups are built once, at module scope, because
 * they are functions of the committed index and nothing else — rebuilding
 * them per render would be the only slow thing in the app.
 */
const GRAPH = buildGraph(ENTRIES);
const SOUND_GROUPS = buildSoundGroups(WORDS);
const LINK_COUNT = GRAPH.reduce((total, list) => total + list.length, 0) / 2;
const LINKS_PER_WORD = (
  GRAPH.reduce((total, list) => total + list.length, 0) / WORDS.length
).toFixed(1);

const START = AT.get('bird') ?? 0;
const TRAIL_LIMIT = 12;

/** Is the viewport narrow enough to want the portrait layout? */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(max-width: 700px)');
    const update = () => setNarrow(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return narrow;
}

export function App() {
  const narrow = useNarrow();
  const [word, setWord] = useState(START);
  // A phone opens on Tree: the map wants width, the tree wants a column.
  const [view, setView] = useState<ViewId>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches ? 'tree' : 'map',
  );
  const [trail, setTrail] = useState<number[]>([START]);
  const [query, setQuery] = useState('');
  const [opened, setOpened] = useState<ReadonlySet<number>>(new Set());
  const [depth, setDepth] = useState(2);
  const [coherent, setCoherent] = useState(true);
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(() =>
    keysToDepth(GRAPH, START, 2, true),
  );

  const search = useCallback(
    (value: string) => searchWords(WORDS, SOUND_GROUPS, value),
    [],
  );
  const hits = useMemo(() => search(query), [search, query]);
  const letters = useMemo(
    () => letterNeighbours(WORDS, SOUND_GROUPS, WORDS[word]),
    [word],
  );

  /** Moving to a word resets what was opened around the previous one. */
  const goTo = useCallback(
    (next: number, options?: { fromTrail?: boolean }) => {
      if (next === word || next < 0) return;
      setWord(next);
      setOpened(new Set());
      setUnfolded(keysToDepth(GRAPH, next, depth, coherent));
      if (!options?.fromTrail) {
        setTrail((current) => {
          const grown = [...current, next];
          return grown.length > TRAIL_LIMIT ? grown.slice(grown.length - TRAIL_LIMIT) : grown;
        });
      }
    },
    [word, depth, coherent],
  );

  const goToWord = useCallback(
    (name: string) => {
      const index = AT.get(name);
      if (index !== undefined) goTo(index);
    },
    [goTo],
  );

  const stepTrail = useCallback(
    (position: number) => {
      const target = trail[position];
      setTrail(trail.slice(0, position + 1));
      if (target !== word) goTo(target, { fromTrail: true });
    },
    [trail, word, goTo],
  );

  const toggleOpen = useCallback((index: number) => {
    setOpened((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const toggleFold = useCallback((key: string) => {
    setUnfolded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const applyDepth = useCallback(
    (next: number) => {
      setDepth(next);
      setUnfolded(keysToDepth(GRAPH, word, next, coherent));
    },
    [word, coherent],
  );

  const toggleCoherent = useCallback(() => {
    const next = !coherent;
    setCoherent(next);
    setUnfolded(keysToDepth(GRAPH, word, depth, next));
  }, [coherent, word, depth]);

  return (
    <>
      <div className="app">
        <Header view={view} onView={setView} showNav={!narrow} />

        <Search
          query={query}
          hits={hits}
          limit={narrow ? 12 : 20}
          onQuery={setQuery}
          onSelect={goToWord}
          onSubmit={() => {
            const first = hits[0];
            if (first) goToWord(first.word);
          }}
        />

        <Trail trail={trail} words={WORDS} onStep={stepTrail} />

        <div className="split">
          {view === 'map' && (
            <Orbit
              graph={GRAPH}
              words={WORDS}
              index={word}
              narrow={narrow}
              opened={opened}
              coherent={coherent}
              onSelect={goTo}
              onToggleOpen={toggleOpen}
            />
          )}
          {view === 'tree' && (
            <Tree
              graph={GRAPH}
              words={WORDS}
              index={word}
              depth={depth}
              coherent={coherent}
              unfolded={unfolded}
              onSelect={goTo}
              onToggleFold={toggleFold}
              onSetDepth={applyDepth}
              onToggleCoherent={toggleCoherent}
            />
          )}
          {view === 'path' && (
            <PathFinder
              graph={GRAPH}
              words={WORDS}
              at={AT}
              from={word}
              search={search}
              onSelect={goTo}
            />
          )}

          <WordCard graph={GRAPH} words={WORDS} index={word} onSelect={goTo} />
        </div>

        <Letters groups={letters} onSelect={goToWord} />
        <Legend />
        <Footnote sha={INDEX.wordlist.sha256} links={LINK_COUNT} perWord={LINKS_PER_WORD} />
      </div>

      {narrow && <TabBar view={view} onView={setView} />}
    </>
  );
}
