import type { LetterGroup, Hit } from '../lib/letters';
import { FAMILIES, FAMILY_LABEL } from '../lib/relations';
import { APP_VERSION } from '../version';

/**
 * The furniture around the three views: brand, search, trail, the letters
 * strip, the legend and the tab bar.
 */

export type ViewId = 'map' | 'tree' | 'path';

export const VIEWS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'map', label: 'Map', icon: 'M12 2v5m0 10v5M2 12h5m10 0h5M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' },
  { id: 'tree', label: 'Tree', icon: 'M4 4v11a2 2 0 0 0 2 2h4M4 8h6M10 19h10M10 15h10M10 11h10' },
  { id: 'path', label: 'Path', icon: 'M5 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm14 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 7h6a3 3 0 0 1 3 3v5' },
];

export function Header({
  view, onView, showNav,
}: { view: ViewId; onView: (v: ViewId) => void; showNav: boolean }) {
  return (
    <header className="app__header">
      <div className="brand">
        <svg className="brand__logo" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="7" fill="#4ecdc4" />
          <g fill="#06403b">
            <rect x="6" y="9" width="12" height="2.6" rx="1.3" />
            <rect x="6" y="14.7" width="20" height="2.6" rx="1.3" />
            <rect x="6" y="20.4" width="8" height="2.6" rx="1.3" />
          </g>
        </svg>
        <span className="brand__text">
          <span className="brand__name">bip39 explorer</span>
          <span className="brand__version">{APP_VERSION}</span>
        </span>
      </div>
      {showNav && (
      <nav className="app__nav" aria-label="View">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={view === item.id}
            onClick={() => onView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      )}
      <p className="app__offline">
        No network calls, ever.<br />Never type a real seed phrase.
      </p>
    </header>
  );
}

export function TabBar({ view, onView }: { view: ViewId; onView: (v: ViewId) => void }) {
  return (
    <nav className="tab-bar" aria-label="View">
      {VIEWS.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-current={view === item.id}
          onClick={() => onView(item.id)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={item.icon} />
          </svg>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export interface SearchProps {
  query: string;
  hits: Hit[];
  limit: number;
  onQuery: (value: string) => void;
  onSelect: (word: string) => void;
  onSubmit: () => void;
}

export function Search({ query, hits, limit, onQuery, onSelect, onSubmit }: SearchProps) {
  const normalised = query.toLowerCase().replace(/[^a-z]/g, '');
  return (
    <>
      <div className="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={query}
          placeholder="search 2048 words"
          spellCheck={false}
          autoComplete="off"
          enterKeyHint="go"
          aria-label="Search the BIP-39 word list"
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSubmit();
              (event.target as HTMLInputElement).blur();
            }
          }}
        />
        <span className="search__count">
          {query ? `${hits.length} / 2048` : '2048 words'}
        </span>
      </div>
      <div className="hits">
        {query && hits.length === 0 && (
          <span className="muted-line">Nothing matches. Try fewer letters.</span>
        )}
        {query &&
          hits.slice(0, limit).map((hit) => {
            const at = hit.word.indexOf(normalised);
            return (
              <button key={hit.word} type="button" className="hit" onClick={() => onSelect(hit.word)}>
                {at < 0 ? (
                  hit.word
                ) : (
                  <>
                    {hit.word.slice(0, at)}
                    <mark>{hit.word.slice(at, at + normalised.length)}</mark>
                    {hit.word.slice(at + normalised.length)}
                  </>
                )}
                <em>{hit.why}</em>
              </button>
            );
          })}
        {query && hits.length > limit && (
          <span className="muted-line">+{hits.length - limit} more</span>
        )}
      </div>
    </>
  );
}

export function Trail({
  trail, words, onStep,
}: { trail: number[]; words: readonly string[]; onStep: (position: number) => void }) {
  return (
    <nav className="trail" aria-label="Words visited">
      <span className="trail__label">Trail</span>
      {trail.map((index, position) => (
        <span key={`${index}-${position}`} style={{ display: 'contents' }}>
          {position > 0 && <span aria-hidden="true">›</span>}
          <button type="button" onClick={() => onStep(position)}>{words[index]}</button>
        </span>
      ))}
    </nav>
  );
}

export function Letters({
  groups, onSelect,
}: { groups: LetterGroup[]; onSelect: (word: string) => void }) {
  return (
    <section className="letters">
      <div className="card__sub">Letters and sound — computed live, not from the index</div>
      {groups.length === 0 && (
        <div className="letters__kind">Nothing in the list looks or sounds like this one.</div>
      )}
      {groups.map((group) => (
        <div className="letters__row" key={group.kind}>
          <span className="letters__kind">{group.kind}</span>
          <span className="pill-row">
            {group.words.slice(0, 18).map((word) => (
              <button key={word} type="button" className="pill" onClick={() => onSelect(word)}>
                {word}
              </button>
            ))}
            {group.words.length > 18 && (
              <span className="letters__kind">+{group.words.length - 18}</span>
            )}
          </span>
        </div>
      ))}
    </section>
  );
}

export function Legend() {
  return (
    <div className="legend">
      {FAMILIES.map((family) => (
        <span
          key={family}
          style={{ color: `var(--fam-${family})`, background: `var(--fam-${family}-bg)` }}
        >
          {FAMILY_LABEL[family]}
        </span>
      ))}
    </div>
  );
}

export function Footnote({ sha, links, perWord }: { sha: string; links: number; perWord: string }) {
  return (
    <footer className="foot">
      <p>
        <b>Everything here runs offline.</b> The relation graph is precomputed — WordNet 3.0,
        ConceptNet 5.7 and ConceptNet Numberbatch 19.08, fused into{' '}
        <code>data/semantic-index.json</code> and committed. Walking it to any depth, finding the
        strongest path between two words, ranking two-step neighbours, and all the letter and
        sound matching happen in this page. No server, no model, no network request.
      </p>
      <p>
        Word list <code>bip-0039/english.txt</code>, 2048 words, sha256 <code>{sha.slice(0, 8)}…</code>.{' '}
        {links} undirected links, {perWord} per word. Semantic index CC BY-SA 4.0 after ConceptNet.
      </p>
    </footer>
  );
}
