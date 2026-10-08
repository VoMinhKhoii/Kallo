import type { DecomposedIngredientV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import { capitalizeFirst } from '@/lib/core/text/capitalize';

/**
 * The strings an ingredient is searched by — one per vector arm, in arm order.
 * The single definition both retrieval and the stream prewarm read, so the
 * prewarm embeds byte-identical text:
 * - `capitalized`: the decomposition stage capitalizes the field after the
 *   stream, so a value read off the stream is capitalized the same way.
 * - `fallback`: the field used when a decomposition lacks this one (fixtures,
 *   decompositions cached before the field existed).
 */
export const QUERY_FIELDS = [
  { field: 'rawName', capitalized: true },
  { field: 'canonicalName', capitalized: true },
  { field: 'queryEn', fallback: 'canonicalName' },
  { field: 'nameVi', fallback: 'rawName' },
] as const satisfies readonly {
  field: keyof DecomposedIngredientV2;
  capitalized?: boolean;
  fallback?: 'rawName' | 'canonicalName';
}[];

export type QueryField = (typeof QUERY_FIELDS)[number]['field'];

export function cardQueryStrings(ing: DecomposedIngredientV2): string[] {
  return QUERY_FIELDS.map((f) =>
    'fallback' in f ? (ing[f.field] ?? ing[f.fallback]) : ing[f.field]
  );
}

/** A query field's value as retrieval will see it after the decomposition stage. */
export function asRetrieved(field: QueryField, value: string): string {
  const spec = QUERY_FIELDS.find((f) => f.field === field);
  return spec && 'capitalized' in spec ? capitalizeFirst(value) : value;
}
