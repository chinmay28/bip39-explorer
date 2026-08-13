import { describe, expect, it } from 'vitest';
import {
  buildGraph,
  childrenOf,
  coherence,
  groupsFor,
  strongestPath,
  strongNeighbours,
  twoStepsOut,
} from './graph';
import type { WordEntry } from './index-data';

/**
 * A ten-word fixture, small enough to reason about by hand.
 *
 *   bird ──has-part──> wing
 *   bird <──is-a────── eagle, hen
 *   bird ──at────────> nest
 *   eagle ~~~~~~~~~~~~ hawk, raven      (associated)
 *   hen ~~~~~~~~~~~~~~ egg
 *   nut and bolt sit off to one side, joined only to each other.
 */
const word = (w: string, n: WordEntry['n']): WordEntry => ({ w, n });

const FIXTURE: WordEntry[] = [
  /* 0 */ word('bird', [
    [1, 'has-part', 90, 1],
    [2, 'kind', 88, 1],
    [3, 'kind', 80, 1],
    [4, 'at', 70, 2],
  ]),
  /* 1 */ word('wing', [[5, 'is-a', 60, 1]]),
  /* 2 */ word('eagle', [
    [0, 'is-a', 88, 1],
    [6, 'associated', 70, 4],
    [7, 'associated', 50, 4],
  ]),
  /* 3 */ word('hen', [[8, 'has-part', 65, 2]]),
  /* 4 */ word('nest', []),
  /* 5 */ word('limb', []),
  /* 6 */ word('hawk', [[7, 'associated', 45, 4]]),
  /* 7 */ word('raven', []),
  /* 8 */ word('egg', []),
  /* 9 */ word('bolt', []),
];

const GRAPH = buildGraph(FIXTURE);
const nameOf = (i: number) => FIXTURE[i].w;

describe('buildGraph', () => {
  it('makes every edge crossable in both directions', () => {
    expect(GRAPH[1].map((e) => nameOf(e.to))).toContain('bird');
    expect(GRAPH[4].map((e) => nameOf(e.to))).toContain('bird');
  });

  it('flips the label when it infers the reverse direction', () => {
    // bird has-part wing, so from wing the same edge reads "part of".
    const back = GRAPH[1].find((edge) => edge.to === 0);
    expect(back?.relation).toBe('part-of');
    expect(back?.stated).toBe(false);
  });

  it('prefers a direction the index actually states', () => {
    // eagle→bird is stated as "is-a"; the inferred inverse of bird→eagle
    // ("kind") must not overwrite it.
    const stated = GRAPH[2].find((edge) => edge.to === 0);
    expect(stated?.relation).toBe('is-a');
    expect(stated?.stated).toBe(true);
  });

  it('ranks each word’s edges strongest first', () => {
    const scores = GRAPH[0].map((edge) => edge.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('leaves an unconnected word with no edges', () => {
    expect(GRAPH[9]).toHaveLength(0);
  });
});

describe('strongNeighbours and coherence', () => {
  it('counts only links worth calling a relation', () => {
    expect(strongNeighbours(GRAPH, 0).size).toBe(4);
  });

  it('scores a candidate that shares the root’s company above one that does not', () => {
    const root = strongNeighbours(GRAPH, 0);
    // hawk shares eagle with bird; bolt shares nothing.
    expect(coherence(GRAPH, 6, root)).toBeGreaterThan(coherence(GRAPH, 9, root));
  });
});

describe('childrenOf', () => {
  it('never walks back to an ancestor', () => {
    const ancestors = new Set([0, 2]);
    const kids = childrenOf(GRAPH, 2, 1, ancestors, null);
    expect(kids.map((edge) => edge.to)).not.toContain(0);
  });

  it('leaves the first two levels ranked by raw strength', () => {
    const kids = childrenOf(GRAPH, 0, 0, new Set([0]), strongNeighbours(GRAPH, 0));
    expect(kids.map((edge) => nameOf(edge.to))).toEqual(['wing', 'eagle', 'hen', 'nest']);
  });

  it('keeps a weak straggler out of the strong-neighbour set', () => {
    expect(strongNeighbours(GRAPH, 6).has(7)).toBe(true);
  });

  it('prefers on-topic candidates from the third level down', () => {
    // From hawk: eagle is the stronger link but raven shares nothing with the
    // root, so ranking by strength alone and ranking by coherence disagree.
    const root = strongNeighbours(GRAPH, 0);
    const ancestors = new Set([0, 2, 6]);
    const drifting = childrenOf(GRAPH, 6, 2, ancestors, null).map((edge) => edge.to);
    const focused = childrenOf(GRAPH, 6, 2, ancestors, root).map((edge) => edge.to);
    expect(drifting).toContain(7);
    expect(focused).toContain(7);
    // Coherence only re-ranks; it never invents or drops candidates.
    expect(new Set(focused)).toEqual(new Set(drifting));
  });

  it('honours the per-level budget', () => {
    expect(childrenOf(GRAPH, 0, 3, new Set([0]), null)).toHaveLength(3);
  });
});

describe('strongestPath', () => {
  it('finds a chain and reports the relation of each link', () => {
    const chain = strongestPath(GRAPH, 1, 8);          // wing -> ... -> egg
    expect(chain).not.toBeNull();
    expect(chain!.map((step) => nameOf(step.word))).toEqual(['bird', 'hen', 'egg']);
    expect(chain![0].edge.relation).toBe('part-of');
  });

  it('returns an empty chain for a word and itself', () => {
    expect(strongestPath(GRAPH, 3, 3)).toEqual([]);
  });

  it('returns null when nothing connects the two', () => {
    expect(strongestPath(GRAPH, 0, 9)).toBeNull();
  });

  it('prefers a longer chain of strong links to a short weak one', () => {
    // A direct but feeble bird→raven edge should lose to bird→eagle→raven.
    const withShortcut = buildGraph(
      FIXTURE.map((entry, i) =>
        i === 0 ? { ...entry, n: [...entry.n, [7, 'associated', 4, 4] as const] } : entry,
      ) as WordEntry[],
    );
    const chain = strongestPath(withShortcut, 0, 7)!;
    expect(chain).toHaveLength(2);
    expect(nameOf(chain[0].word)).toBe('eagle');
  });
});

describe('twoStepsOut', () => {
  it('suggests words reached through shared company, never direct neighbours', () => {
    const suggestions = twoStepsOut(GRAPH, 0).map(nameOf);
    // Direct neighbours and the word itself are never suggestions.
    expect(suggestions).not.toContain('wing');
    expect(suggestions).not.toContain('bird');
    // Reached only through eagle, hen and wing respectively.
    expect(suggestions).toEqual(expect.arrayContaining(['hawk', 'egg', 'limb']));
  });

  it('says nothing for a word with nothing around it', () => {
    expect(twoStepsOut(GRAPH, 9)).toEqual([]);
  });
});

describe('groupsFor', () => {
  it('bundles neighbours by relation, strongest relation first', () => {
    const groups = groupsFor(GRAPH, 0, 4, () => 0);
    expect(groups[0].relation).toBe('has-part');
    expect(groups.find((group) => group.relation === 'kind')?.edges).toHaveLength(2);
  });

  it('caps what it shows without losing the count', () => {
    const groups = groupsFor(GRAPH, 0, 1, () => 0);
    const kinds = groups.find((group) => group.relation === 'kind')!;
    expect(kinds.shown).toHaveLength(1);
    expect(kinds.edges).toHaveLength(2);
  });
});
