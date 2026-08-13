import { describe, expect, it } from 'vitest';
import { AT, ENTRIES, INDEX, TOPICS, WORDS, relationLabel, sourceName } from './index-data';
import { buildGraph } from './graph';
import { familyOf } from './relations';

/**
 * The index is generated, and tools/check_index.py validates it on the way
 * out. These are the client's own assumptions about it — the ones that would
 * fail silently in a browser rather than loudly in a build.
 */
describe('the committed index', () => {
  it('is the BIP-39 list, in order, at the expected size', () => {
    expect(WORDS).toHaveLength(2048);
    expect(WORDS[0]).toBe('abandon');
    expect(WORDS[2047]).toBe('zoo');
    expect(INDEX.wordlist.sha256).toBe(
      '2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda',
    );
  });

  it('has a unique four-letter prefix for every word', () => {
    // The app tells the user this outright, so it had better be true.
    expect(new Set(WORDS.map((word) => word.slice(0, 4))).size).toBe(2048);
  });

  it('indexes every word exactly once', () => {
    expect(AT.size).toBe(2048);
    expect(AT.get('bird')).toBe(WORDS.indexOf('bird'));
  });

  it('points every neighbour at a word that exists', () => {
    for (const entry of ENTRIES) {
      for (const [to, , score, mask] of entry.n) {
        expect(to).toBeGreaterThanOrEqual(0);
        expect(to).toBeLessThan(2048);
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(100);
        expect(mask).toBeGreaterThanOrEqual(1);
        expect(mask).toBeLessThanOrEqual(7);
      }
    }
  });

  it('gives every relation a label and a family the UI can colour', () => {
    const used = new Set(ENTRIES.flatMap((entry) => entry.n.map(([, relation]) => relation)));
    for (const relation of used) {
      expect(relationLabel(relation)).not.toBe(relation);
      expect(familyOf(relation)).toBeTruthy();
    }
  });

  it('names every source combination that appears', () => {
    const masks = new Set(ENTRIES.flatMap((entry) => entry.n.map(([, , , mask]) => mask)));
    for (const mask of masks) expect(sourceName(mask)).not.toBe('unknown');
  });

  it('assigns every topic member a matching topic id', () => {
    for (const topic of TOPICS) {
      expect(topic.members).toHaveLength(topic.size);
      for (const member of topic.members) {
        expect(ENTRIES[AT.get(member)!].t).toBe(topic.id);
      }
    }
  });
});

describe('the graph the client builds from it', () => {
  const graph = buildGraph(ENTRIES);

  it('is symmetric — every edge is crossable from both ends', () => {
    for (let from = 0; from < graph.length; from++) {
      for (const edge of graph[from]) {
        expect(graph[edge.to].some((back) => back.to === from)).toBe(true);
      }
    }
  });

  it('leaves the one genuinely unconnected word unconnected', () => {
    // "analyst" has no edge above the index's score floor. Padding it out
    // with weak links would be a nicer-looking lie.
    const isolated = WORDS.filter((_, i) => graph[i].length === 0);
    expect(isolated).toEqual(['analyst']);
  });

  it('reaches everything else — the graph is one component', () => {
    const start = AT.get('bird')!;
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      for (const edge of graph[queue.pop()!]) {
        if (!seen.has(edge.to)) {
          seen.add(edge.to);
          queue.push(edge.to);
        }
      }
    }
    expect(seen.size).toBe(2047);
  });
});
