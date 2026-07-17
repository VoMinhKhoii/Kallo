/**
 * Food aliases → stable food concepts.
 *
 * Extends Phase 2's exact-alias philosophy: a normalized surface form maps to
 * a stable CONCEPT id (not directly to a nutrition row). A concept may point
 * to a DB row for nutrition. This is the layer that lets a portion prior be
 * scoped to "banh-bao" independent of which DB row supplies its macros.
 *
 * GLOBAL-CORRECTNESS RULE: generic words ("bun", "bánh", "slice", "bowl",
 * "rice") map to NO concept OR to an explicitly AMBIGUOUS marker — never to a
 * single guessed concept. When a surface form is ambiguous the resolver routes
 * to clarify, it never fabricates a number.
 *
 * DB-row links below were VERIFIED against the dev DB (read-only) at authoring
 * time; the verification is documented in the concept registry `source`.
 */

import type { ConceptId, FoodConcept } from './types';

function normalize(s: string): string {
  return s.normalize('NFC').toLowerCase().trim();
}

/**
 * The concept registry. Each concept optionally carries a VERIFIED
 * `dbRowName` (a real `vietnamese_food_composition.name_primary`, source_id=1).
 */
export const CONCEPTS: Record<ConceptId, FoodConcept> = {
  'banh-bao': {
    id: 'banh-bao',
    label: 'Bánh bao (steamed meat bun)',
    // VERIFIED: fao_vn_2007_1009_cooked "Bánh bao nhân thịt" (219 kcal/100g).
    dbRowName: 'Bánh bao nhân thịt',
  },
  'quail-egg': {
    id: 'quail-egg',
    label: 'Trứng cút (quail egg)',
    // VERIFIED: fao_vn_2007_9007_raw "Trứng chim cút" (154 kcal/100g).
    dbRowName: 'Trứng chim cút',
  },
  'banh-mi-loaf': {
    id: 'banh-mi-loaf',
    label: 'Bánh mì (French-bread loaf)',
    // VERIFIED: fao_vn_2007_1012_raw "Bánh mỳ" (249 kcal/100g).
    dbRowName: 'Bánh mỳ',
  },
  'chicken-breast': {
    id: 'chicken-breast',
    // No specific "Ức gà" row exists in FAO source_id=1 (only aggregate
    // "Thịt gà ta"); we intentionally leave dbRowName unset so the resolver
    // still returns a portion prior while nutrition matching handles the row.
    label: 'Ức gà (chicken breast)',
  },
  'cooked-rice': {
    id: 'cooked-rice',
    // No cooked "Cơm" row in FAO source_id=1; the raw grain rows
    // ("Gạo tẻ máy") are handled by the matcher. Portion prior only.
    label: 'Cơm (cooked white rice)',
  },
};

/**
 * Normalized surface form → concept id, OR the sentinel 'AMBIGUOUS'.
 *
 * 'AMBIGUOUS' is deliberate: bare generic words resolve to it so the resolver
 * fires a clarify instead of guessing. Specific, unambiguous surface forms map
 * to a concept.
 */
export const AMBIGUOUS = 'AMBIGUOUS' as const;
export type ConceptResolution = ConceptId | typeof AMBIGUOUS;

const ALIAS_TO_CONCEPT: Record<string, ConceptResolution> = {
  // -- banh bao (specific composed dish) --------------------------------
  'bánh bao': 'banh-bao',
  'banh bao': 'banh-bao',
  'bánh bao nhân thịt': 'banh-bao',
  'bánh bao trứng cút': 'banh-bao',
  // -- quail egg --------------------------------------------------------
  'trứng cút': 'quail-egg',
  'trứng chim cút': 'quail-egg',
  'quail egg': 'quail-egg',
  // -- banh mi loaf -----------------------------------------------------
  'bánh mì': 'banh-mi-loaf',
  'bánh mỳ': 'banh-mi-loaf',
  // -- chicken breast ---------------------------------------------------
  'ức gà': 'chicken-breast',
  'uc ga': 'chicken-breast',
  'chicken breast': 'chicken-breast',
  // -- cooked rice ------------------------------------------------------
  cơm: 'cooked-rice',
  'cơm trắng': 'cooked-rice',
  // -- Explicitly ambiguous generics (route to clarify, NEVER a number) --
  bánh: AMBIGUOUS,
  bun: AMBIGUOUS,
  slice: AMBIGUOUS,
  bowl: AMBIGUOUS,
  rice: AMBIGUOUS,
  bread: AMBIGUOUS,
};

/**
 * Resolve a surface form (rawName or canonicalName) to a concept resolution.
 * Returns:
 *   - a concept id when a single unambiguous concept matches,
 *   - AMBIGUOUS when the word is a known generic,
 *   - null when unknown (resolver falls through to LLM range — no guess).
 */
export function resolveConcept(
  surfaceForm: string | undefined
): ConceptResolution | null {
  if (!surfaceForm) return null;
  return ALIAS_TO_CONCEPT[normalize(surfaceForm)] ?? null;
}

/** Look up a concept record by id. */
export function getConcept(id: ConceptId): FoodConcept | null {
  return CONCEPTS[id] ?? null;
}
