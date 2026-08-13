import { useMemo } from 'react';
import type { Edge, Graph } from '../lib/graph';
import { childrenOf, strongNeighbours } from '../lib/graph';
import { familyOf } from '../lib/relations';
import { relationLabel } from '../lib/index-data';

/**
 * The same graph, unrolled as far down as you care to go.
 *
 * The map answers "what is around this word"; the tree answers "and what is
 * around those". It is also the view that works on a narrow screen, which is
 * why a phone opens on it.
 */

const MAX_ROWS = 400;
const DEPTHS = [1, 2, 3, 4];

export interface TreeRow {
  index: number;
  depth: number;
  /** Path from the root, so the same word can be open in one branch and shut in another. */
  key: string;
  edge: Edge | null;
  open: boolean;
  leaf: boolean;
}

export function buildRows(
  graph: Graph,
  root: number,
  unfolded: ReadonlySet<string>,
  coherent: boolean,
): { rows: TreeRow[]; truncated: boolean } {
  const rows: TreeRow[] = [];
  const rootSet = coherent ? strongNeighbours(graph, root) : null;
  let truncated = false;

  const walk = (index: number, depth: number, path: string, ancestors: ReadonlySet<number>, edge: Edge | null) => {
    if (rows.length >= MAX_ROWS) {
      truncated = true;
      return;
    }
    const key = `${path}/${index}`;
    const next = new Set(ancestors).add(index);
    const children = childrenOf(graph, index, depth, next, rootSet);
    const open = unfolded.has(key) && children.length > 0;
    rows.push({ index, depth, key, edge, open, leaf: children.length === 0 });
    if (!open) return;
    for (const child of children) walk(child.to, depth + 1, key, next, child);
  };

  walk(root, 0, '', new Set(), null);
  return { rows, truncated };
}

/** Every branch that should be open to show the tree `depth` levels deep. */
export function keysToDepth(graph: Graph, root: number, depth: number, coherent: boolean): Set<string> {
  const keys = new Set<string>();
  const rootSet = coherent ? strongNeighbours(graph, root) : null;

  const walk = (index: number, level: number, path: string, ancestors: ReadonlySet<number>) => {
    if (level >= depth) return;
    const key = `${path}/${index}`;
    keys.add(key);
    const next = new Set(ancestors).add(index);
    for (const edge of childrenOf(graph, index, level, next, rootSet)) {
      walk(edge.to, level + 1, key, next);
    }
  };

  walk(root, 0, '', new Set());
  return keys;
}

export interface TreeProps {
  graph: Graph;
  words: readonly string[];
  index: number;
  depth: number;
  coherent: boolean;
  unfolded: ReadonlySet<string>;
  onSelect: (index: number) => void;
  onToggleFold: (key: string) => void;
  onSetDepth: (depth: number) => void;
  onToggleCoherent: () => void;
}

export function Tree({
  graph, words, index, depth, coherent, unfolded,
  onSelect, onToggleFold, onSetDepth, onToggleCoherent,
}: TreeProps) {
  const { rows, truncated } = useMemo(
    () => buildRows(graph, index, unfolded, coherent),
    [graph, index, unfolded, coherent],
  );

  return (
    <div className="panel">
      <div className="panel__bar">
        <span className="panel__title">Tree</span>
        <span className="chipset">
          {DEPTHS.map((d) => (
            <button key={d} type="button" aria-pressed={depth === d} onClick={() => onSetDepth(d)}>
              {d} deep
            </button>
          ))}
          <button
            type="button"
            className="toggle"
            aria-pressed={coherent}
            title={`Rank levels three and deeper by how well they stay in ${words[index]}’s world`}
            onClick={onToggleCoherent}
          >
            stay on topic
          </button>
        </span>
      </div>

      <div className="tree">
        {rows.map((row) => {
          const relation = row.edge?.relation ?? null;
          const family = relation ? familyOf(relation) : 'identity';
          const label = relation ? relationLabel(relation) : 'you are here';
          const score = row.edge?.score ?? 100;
          const word = words[row.index];
          return (
            <div
              key={row.key}
              className={`tree__row${row.depth === 0 ? ' tree__row--current' : ''}`}
              style={{ paddingLeft: `${(0.4 + row.depth * 0.95).toFixed(2)}rem` }}
            >
              <span className="tree__rail" style={{ background: `var(--fam-${family})` }} />
              <button
                type="button"
                className="tree__caret"
                data-leaf={row.leaf}
                aria-expanded={row.open}
                aria-label={`${row.open ? 'Collapse' : 'Expand'} ${word}`}
                onClick={() => onToggleFold(row.key)}
              >
                {row.open ? '▾' : '▸'}
              </button>
              <button type="button" className="tree__word" onClick={() => onSelect(row.index)}>
                {word}
              </button>
              <span
                className="tree__rel"
                style={{ color: `var(--fam-${family})`, background: `var(--fam-${family}-bg)` }}
              >
                {label}
              </span>
              <span className="tree__meter" title={`strength ${score} of 100`}>
                <i style={{ width: `${score}%`, background: `var(--fam-${family})` }} />
              </span>
            </div>
          );
        })}
      </div>

      {truncated && (
        <p className="tree__note">
          Stopped at {MAX_ROWS} rows — fold a branch or re-centre to see further.
        </p>
      )}
      <p className="tree__note">
        Every branch keeps walking outward — a word never reappears inside its own subtree.{' '}
        {coherent ? (
          <>
            From the third level down, children are ranked by how much they still share with{' '}
            <b>{words[index]}</b>, so a branch does not quietly change the subject.
          </>
        ) : (
          'Every level is ranked by raw link strength, so deep branches drift.'
        )}{' '}
        Tap a word to make it the centre.
      </p>
    </div>
  );
}
