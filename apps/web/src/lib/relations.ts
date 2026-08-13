/**
 * Eighteen relations, seven colours.
 *
 * The hue says what *kind* of knowledge an edge is; the label on the spoke
 * says which relation exactly. Eighteen distinct hues would be eighteen
 * indistinguishable hues.
 *
 * "assoc" is kept apart from "link" deliberately: something a source
 * asserted and something the embeddings merely observed keeping company are
 * different sorts of claim, and a reader deciding how much to trust a
 * neighbour needs to be able to tell them apart at a glance.
 */
export type Family =
  | 'identity'
  | 'hierarchy'
  | 'part'
  | 'use'
  | 'contrast'
  | 'link'
  | 'assoc';

const FAMILY_OF: Record<string, Family> = {
  synonym: 'identity',
  similar: 'identity',
  derived: 'identity',
  'is-a': 'hierarchy',
  kind: 'hierarchy',
  sibling: 'hierarchy',
  'part-of': 'part',
  'has-part': 'part',
  'made-of': 'part',
  'used-for': 'use',
  at: 'use',
  can: 'use',
  causes: 'use',
  property: 'use',
  opposite: 'contrast',
  related: 'link',
  context: 'link',
  associated: 'assoc',
};

export const FAMILY_LABEL: Record<Family, string> = {
  identity: 'same meaning',
  hierarchy: 'kinds and categories',
  part: 'parts and materials',
  use: 'use, place and effect',
  contrast: 'opposites',
  link: 'loosely related',
  assoc: 'turns up together',
};

export const FAMILIES = Object.keys(FAMILY_LABEL) as Family[];

export function familyOf(relation: string): Family {
  return FAMILY_OF[relation] ?? 'link';
}

/**
 * Reading an edge backwards reverses what it says. The index records both
 * directions for most relations but not all, so the traversal graph flips
 * the label rather than claiming a wing has a bird as a part.
 */
export const INVERSE: Record<string, string> = {
  'is-a': 'kind',
  kind: 'is-a',
  'part-of': 'has-part',
  'has-part': 'part-of',
};
