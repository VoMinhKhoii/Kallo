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

import { INSTANT_NOODLE_ROW } from '../matching/aliases';
import type { ConceptId, FoodConcept } from './types';

function normalize(s: string): string {
  return s.normalize('NFC').toLowerCase().trim();
}

function fold(s: string): string {
  return normalize(s)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd');
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
  'chicken-thigh': {
    id: 'chicken-thigh',
    label: 'Đùi gà (chicken thigh or drumstick)',
  },
  'chicken-wing': {
    id: 'chicken-wing',
    label: 'Cánh gà (chicken wing)',
  },
  'rib-piece': {
    id: 'rib-piece',
    label: 'Miếng sườn (table-cut rib)',
  },
  'whole-fish': {
    id: 'whole-fish',
    label: 'Cá nguyên con (whole fish)',
  },
  'fish-section': {
    id: 'fish-section',
    label: 'Khúc/khoanh cá (bone-in fish section)',
  },
  'fish-fillet': {
    id: 'fish-fillet',
    label: 'Phi lê/miếng cá (boneless fish fillet)',
  },
  'shell-on-shrimp': {
    id: 'shell-on-shrimp',
    label: 'Tôm nguyên vỏ (shell-on shrimp)',
  },
  'peeled-shrimp': {
    id: 'peeled-shrimp',
    label: 'Tôm bóc vỏ (peeled shrimp)',
  },
  'whole-crab': {
    id: 'whole-crab',
    label: 'Cua/ghẹ nguyên con (whole crab)',
  },
  'picked-crab-meat': {
    id: 'picked-crab-meat',
    label: 'Thịt cua/ghẹ đã gỡ (picked crab meat)',
  },
  'egg-in-shell': {
    id: 'egg-in-shell',
    label: 'Trứng còn vỏ (egg in shell)',
  },
  'peeled-egg': {
    id: 'peeled-egg',
    label: 'Trứng luộc đã bóc vỏ (peeled boiled egg)',
  },
  'nem-lui': {
    id: 'nem-lui',
    label: 'Nem lụi (Vietnamese grilled pork skewer)',
  },
  'pan-seared-protein-serving': {
    id: 'pan-seared-protein-serving',
    label: 'Phần protein áp chảo (pan-seared protein serving)',
  },
  'cooked-rice': {
    id: 'cooked-rice',
    // No cooked "Cơm" row in FAO source_id=1; the raw grain rows
    // ("Gạo tẻ máy") are handled by the matcher. Portion prior only.
    label: 'Cơm (cooked white rice)',
  },
  'instant-noodle-pack': {
    id: 'instant-noodle-pack',
    // VERIFIED against the dev DB: usda_6583_raw "Soup, ramen noodle, any
    // flavor, dry" (440 kcal, 60.3g carb, 17.6g fat per 100g DRY). The row was
    // always there but kept its untranslated English name; migration
    // 20260806120000 curates it to the Vietnamese name referenced here.
    // Dry-basis, which is why the prior below is a packet weight, not a bowl.
    label: 'Mì gói (instant noodle packet)',
    dbRowName: INSTANT_NOODLE_ROW,
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
  // -- chicken thigh / drumstick --------------------------------------
  'đùi gà': 'chicken-thigh',
  'chicken thigh': 'chicken-thigh',
  'chicken drumstick': 'chicken-thigh',
  // -- chicken wing ----------------------------------------------------
  'cánh gà': 'chicken-wing',
  'chicken wing': 'chicken-wing',
  // -- rib table-cut (one concept across species) ---------------------
  'sườn heo': 'rib-piece',
  'sườn bò': 'rib-piece',
  'sườn dê': 'rib-piece',
  'sườn cừu': 'rib-piece',
  'pork rib': 'rib-piece',
  'beef rib': 'rib-piece',
  'goat rib': 'rib-piece',
  'lamb rib': 'rib-piece',
  // -- fish forms ------------------------------------------------------
  'cá nguyên con': 'whole-fish',
  'nguyên con cá': 'whole-fish',
  'con cá': 'whole-fish',
  '1 con cá': 'whole-fish',
  'whole fish': 'whole-fish',
  'khúc cá': 'fish-section',
  'khoanh cá': 'fish-section',
  'fish steak': 'fish-section',
  'fish section': 'fish-section',
  'phi lê cá': 'fish-fillet',
  'cá phi lê': 'fish-fillet',
  'miếng cá': 'fish-fillet',
  'fish fillet': 'fish-fillet',
  'boneless fish piece': 'fish-fillet',
  // -- shrimp forms ----------------------------------------------------
  'tôm nguyên vỏ': 'shell-on-shrimp',
  'tôm còn vỏ': 'shell-on-shrimp',
  'shell-on shrimp': 'shell-on-shrimp',
  'shell on shrimp': 'shell-on-shrimp',
  'tôm bóc vỏ': 'peeled-shrimp',
  'tôm lột vỏ': 'peeled-shrimp',
  'peeled shrimp': 'peeled-shrimp',
  // -- crab forms ------------------------------------------------------
  ghẹ: 'whole-crab',
  cua: 'whole-crab',
  'cua nguyên con': 'whole-crab',
  'ghẹ nguyên con': 'whole-crab',
  'whole crab': 'whole-crab',
  'thịt cua': 'picked-crab-meat',
  'thịt ghẹ': 'picked-crab-meat',
  'picked crab meat': 'picked-crab-meat',
  'crab meat': 'picked-crab-meat',
  // -- chicken egg served forms ---------------------------------------
  'trứng gà nguyên vỏ': 'egg-in-shell',
  'trứng gà còn vỏ': 'egg-in-shell',
  'egg in shell': 'egg-in-shell',
  'trứng gà luộc': 'peeled-egg',
  'trứng luộc': 'peeled-egg',
  'trứng gà bóc vỏ': 'peeled-egg',
  'trứng gà': 'peeled-egg',
  'chicken egg': 'peeled-egg',
  'boiled egg': 'peeled-egg',
  'peeled egg': 'peeled-egg',
  // -- nem lui ---------------------------------------------------------
  'nem lụi': 'nem-lui',
  'nem lui': 'nem-lui',
  'nem lụi nướng': 'nem-lui',
  // -- pan-seared serving (qualified form only) ------------------------
  'phần protein áp chảo': 'pan-seared-protein-serving',
  'pan-seared protein serving': 'pan-seared-protein-serving',
  // -- cooked rice ------------------------------------------------------
  cơm: 'cooked-rice',
  'cơm trắng': 'cooked-rice',
  // -- instant noodles --------------------------------------------------
  // Only the QUALIFIED forms. Bare `mì` stays out: it covers fresh egg
  // noodles and wheat flour too, so mapping it here would put a packet's
  // weight on a bowl of mì Quảng.
  'mì gói': 'instant-noodle-pack',
  'mi goi': 'instant-noodle-pack',
  'mì tôm': 'instant-noodle-pack',
  'mi tom': 'instant-noodle-pack',
  'mì ăn liền': 'instant-noodle-pack',
  'mi an lien': 'instant-noodle-pack',
  'instant noodles': 'instant-noodle-pack',
  'instant noodle': 'instant-noodle-pack',
  // -- Explicitly ambiguous generics (route to clarify, NEVER a number) --
  bánh: AMBIGUOUS,
  bun: AMBIGUOUS,
  slice: AMBIGUOUS,
  bowl: AMBIGUOUS,
  rice: AMBIGUOUS,
  bread: AMBIGUOUS,
};

/**
 * Diacritic-folded fallback, tried only after an exact miss — with two rules
 * that a naive first-wins map gets wrong in both directions.
 *
 * 1. AMBIGUOUS markers are NEVER folded into. A marker describes one exact
 *    surface form (English "bun", the bread roll); a fold that reaches it is
 *    always a cross-language accident. Measured: `fold('bún') === 'bun'`, so
 *    Vietnamese rice vermicelli — bún bò, bún riêu, bún chả — routed to the
 *    clarify path on 19 of 697 real-log ingredients. Falling through to the
 *    LLM range is strictly better than interrupting the user over a collision.
 * 2. A folded key that two DIFFERENT resolutions claim is dropped entirely.
 *    First-wins is iteration-order dependent and silently misroutes: `bơ`
 *    (butter) and `bò` (beef) both fold to `bo`, `dưa`/`dừa`/`dứa` all fold to
 *    `dua`. Requiring diacritics there is correct; guessing is not.
 *
 * Mirrors the `foldCollisions()` discipline already in `unit-lexicon.ts`.
 */
const FOLDED = new Map<string, ConceptResolution>();
const foldSeen = new Map<string, ConceptResolution>();
for (const [surface, resolution] of Object.entries(ALIAS_TO_CONCEPT)) {
  if (resolution === AMBIGUOUS) continue;
  const key = fold(surface);
  const prior = foldSeen.get(key);
  if (prior === undefined) {
    foldSeen.set(key, resolution);
    FOLDED.set(key, resolution);
  } else if (prior !== resolution) {
    FOLDED.delete(key);
  }
}

/** Folded keys claimed by two different concepts — resolvable only with
 *  diacritics. Exposed so a test can pin the set and catch new collisions. */
export function conceptFoldCollisions(): string[] {
  const counts = new Map<string, Set<ConceptResolution>>();
  for (const [surface, resolution] of Object.entries(ALIAS_TO_CONCEPT)) {
    if (resolution === AMBIGUOUS) continue;
    const key = fold(surface);
    if (!counts.has(key)) counts.set(key, new Set());
    counts.get(key)?.add(resolution);
  }
  return [...counts.entries()]
    .filter(([, set]) => set.size > 1)
    .map(([key]) => key)
    .sort();
}

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
  return (
    ALIAS_TO_CONCEPT[normalize(surfaceForm)] ??
    FOLDED.get(fold(surfaceForm)) ??
    null
  );
}

/** Real, non-ambiguous surface forms registered for invariant coverage. */
export function surfaceFormsForConcept(conceptId: ConceptId): string[] {
  return Object.entries(ALIAS_TO_CONCEPT)
    .filter(([, resolution]) => resolution === conceptId)
    .map(([surface]) => surface);
}

/** Look up a concept record by id. */
export function getConcept(id: ConceptId): FoodConcept | null {
  return CONCEPTS[id] ?? null;
}
