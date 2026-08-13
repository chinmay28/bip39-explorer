import type { Graph } from '../lib/graph';
import { twoStepsOut } from '../lib/graph';
import { ENTRIES, TOPICS } from '../lib/index-data';
import { partOfSpeech, toBits, toHex } from '../lib/bits';

/**
 * What is known about the word itself: its definition, its place in the list,
 * its topic, and the words the graph reaches indirectly.
 *
 * The bits stop at the word. Index, hex and its eleven bits are the whole of
 * the entropy story this app tells — anything phrase-level would mean a field
 * people put real words into, and there is deliberately nowhere to do that.
 */
export interface WordCardProps {
  graph: Graph;
  words: readonly string[];
  index: number;
  onSelect: (index: number) => void;
}

export function WordCard({ graph, words, index, onSelect }: WordCardProps) {
  const entry = ENTRIES[index];
  const word = words[index];
  const topic = entry.t !== undefined ? TOPICS[entry.t] : null;
  const alsoSee = twoStepsOut(graph, index);
  const pos = partOfSpeech(entry.p);

  return (
    <aside className="card">
      <div className="card__word">{word}</div>
      {entry.g ? (
        <p className="card__gloss">{entry.g}</p>
      ) : (
        <p className="card__gloss" style={{ color: 'var(--muted)' }}>
          No dictionary entry — this word postdates every source corpus.
        </p>
      )}

      <dl className="card__facts">
        <dt>index</dt><dd>{index} of 2047</dd>
        <dt>11 bits</dt><dd>{toBits(index)}</dd>
        <dt>hex</dt><dd>{toHex(index)}</dd>
        <dt>prefix</dt><dd>{word.slice(0, 4)}</dd>
        {pos && (<><dt>part</dt><dd>{pos}</dd></>)}
        <dt>links</dt><dd>{graph[index].length}</dd>
      </dl>

      {topic && (
        <button
          type="button"
          className="card__topic"
          onClick={() => onSelect(words.indexOf(topic.label))}
        >
          topic · {topic.label} · {topic.size}
        </button>
      )}

      {alsoSee.length > 0 && (
        <div>
          <div className="card__sub">Two steps out</div>
          <div className="pill-row" style={{ marginTop: '0.35rem' }}>
            {alsoSee.map((other) => (
              <button key={other} type="button" className="pill" onClick={() => onSelect(other)}>
                {words[other]}
              </button>
            ))}
          </div>
          <p className="card__gloss" style={{ color: 'var(--muted)', fontSize: '0.72rem', margin: '0.35rem 0 0' }}>
            Not linked to {word} directly — reached through the company they share.
          </p>
        </div>
      )}

      <p className="card__gloss" style={{ color: 'var(--muted)', fontSize: '0.72rem', margin: 0 }}>
        No other word in the list begins{' '}
        <span style={{ fontFamily: 'var(--mono)' }}>{word.slice(0, 4)}</span>.
      </p>
      <p className="card__gloss" style={{ color: 'var(--muted)', fontSize: '0.72rem', margin: 0 }}>
        Never type a real seed phrase into anything.
      </p>
    </aside>
  );
}
