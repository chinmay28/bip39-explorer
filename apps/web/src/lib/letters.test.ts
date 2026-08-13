import { describe, expect, it } from 'vitest';
import {
  buildSoundGroups,
  editDistance,
  isSubsequence,
  letterNeighbours,
  normalise,
  searchWords,
  soundKey,
} from './letters';
import { WORDS } from './index-data';

const SOUNDS = buildSoundGroups(WORDS);
const search = (query: string) => searchWords(WORDS, SOUNDS, query);
const words = (query: string) => search(query).map((hit) => hit.word);
const why = (query: string, word: string) => search(query).find((h) => h.word === word)?.why;

describe('soundKey', () => {
  it('folds spellings of the same sound together', () => {
    expect(soundKey('crane')).toBe(soundKey('krane'));
    expect(soundKey('ghost')).toBe(soundKey('gost'));
    expect(soundKey('fruit')).toBe(soundKey('frut'));
  });

  it('keeps an initial gh, which is not silent', () => {
    // "ghost" starts with a hard g; "night" ends with nothing.
    expect(soundKey('ghost').startsWith('K')).toBe(true);
    expect(soundKey('night')).toBe(soundKey('nite'));
  });

  it('does not collapse words that merely rhyme', () => {
    expect(soundKey('cat')).not.toBe(soundKey('hat'));
  });
});

describe('editDistance', () => {
  it('counts a transposition as one edit, not two', () => {
    expect(editDistance('recieve', 'receive', 2)).toBe(1);
  });

  it('gives up once the budget is spent', () => {
    // Not the true distance — the point is that it bailed rather than
    // finishing a comparison whose answer could not matter.
    expect(editDistance('abandon', 'zoo', 1)).toBeGreaterThan(1);
  });

  it('is zero for a word against itself', () => {
    expect(editDistance('salmon', 'salmon', 2)).toBe(0);
  });
});

describe('isSubsequence', () => {
  it('allows gaps but not reordering', () => {
    expect(isSubsequence('dscvr', 'discover')).toBe(true);
    expect(isSubsequence('rvcsd', 'discover')).toBe(false);
  });
});

describe('searchWords', () => {
  it('puts an exact hit first', () => {
    expect(words('bird')[0]).toBe('bird');
    expect(why('bird', 'bird')).toBe('exact');
  });

  it('resolves the four-letter prefix to exactly one word', () => {
    // BIP-39 guarantees this, and it is the property the app leans on most.
    const prefixHits = search('sile').filter((hit) => hit.why === 'starts with' || hit.why === 'exact');
    expect(prefixHits.map((hit) => hit.word)).toEqual(['silent']);
  });

  it('catches a transcription slip', () => {
    expect(words('recieve')).toContain('receive');
    expect(why('recieve', 'receive')).toBe('1 edit away');
  });

  it('catches a word spelled by ear', () => {
    expect(why('krane', 'crane')).toBe('1 edit away');
    expect(words('gost')).toContain('ghost');
  });

  it('catches shorthand with the letters in order', () => {
    expect(why('dscvr', 'discover')).toBe('letters in order');
  });

  it('reports each word once, under its strongest reason', () => {
    const hits = search('sil');
    expect(new Set(hits.map((h) => h.word)).size).toBe(hits.length);
  });

  it('ranks stronger reasons ahead of weaker ones', () => {
    const ranks = search('sil').map((hit) => hit.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('ignores punctuation and case, so a typed suffix still works', () => {
    expect(normalise('-TION')).toBe('tion');
    expect(words('-tion')).toContain('action');
  });

  it('returns nothing for an empty query rather than everything', () => {
    expect(search('')).toEqual([]);
    expect(search('   ')).toEqual([]);
  });
});

describe('letterNeighbours', () => {
  it('groups a word by look and sound, dropping empty groups', () => {
    const groups = letterNeighbours(WORDS, SOUNDS, 'bird');
    const kinds = groups.map((group) => group.kind);
    expect(kinds).toContain('sounds like');
    expect(groups.every((group) => group.words.length > 0)).toBe(true);
    expect(groups.every((group) => !group.words.includes('bird'))).toBe(true);
  });
});
