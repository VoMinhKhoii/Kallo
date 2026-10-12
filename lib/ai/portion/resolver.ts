/**
 * Server-side portion resolver — the strict fallback ladder (Phase 3).
 *
 * Given a matched food concept + structured quantity evidence + locale/form,
 * return a basis-declared grams band (or null) plus provenance and confidence.
 * Edible anchors bypass refuse conversion; gross-as-served anchors include
 * bone/shell/rind and pass through `refuse-mass.ts` exactly once. The LLM only
 * extracted the evidence.
 *
 * Ladder (strict order — first hit wins):
 *   0. Explicit zero count → unresolved (clarify).
 *   1. Explicit user mass (explicitMass / raw-weight state hint) — physical
 *      mass basis honored verbatim; raw cooking state gets NO yield fudge.
 *   -  Ambiguous concept → unresolved (clarify); a mass unit token without
 *      explicitMass → Call 2 range.
 *   2. Packaged / serving weight carried on the matched DB row (rare; skipped
 *      when the row has none).
 *   5. User-specific prior — SEAM ONLY (needs confirmed-edit data; not built).
 *   6. Null → defer to Call 2, which estimates the grams.
 *
 * Steps 3–4 (pinning grams from the built-in portion priors in
 * `data/priors.ts`) were removed on 2026-10-12: on 200 benchmark meals the
 * prior anchors oversized portions, and Call 2 sized them closer to what was
 * eaten when it was free to. So the only gram anchors are a weight the user
 * typed and a package size.
 *
 * GLOBAL-CORRECTNESS: a unit never yields grams on its own. When in doubt the
 * resolver returns null (LLM range) or unresolved (clarify) — never a
 * fabricated number.
 */

import { AMBIGUOUS } from './lexicon/concept-aliases';
import { resolveUnitType } from './lexicon/unit-lexicon';
import { classifyRefuseCut } from './refuse-cut';
import type {
  PortionResolution,
  QuantityEvidence,
  ResolverConceptInput,
} from './types';

/**
 * Resolve grams for a single ingredient. Pure and DB-free: the caller passes
 * the matched concept (incl. any DB serving weight) and the extracted quantity.
 */
export function resolvePortion(
  concept: ResolverConceptInput,
  quantity: QuantityEvidence
): PortionResolution {
  // ---- Step 0: explicit ZERO count → clarify ---------------------------
  // "0 fried chicken" is a contradiction, not a portion. Before this check
  // the zero was schema-dropped (count was .positive()), so the item was
  // silently analyzed as one standard serving. A typed zero must never
  // produce calories.
  if (quantity.count === 0) {
    return {
      grams: null,
      massBasis: null,
      provenance: 'unresolved',
      confidence: 'none',
      unresolvedReason: 'explicit_zero',
      note: 'user typed an explicit ZERO count — contradictory quantity; clarify',
    };
  }

  // ---- Step 1: explicit user mass -------------------------------------
  // Unknown mass on a refuse-bearing named cut defaults to gross-as-served.
  // For foods with no refuse-bearing cut, gross and edible are equivalent, so
  // preserve the user's explicit grams as an edible anchor downstream.
  const explicit = quantity.explicitMass;
  if (explicit && Number.isFinite(explicit.grams) && explicit.grams > 0) {
    const g = explicit.grams;
    const cut = classifyRefuseCut(
      concept.canonicalName ?? '',
      concept.rawName ?? ''
    );
    const massBasis =
      explicit.basis === 'unknown'
        ? cut
          ? 'gross_as_served'
          : 'edible'
        : explicit.basis;
    return {
      grams: { low: g, mid: g, high: g },
      massBasis,
      provenance: 'explicit_user_mass',
      confidence: 'high',
      note: `explicit user mass ${g}g (massBasis=${massBasis}); honored verbatim, no yield fudge`,
    };
  }

  // ---- Ambiguous concept → clarify -----------------------------------
  // Done before the package-size step so a generic word ("bun"/"slice"/
  // "bowl") never picks up a fabricated number.
  if (concept.ambiguous || concept.conceptId === AMBIGUOUS) {
    return {
      grams: null,
      massBasis: null,
      provenance: 'unresolved',
      confidence: 'none',
      unresolvedReason: 'ambiguous_food',
      note: 'concept is ambiguous — cannot scope a portion prior; clarify',
    };
  }

  // Unit semantics FIRST: a mass token ("250 g") means count is a weight,
  // not a multiplier — 250 × a 100g packaged serving would be 25kg. Mass
  // quantities belong in explicitMass (step 1); if the extractor emitted a
  // bare mass count instead, defer to the LLM range rather than fabricate.
  const unitType = resolveUnitType(quantity.unitToken);
  if (unitType === 'mass') {
    return {
      grams: null,
      massBasis: null,
      provenance: 'llm_range',
      confidence: 'none',
      note: 'mass unit token without explicitMass — defer to Call 2 LLM range',
    };
  }

  // ---- Step 2: packaged / serving weight on the matched row -----------
  const serving = concept.dbServingSizeG;
  if (serving != null && Number.isFinite(serving) && serving > 0) {
    const count = quantity.count && quantity.count > 0 ? quantity.count : 1;
    const g = serving * count;
    return {
      grams: { low: g, mid: g, high: g },
      massBasis: 'edible',
      provenance: 'packaged_serving',
      confidence: 'high',
      note: `packaged serving ${serving}g × ${count}`,
    };
  }

  // ---- Step 5: user-specific prior — SEAM (not implemented) -----------
  // Intentionally no branch: when confirmed-edit data exists, insert a lookup
  // here BEFORE step 6.

  // ---- Step 6: null → defer to Call 2 (LLM range) ---------------------
  return {
    grams: null,
    massBasis: null,
    provenance: 'llm_range',
    confidence: 'none',
    note: unitType
      ? `no user mass or package size for ${unitType}; defer to Call 2 LLM range`
      : 'no resolvable unit/quantity; defer to Call 2 LLM range',
  };
}
