/**
 * Finding a word by how it is spelled or said.
 *
 * Deliberately not precomputed. A pass over 2048 short strings costs well
 * under a millisecond, so there is no index to keep warm and no debounce to
 * tune — and the rules live in one place instead of half here and half in a
 * build script.
 *
 * This is a different kind of knowing from the semantic graph, and the UI
 * keeps the two visibly apart: the graph says what a word *means*, this says
 * what it *looks and sounds like*.
 */

/**
 * Consonants folded into classes, every vowel into "A".
 *
 * The digraph rewrites above the fold matter more than the classes: English
 * spells one sound half a dozen ways, and the mistakes this rung exists to
 * catch — dictation, an unfamiliar accent, a word read off someone's
 * handwriting — follow sound rather than spelling.
 */
const CLASS: Record<string, string> = {
  a: 'A', e: 'A', i: 'A', o: 'A', u: 'A', y: 'A',
  b: 'B', p: 'B', f: 'F', v: 'F', d: 'D', t: 'D',
  g: 'K', k: 'K', c: 'K', q: 'K', j: 'J',
  s: 'S', z: 'S', x: 'S', m: 'N', n: 'N',
  l: 'L', r: 'R', w: 'W', h: '',
};

export function soundKey(word: string): string {
  let s = word
    .replace(/^gh/, 'g')
    .replace(/gh/g, '')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/^kn/, 'n')
    .replace(/^wr/, 'r')
    .replace(/mb$/, 'm');
  if (s.length > 3) s = s.replace(/e$/, '');
  s = s.replace(/(.)\1+/g, '$1');

  let out = '';
  for (const ch of s) {
    const c = CLASS[ch];
    if (c && c !== out[out.length - 1]) out += c;
  }
  return out;
}

/**
 * Damerau–Levenshtein distance with an early cutoff.
 *
 * Damerau rather than plain Levenshtein because transposition is the
 * characteristic typing error — "recieve" is one slip, not two — and the
 * cutoff because most of the 2048 comparisons can be abandoned after a row
 * or two.
 */
export function editDistance(a: string, b: string, cap: number): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > cap) return cap + 1;

  let previous2: number[] = [];
  let previous: number[] = new Array(n + 1);
  let current: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) previous[j] = j;

  for (let i = 1; i <= m; i++) {
    current[0] = i;
    let best = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, previous2[j - 2] + 1);
      }
      current[j] = v;
      if (v < best) best = v;
    }
    if (best > cap) return cap + 1;
    previous2 = previous;
    previous = current.slice();
  }
  return previous[n];
}

/** Do the query's letters appear in this word, in order, gaps allowed? */
export function isSubsequence(query: string, word: string): boolean {
  if (!query) return true;
  let i = 0;
  for (const ch of word) {
    if (ch === query[i]) i++;
    if (i === query.length) return true;
  }
  return false;
}

export function normalise(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z]/g, '');
}

export interface Hit {
  word: string;
  /** Why it matched, in the words the UI shows. */
  why: string;
  /** Lower is a stronger claim. */
  rank: number;
}

/**
 * A ladder of match reasons, strongest rung first, each word reported once
 * under the best reason that found it.
 *
 * The rung order is a ranking as well as a taxonomy: an exact prefix beats a
 * substring, a substring beats one wrong keystroke, and letters scattered in
 * order is the last resort.
 */
export function searchWords(words: readonly string[], soundGroups: ReadonlyMap<string, string[]>, rawQuery: string): Hit[] {
  const q = normalise(rawQuery);
  if (!q) return [];

  const seen = new Map<string, Hit>();
  const add = (word: string, why: string, rank: number) => {
    if (!seen.has(word)) seen.set(word, { word, why, rank });
  };

  for (const word of words) {
    if (word === q) add(word, 'exact', 0);
    else if (word.startsWith(q)) add(word, 'starts with', 1 + (word.length - q.length) / 64);
  }
  for (const word of words) {
    if (!seen.has(word) && word.includes(q)) add(word, 'contains', 3);
  }
  if (q.length >= 3) {
    // One slip is plenty of licence on a short query; on a long one, two.
    const cap = q.length <= 4 ? 1 : 2;
    for (const word of words) {
      if (seen.has(word)) continue;
      const d = editDistance(q, word, cap);
      if (d <= cap) add(word, `${d} edit${d === 1 ? '' : 's'} away`, 2 + (d - 1));
    }
  }
  for (const word of soundGroups.get(soundKey(q)) ?? []) {
    add(word, 'sounds like', 3.5);
  }
  if (q.length >= 3) {
    for (const word of words) {
      if (!seen.has(word) && isSubsequence(q, word)) add(word, 'letters in order', 4);
    }
  }

  return [...seen.values()].sort((a, b) => a.rank - b.rank || a.word.localeCompare(b.word));
}

export function buildSoundGroups(words: readonly string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const word of words) {
    const key = soundKey(word);
    const bucket = groups.get(key);
    if (bucket) bucket.push(word);
    else groups.set(key, [word]);
  }
  return groups;
}

export interface LetterGroup {
  kind: string;
  words: string[];
}

/** The look-and-sound neighbourhood of one word, for the strip under the map. */
export function letterNeighbours(
  words: readonly string[],
  soundGroups: ReadonlyMap<string, string[]>,
  word: string,
): LetterGroup[] {
  const groups: LetterGroup[] = [
    {
      kind: 'same first letters',
      words: words.filter((w) => w !== word && w.startsWith(word.slice(0, 3))),
    },
    {
      kind: 'sounds like',
      words: (soundGroups.get(soundKey(word)) ?? []).filter((w) => w !== word),
    },
    {
      kind: 'one edit away',
      words: words.filter((w) => w !== word && editDistance(word, w, 1) <= 1),
    },
    {
      kind: 'rhymes with',
      words:
        word.length >= 4
          ? words.filter((w) => w !== word && w.length >= 4 && w.slice(-3) === word.slice(-3))
          : [],
    },
  ];
  return groups.filter((group) => group.words.length > 0);
}
