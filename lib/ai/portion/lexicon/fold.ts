export interface FoldOptions {
  collapseWhitespace?: boolean;
}

/** Normalize case/diacritics for fallback lookup, never for exact matching. */
export function fold(value: string, options: FoldOptions = {}): string {
  const normalized = value.normalize('NFC').toLowerCase().trim();
  const spaced = options.collapseWhitespace
    ? normalized.replace(/\s+/g, ' ')
    : normalized;
  return spaced.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
}

type FoldedEntry<T> = readonly [string, T];

/** Folded keys claimed by values with different semantic identities. */
export function collisionsFor<T, Identity>(
  entries: Iterable<FoldedEntry<T>>,
  identityFor: (value: T) => Identity,
  options: FoldOptions = {}
): string[] {
  const identities = new Map<string, Identity>();
  const collisions = new Set<string>();
  for (const [surface, value] of entries) {
    const key = fold(surface, options);
    const identity = identityFor(value);
    const prior = identities.get(key);
    if (prior === undefined) identities.set(key, identity);
    else if (prior !== identity) collisions.add(key);
  }
  return [...collisions].sort();
}

/** Build a folded fallback index that omits every ambiguous folded key. */
export function foldedLookupFor<T, Identity>(
  entries: Iterable<FoldedEntry<T>>,
  identityFor: (value: T) => Identity,
  options: FoldOptions = {}
): Map<string, T> {
  const materialized = [...entries];
  const collisions = new Set(collisionsFor(materialized, identityFor, options));
  const lookup = new Map<string, T>();
  for (const [surface, value] of materialized) {
    const key = fold(surface, options);
    if (!collisions.has(key) && !lookup.has(key)) lookup.set(key, value);
  }
  return lookup;
}
