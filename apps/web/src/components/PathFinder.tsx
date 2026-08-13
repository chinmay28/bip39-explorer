import { useMemo, useState } from 'react';
import type { Graph } from '../lib/graph';
import { strongestPath } from '../lib/graph';
import { familyOf } from '../lib/relations';
import { relationLabel, sourceName } from '../lib/index-data';
import { normalise } from '../lib/letters';
import type { Hit } from '../lib/letters';

/**
 * How any two of the 2048 are connected.
 *
 * The most convincing evidence that the graph is worth having: pick two words
 * with nothing obvious between them and the app produces a chain of stated
 * relations joining them, usually in two or three steps.
 */
export interface PathFinderProps {
  graph: Graph;
  words: readonly string[];
  at: ReadonlyMap<string, number>;
  from: number;
  search: (query: string) => Hit[];
  onSelect: (index: number) => void;
}

export function PathFinder({ graph, words, at, from, search, onSelect }: PathFinderProps) {
  const [draft, setDraft] = useState('');
  const [target, setTarget] = useState('');

  const suggestion = words[(from * 7919 + 101) % words.length];
  const normalised = normalise(target);

  const result = useMemo(() => {
    if (!normalised) return { kind: 'idle' as const };
    const to = at.get(normalised);
    if (to === undefined) {
      return { kind: 'unknown' as const, nearest: search(normalised)[0]?.word ?? null };
    }
    if (to === from) return { kind: 'same' as const };
    const chain = strongestPath(graph, from, to);
    if (!chain) return { kind: 'unreachable' as const };
    const strength = chain.reduce((total, step) => total * (step.edge.score / 100), 1);
    return { kind: 'chain' as const, chain, strength };
  }, [graph, at, from, normalised, search]);

  const choose = (word: string) => {
    setDraft(word);
    setTarget(word);
  };

  return (
    <div className="panel">
      <div className="panel__bar">
        <span className="panel__title">Path</span>
      </div>
      <div className="path">
        <form
          className="path__form"
          onSubmit={(event) => {
            event.preventDefault();
            setTarget(draft);
          }}
        >
          <span className="muted-line" style={{ fontFamily: 'var(--mono)' }}>{words[from]}</span>
          <span className="muted-line" aria-hidden="true">→</span>
          <input
            type="search"
            value={draft}
            placeholder="second word"
            spellCheck={false}
            autoComplete="off"
            enterKeyHint="go"
            aria-label="Second word"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button className="path__go" type="submit">Find</button>
        </form>

        {result.kind === 'idle' && (
          <p className="path__summary">
            Name a second word and the app finds the strongest chain of relations joining the
            two. Try{' '}
            <button type="button" className="pill" onClick={() => choose(suggestion)}>{suggestion}</button>.
          </p>
        )}

        {result.kind === 'unknown' && (
          <p className="path__summary">
            {normalised} is not in the list.
            {result.nearest && (
              <>
                {' '}Did you mean{' '}
                <button type="button" className="pill" onClick={() => choose(result.nearest!)}>
                  {result.nearest}
                </button>?
              </>
            )}
          </p>
        )}

        {result.kind === 'same' && (
          <p className="path__summary">That is the word you are standing on.</p>
        )}

        {result.kind === 'unreachable' && (
          <p className="path__summary">
            Nothing reaches {normalised} — it has no semantic links at all.
          </p>
        )}

        {result.kind === 'chain' && (
          <>
            <div className="path__chain">
              <button type="button" className="path__node" onClick={() => onSelect(from)}>
                <b>{words[from]}</b>
              </button>
              {result.chain.map((step) => {
                const family = familyOf(step.edge.relation);
                return (
                  <div key={step.word}>
                    <div className="path__link">
                      <span
                        className="tree__rel"
                        style={{ color: `var(--fam-${family})`, background: `var(--fam-${family}-bg)` }}
                      >
                        {relationLabel(step.edge.relation)}
                      </span>
                      <span>{step.edge.score}/100 · {sourceName(step.edge.mask)}</span>
                    </div>
                    <button type="button" className="path__node" onClick={() => onSelect(step.word)}>
                      <b>{words[step.word]}</b>
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="path__summary">
              {result.chain.length} step{result.chain.length === 1 ? '' : 's'}, combined strength{' '}
              {(result.strength * 100).toFixed(1)} of 100. Dijkstra over −log(strength), so a
              longer chain of certainties beats a short guess.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
