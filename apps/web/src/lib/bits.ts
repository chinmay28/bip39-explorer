/**
 * A word's position in the list, in the forms BIP-39 cares about.
 *
 * 2048 = 2^11, so every word carries exactly 11 bits of a seed's entropy.
 * That is the whole of the bits story this app tells: per-word index, hex and
 * binary. There is deliberately no phrase-level tooling, because that would
 * mean a field people put real words into.
 */
export function toBits(index: number): string {
  return index
    .toString(2)
    .padStart(11, '0')
    .replace(/(\d{4})(\d{4})(\d{3})/, '$1 $2 $3');
}

export function toHex(index: number): string {
  return `0x${index.toString(16).toUpperCase().padStart(3, '0')}`;
}

export function padIndex(index: number): string {
  return String(index).padStart(4, '0');
}

const PART_OF_SPEECH: Record<string, string> = {
  n: 'noun',
  v: 'verb',
  a: 'adjective',
  s: 'adjective',
  r: 'adverb',
};

export function partOfSpeech(code: string | undefined): string | null {
  return code ? PART_OF_SPEECH[code] ?? code : null;
}
