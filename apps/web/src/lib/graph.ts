/**
 * Everything the app works out for itself, from the committed graph.
 *
 * The index is a starting position, not the answer. It ships one ranked list
 * per word; walking that into trees, chains and second-degree suggestions
 * happens here, in the page, with no network and no server.
 *
 * All of it is pure and takes its graph as an argument, so the tests below
 * exercise it against a hand-built ten-word fixture rather than the real
 * 28,000-edge index.
 */
import { INVERSE } from './relations';
import type { WordEntry } from './index-data';

export interface Edge {
  /** Index of the word at the far end. */
  to: number;
  relation: string;
  /** 0-100. */
  score: number;
  /** Bitfield: 1 WordNet, 2 ConceptNet, 4 Numberbatch. */
  mask: number;
  /** False when this direction was inferred by inverting a stated edge. */
  stated: boolean;
}

export type Graph = Edge[][];

/**
 * Merge the directed index into an undirected graph.
 *
 * The index records "bird has as a part wing" and, separately, "wing is part
 * of bird" — but only for the relations whose inverse it also stores. Walking
 * a tree or hunting a path has to cross either way regardless, so every edge
 * is mirrored here, with reverse-only edges relabelled by their inverse. A
 * direction the index actually states always wins over one inferred
 * backwards.
 */
export function buildGraph(entries: readonly WordEntry[]): Graph {
  const graph: Graph = entries.map(() => []);
  const seen = new Map<number, Edge>();
  const width = entries.length;

  const put = (from: number, to: number, relation: string, score: number, mask: number, stated: boolean) => {
    const key = from * width + to;
    const existing = seen.get(key);
    if (existing) {
      if (stated && !existing.stated) {
        existing.relation = relation;
        existing.stated = true;
      }
      if (score > existing.score) existing.score = score;
      existing.mask |= mask;
      return;
    }
    const edge: Edge = { to, relation, score, mask, stated };
    seen.set(key, edge);
    graph[from].push(edge);
  };

  entries.forEach((entry, from) => {
    for (const [to, relation, score, mask] of entry.n) {
      put(from, to, relation, score, mask, true);
      put(to, from, INVERSE[relation] ?? relation, score, mask, false);
    }
  });

  for (const list of graph) list.sort((a, b) => b.score - a.score || a.to - b.to);
  return graph;
}

/** An edge weaker than this is a hint, not a claim about the subject. */
const STRONG = 30;

export function strongNeighbours(graph: Graph, index: number): Set<number> {
  const set = new Set<number>();
  for (const edge of graph[index]) if (edge.score >= STRONG) set.add(edge.to);
  return set;
}

/**
 * How much a candidate still belongs to the world of the word we set out
 * from, measured as strong neighbours shared with it.
 *
 * Without this, every hop optimises locally and a branch drifts: from "bird",
 * `pigeon → squirrel` is two strong edges and a change of subject, and
 * "animal" opens onto `female, head, joy` — all true WordNet edges, none of
 * them about birds.
 */
export function coherence(graph: Graph, candidate: number, rootSet: ReadonlySet<number>): number {
  let shared = 0;
  for (const edge of graph[candidate]) if (rootSet.has(edge.to)) shared++;
  return 1 + (0.5 * Math.min(shared, 6)) / 6;
}

/** How many children each tree level is allowed. */
export const PER_LEVEL = [6, 4, 3, 3, 2];

/**
 * The children of a node in the tree.
 *
 * Ancestors are dropped rather than marked: relations run both ways, so a
 * word's neighbours always include the word it hangs from, and left in, every
 * branch would open with a step straight back where it came from.
 *
 * From the third level down, candidates are re-ranked by coherence with the
 * root. The first two levels are left alone on purpose — a word's immediate
 * neighbours should be reported honestly, strongest first, and the drift only
 * compounds further out.
 */
export function childrenOf(
  graph: Graph,
  index: number,
  depth: number,
  ancestors: ReadonlySet<number>,
  rootSet: ReadonlySet<number> | null,
): Edge[] {
  const limit = PER_LEVEL[Math.min(depth, PER_LEVEL.length - 1)];
  const candidates = graph[index].filter((edge) => !ancestors.has(edge.to));
  if (depth < 2 || !rootSet) return candidates.slice(0, limit);

  return candidates
    .map((edge) => ({ edge, rank: (edge.score / 100) * coherence(graph, edge.to, rootSet) }))
    .sort((a, b) => b.rank - a.rank || a.edge.to - b.edge.to)
    .slice(0, limit)
    .map((scored) => scored.edge);
}

export interface PathStep {
  word: number;
  edge: Edge;
}

/**
 * The strongest chain of relations joining two words.
 *
 * Dijkstra over −log(score), so a route costs the *product* of its links
 * rather than their count: three near-certain steps beat one lucky guess.
 * The graph turns out to be small-world — 2047 of the 2048 words are mutually
 * reachable, median distance three — so this nearly always answers, and
 * answers instantly.
 *
 * Returns null when no chain exists, and an empty array when the two words
 * are the same.
 */
export function strongestPath(graph: Graph, from: number, to: number): PathStep[] | null {
  if (from === to) return [];

  const size = graph.length;
  const cost = new Float64Array(size).fill(Infinity);
  const via = new Int32Array(size).fill(-1);
  const viaEdge: (Edge | undefined)[] = new Array(size);
  const settled = new Uint8Array(size);
  cost[from] = 0;

  const heap = new MinHeap();
  heap.push(0, from);

  while (heap.size > 0) {
    const [distance, node] = heap.pop()!;
    if (settled[node]) continue;
    settled[node] = 1;
    if (node === to) break;
    for (const edge of graph[node]) {
      const next = distance - Math.log(edge.score / 100);
      if (next < cost[edge.to]) {
        cost[edge.to] = next;
        via[edge.to] = node;
        viaEdge[edge.to] = edge;
        heap.push(next, edge.to);
      }
    }
  }
  if (!Number.isFinite(cost[to])) return null;

  const chain: PathStep[] = [];
  for (let node = to; node !== from; node = via[node]) {
    chain.push({ word: node, edge: viaEdge[node]! });
  }
  return chain.reverse();
}

/**
 * A binary heap, because a linear scan over 2048 nodes per pop is wasteful
 * enough to be felt on a phone.
 */
class MinHeap {
  private keys: number[] = [];
  private values: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  push(key: number, value: number): void {
    this.keys.push(key);
    this.values.push(value);
    let i = this.keys.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= this.keys[i]) break;
      this.swap(parent, i);
      i = parent;
    }
  }

  pop(): [number, number] | undefined {
    if (this.keys.length === 0) return undefined;
    const top: [number, number] = [this.keys[0], this.values[0]];
    const lastKey = this.keys.pop()!;
    const lastValue = this.values.pop()!;
    if (this.keys.length > 0) {
      this.keys[0] = lastKey;
      this.values[0] = lastValue;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.keys.length && this.keys[left] < this.keys[smallest]) smallest = left;
        if (right < this.keys.length && this.keys[right] < this.keys[smallest]) smallest = right;
        if (smallest === i) break;
        this.swap(smallest, i);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
    [this.values[a], this.values[b]] = [this.values[b], this.values[a]];
  }
}

/**
 * Words two steps out: strongly tied to several of this word's neighbours
 * without being tied to the word itself.
 *
 * This is how a graph suggests "oven" for "bread" when no source ever wrote
 * that edge down — the evidence is in the company they both keep. Scores
 * multiply along each two-hop route and sum across routes, so a word reached
 * by three different neighbours outranks one reached by a single strong link.
 */
export function twoStepsOut(graph: Graph, index: number, limit = 6): number[] {
  const direct = new Set<number>([index]);
  for (const edge of graph[index]) direct.add(edge.to);

  const totals = new Map<number, number>();
  for (const first of graph[index]) {
    if (first.score < STRONG) continue;
    for (const second of graph[first.to]) {
      if (direct.has(second.to) || second.score < STRONG) continue;
      const gain = (first.score / 100) * (second.score / 100);
      totals.set(second.to, (totals.get(second.to) ?? 0) + gain);
    }
  }

  return [...totals.entries()]
    .filter(([, total]) => total >= 0.5)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, limit)
    .map(([word]) => word);
}

export interface RelationGroup {
  relation: string;
  best: number;
  edges: Edge[];
  shown: Edge[];
}

/** A word's neighbours bundled by relation, strongest relation first. */
export function groupsFor(
  graph: Graph,
  index: number,
  perGroup: number,
  rank: (relation: string) => number,
): RelationGroup[] {
  const byRelation = new Map<string, Edge[]>();
  for (const edge of graph[index]) {
    const bucket = byRelation.get(edge.relation);
    if (bucket) bucket.push(edge);
    else byRelation.set(edge.relation, [edge]);
  }

  return [...byRelation.entries()]
    .map(([relation, edges]) => ({
      relation,
      best: edges[0].score,
      edges,
      shown: edges.slice(0, perGroup),
    }))
    .sort((a, b) => b.best - a.best || rank(a.relation) - rank(b.relation));
}
