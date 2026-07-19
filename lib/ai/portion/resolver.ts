/**
 * Server-side portion resolver — the strict fallback ladder (Phase 3).
 *
 * Given a matched food concept + structured quantity evidence + locale/form,
 * return a grams band (or null) plus provenance and confidence. The resolver
 * does ALL numeric portion resolution; the LLM only extracted the evidence.
 *
 * Ladder (strict order — first hit wins):
 *   1. Explicit user mass (explicitMass / raw-weight state hint) — verbatim,
 *      raw basis honored with NO cooking-yield fudge.
 *   2. Packaged / serving weight carried on the matched DB row (rare; skipped
 *      when the row has none).
 *   3. Retrieved portion prior matching concept + unit-type + locale + form.
 *   4. Curated head-of-distribution prior (locale='global' loosening).
 *   5. User-specific prior — SEAM ONLY (needs confirmed-edit data; not built).
 *   6. Null → defer to Call 2 (LLM estimates grams as today), bounded/flagged.
 *   7. Ambiguous concept OR resulting kcal interval too wide → unresolved
 *      (Phase-1 clarify path fires).
 *
 * GLOBAL-CORRECTNESS: a unit never yields grams without a concept-scoped
 * prior. When in doubt the resolver returns null (LLM range) or unresolved
 * (clarify) — never a fabricated number.
 */

import { AMBIGUOUS } from './concepts';
import { applySizeModifier, findPrior } from './priors';
import type {
  GramsBand,
  PortionResolution,
  QuantityEvidence,
  ResolverConceptInput,
} from './types';
import { resolveUnitType } from './unit-lexicon';

/**
 * Calibrated relative-width threshold for step 7. When a resolved band's
 * spread (high−low)/mid exceeds this, the portion is too uncertain to anchor
 * and we prefer a clarify over a confident-looking wide guess. Priced so the
 * seeded head-of-distribution bands (≤ ~0.4 spread) always pass, while an
 * open-ended LLM-style band would not. Only applied to prior-derived bands.
 */
export const MAX_RELATIVE_BAND_WIDTH = 0.6;

function scaleBand(perUnit: GramsBand, count: number): GramsBand {
  return {
    low: perUnit.low * count,
    mid: perUnit.mid * count,
    high: perUnit.high * count,
  };
}

function relativeWidth(b: GramsBand): number {
  if (b.mid <= 0) return Number.POSITIVE_INFINITY;
  return (b.high - b.low) / b.mid;
}

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
      provenance: 'unresolved',
      confidence: 'none',
      unresolvedReason: 'unresolved_portion',
      note: 'user typed an explicit ZERO count — contradictory quantity; clarify',
    };
  }

  // ---- Step 1: explicit user mass -------------------------------------
  // Honored verbatim. A raw basis means NO cooking-yield conversion here — the
  // downstream bridge already routes raw grams 1:1 against the raw DB row.
  const explicit = quantity.explicitMass;
  if (explicit && Number.isFinite(explicit.grams) && explicit.grams > 0) {
    const g = explicit.grams;
    return {
      grams: { low: g, mid: g, high: g },
      provenance: 'explicit_user_mass',
      confidence: 'high',
      note: `explicit user mass ${g}g (basis=${explicit.basis}); honored verbatim, no yield fudge`,
    };
  }

  // ---- Step 7 (early): ambiguous concept → clarify --------------------
  // Done before priors so a generic word ("bun"/"slice"/"bowl") never picks up
  // a fabricated number.
  if (concept.ambiguous || concept.conceptId === AMBIGUOUS) {
    return {
      grams: null,
      provenance: 'unresolved',
      confidence: 'none',
      unresolvedReason: 'ambiguous_food',
      note: 'concept is ambiguous — cannot scope a portion prior; clarify',
    };
  }

  // ---- Step 2: packaged / serving weight on the matched row -----------
  const serving = concept.dbServingSizeG;
  if (serving != null && Number.isFinite(serving) && serving > 0) {
    const count = quantity.count && quantity.count > 0 ? quantity.count : 1;
    const g = serving * count;
    return {
      grams: { low: g, mid: g, high: g },
      provenance: 'packaged_serving',
      confidence: 'high',
      note: `packaged serving ${serving}g × ${count}`,
    };
  }

  // ---- Steps 3–4: retrieved / curated portion prior -------------------
  // Requires a concept id AND a resolvable unit type. Without a unit token we
  // have no basis to scale a count/slice/container prior — fall through to null.
  const conceptId = concept.conceptId;
  const unitType = resolveUnitType(quantity.unitToken);
  if (conceptId && conceptId !== AMBIGUOUS && unitType && unitType !== 'mass') {
    const prior = findPrior({
      conceptId,
      unitType,
      locale: concept.locale,
      form: concept.form,
    });
    if (prior) {
      const count = quantity.count && quantity.count > 0 ? quantity.count : 1;
      const perUnitMid = applySizeModifier(
        prior.perUnit,
        quantity.sizeModifier
      );
      // Preserve the band shape while honoring the size modifier's centering:
      // scale low/high by count too, then recentre mid on the size pick.
      const scaled = scaleBand(prior.perUnit, count);
      const grams: GramsBand = {
        low: scaled.low,
        mid: perUnitMid * count,
        high: scaled.high,
      };
      // Step 7 (width gate): a prior-derived band that is somehow too wide is
      // safer as a clarify than a confident anchor.
      if (relativeWidth(prior.perUnit) > MAX_RELATIVE_BAND_WIDTH) {
        return {
          grams: null,
          provenance: 'unresolved',
          confidence: 'none',
          unresolvedReason: 'unresolved_portion',
          note: `prior band too wide (relWidth ${relativeWidth(prior.perUnit).toFixed(2)}); clarify`,
        };
      }
      const provenance =
        prior.locale === 'global' ? 'curated_prior' : 'retrieved_prior';
      return {
        grams,
        provenance,
        confidence: prior.confidence,
        note: `prior ${prior.conceptId}/${unitType}/${prior.locale}/${prior.form} × ${count}${
          quantity.sizeModifier ? ` (size=${quantity.sizeModifier})` : ''
        } — ${prior.source}`,
      };
    }
  }

  // ---- Step 5: user-specific prior — SEAM (not implemented) -----------
  // Intentionally no branch: when confirmed-edit data exists, insert a lookup
  // here BEFORE step 6.

  // ---- Step 6: null → defer to Call 2 (LLM range) ---------------------
  return {
    grams: null,
    provenance: 'llm_range',
    confidence: 'none',
    note: unitType
      ? `no prior for concept/${unitType}; defer to Call 2 LLM range`
      : 'no resolvable unit/quantity; defer to Call 2 LLM range',
  };
}
