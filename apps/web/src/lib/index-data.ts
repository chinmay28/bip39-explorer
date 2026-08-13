/**
 * The committed semantic index, and the shapes it comes in.
 *
 * The index is imported as a raw string and parsed, rather than imported as
 * JSON. Vite turns a JSON import into a JavaScript module — a 28,000-edge
 * object literal the engine has to compile — where `JSON.parse` on a string
 * literal is a fast path in every engine. Same bytes, a fraction of the
 * start-up cost.
 *
 * It rides *inside* the bundle rather than being fetched. That is what makes
 * the app work from a `file://` URL, from an installed PWA with the network
 * off, and without a single request leaving the page.
 */
import raw from '@data/semantic-index.json?raw';

/** `[neighbour word index, relation, score 0-100, source mask]`. */
export type NeighbourRow = [number, string, number, number];

export interface WordEntry {
  /** The word itself. Index-aligned to data/english.txt. */
  w: string;
  /** Definition, absent for the 18 words with no WordNet entry. */
  g?: string;
  /** Part of speech: n, v, a, s, r. */
  p?: string;
  /** Topic id, absent when no community held the word strongly enough. */
  t?: number;
  n: NeighbourRow[];
}

export interface Topic {
  id: number;
  label: string;
  signature: string[];
  size: number;
  members: string[];
}

export interface RelationMeta {
  label: string;
  rank: number;
}

export interface SourceNote {
  name: string;
  role: string;
  url: string;
  license: string;
}

export interface SemanticIndex {
  schema: number;
  generated_utc: string;
  wordlist: { file: string; count: number; sha256: string };
  sources: SourceNote[];
  relations: Record<string, RelationMeta>;
  note: string;
  stats: Record<string, unknown>;
  topics: Topic[];
  words: WordEntry[];
}

export const INDEX: SemanticIndex = JSON.parse(raw) as SemanticIndex;

export const WORDS: string[] = INDEX.words.map((entry) => entry.w);
export const ENTRIES: WordEntry[] = INDEX.words;
export const TOPICS: Topic[] = INDEX.topics;

/** word -> its position in the BIP-39 list. */
export const AT: ReadonlyMap<string, number> = new Map(WORDS.map((w, i) => [w, i]));

/** Which sources vouched for an edge, from its bitmask. */
export const SOURCE_NAMES = [
  '',
  'WordNet',
  'ConceptNet',
  'WordNet and ConceptNet',
  'Numberbatch',
  'WordNet and Numberbatch',
  'ConceptNet and Numberbatch',
  'all three sources',
] as const;

export function sourceName(mask: number): string {
  return SOURCE_NAMES[mask] ?? 'unknown';
}

export function relationLabel(relation: string): string {
  return INDEX.relations[relation]?.label ?? relation;
}

export function relationRank(relation: string): number {
  return INDEX.relations[relation]?.rank ?? 99;
}
