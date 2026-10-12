/**
 * The candidate-bearing meal-item shape Call 2 reads, and its deterministic
 * `<ingredient_data>` XML rendering. The prompt text itself lives in
 * `text/grounded-estimation.ts`.
 */
import { isVesselGuardEnabled } from '@/lib/ai/pipeline/config/prompt-ablation-flags';
import type {
  DecomposedDishV2,
  DecomposedIngredientV2,
} from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { VesselEnvelope } from '@/lib/ai/portion/vessel/envelope';
import { nameKey } from '@/lib/core/text/name-key';

export const escapeXmlAttribute = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;');

const viCollator = new Intl.Collator('vi', { sensitivity: 'base' });

export interface MatchCandidate {
  /** Stable "c1", "c2", … id assigned by the orchestrator within one ingredient. */
  id: string;
  similarity: number;
  dbName: string;
  /** The row's English name (`name_en`), rendered only for the global prompt
   *  locale so the verdict can read qualifiers the VN name obscures. */
  dbNameEn?: string | null;
  dbState: 'raw' | 'cooked' | 'unknown';
  source: 'fao' | 'usda';
  per100gKcal: number | null;
  per100gProteinG: number | null;
  per100gCarbohydrateG: number | null;
  per100gFatG: number | null;
  /** Inedible portion percentage (bones / skin / shell). Helps the LLM spot
   *  whole-bird vs specific-cut mismatches. */
  inediblePct: number | null;
}

export interface IngredientWithCandidates {
  ingredient: DecomposedIngredientV2;
  /** Candidates already sorted by similarity desc. May be empty (unmatched). */
  candidates: MatchCandidate[];
  /**
   * Server-resolved EDIBLE-mass anchor (Phase 3). Gross-as-served portion
   * resolutions are deliberately withheld from this legacy attribute and
   * remain authoritative only in the bridge, where refuse is deducted once.
   * Absent when the resolver returned null or a gross-basis band.
   */
  resolvedGramsAnchor?: number | null;
}

export interface MealItemWithCandidates {
  mealItem: DecomposedDishV2;
  ingredients: IngredientWithCandidates[];
  vesselEnvelope?: VesselEnvelope | null;
}

/** Units that count pieces of a whole dish, not of one of its parts. */
const PIECE_UNIT =
  /^(mi[eế]ng|c[aá]i|chi[eế]c|l[aá]t|piece|pieces|pc|pcs|slice|slices)$/i;

/**
 * "1 miếng tôm tonkatsu": Call 1 puts the count on the shrimp, the part the
 * dish is named after, and Call 2 then sizes one shrimp (13–40 g) instead of
 * one shrimp cutlet. When a split dish's only count is a piece count on the
 * part its name starts from, the count belongs to the whole dish.
 */
export function dishPieceCount(mi: MealItemWithCandidates): {
  ingredient: DecomposedIngredientV2;
  count: number;
  unit: string;
} | null {
  if (mi.ingredients.length < 2) return null;
  const counted = mi.ingredients.filter(
    (i) => i.ingredient.count != null && i.ingredient.unitToken
  );
  if (counted.length !== 1) return null;
  const ingredient = counted[0].ingredient;
  const { count, unitToken } = ingredient;
  if (!count || !unitToken || !PIECE_UNIT.test(unitToken.trim())) return null;
  const dish = nameKey(mi.mealItem.name);
  const part = nameKey(ingredient.rawName);
  if (!part || dish === part || !dish.includes(part)) return null;
  return { ingredient, count, unit: unitToken };
}

function renderIngredient(
  ing: IngredientWithCandidates,
  includeNameEn: boolean,
  /** The count was moved onto the dish (`dishPieceCount`). */
  countOnDish = false
): string {
  const inputIng = ing.ingredient;
  const cookingMethod = inputIng.cookingMethod;
  const stateHint = inputIng.stateHint;
  const stateNote = inputIng.stateNote;
  const prepNotes = inputIng.prepNotes ?? [];
  const cleanedPrepNotes = prepNotes
    .map((n) => (typeof n === 'string' ? n.trim() : ''))
    .filter((n) => n.length > 0);

  const attrs: string[] = [
    `name="${escapeXmlAttribute(inputIng.rawName)}"`,
    `canonicalName="${escapeXmlAttribute(inputIng.canonicalName)}"`,
  ];
  if (ing.resolvedGramsAnchor != null && ing.resolvedGramsAnchor > 0) {
    // EDIBLE server anchor. Under REFUSE_PCT_SCHEMA the model still reports
    // grossG/refusePct for telemetry, but this value remains authoritative.
    attrs.push(`resolved_grams="${ing.resolvedGramsAnchor.toFixed(1)}"`);
  }
  // User-stated quantity evidence, passed through even when the resolver
  // produced no anchor — without these the count/unit only survive in the raw
  // meal text, which the model can miss ("0 fried chicken" analyzed as one
  // serving; "2 bánh bao" sized as one).
  if (inputIng.count != null && !countOnDish) {
    attrs.push(`user_count="${inputIng.count}"`);
  }
  if (inputIng.unitToken && !countOnDish) {
    attrs.push(`user_unit="${escapeXmlAttribute(inputIng.unitToken)}"`);
  }
  if (inputIng.sizeModifier) {
    attrs.push(`user_size="${escapeXmlAttribute(inputIng.sizeModifier)}"`);
  }
  if (inputIng.explicitMass) {
    attrs.push(`user_mass_g="${inputIng.explicitMass.grams.toFixed(1)}"`);
    attrs.push(
      `mass_basis="${escapeXmlAttribute(inputIng.explicitMass.basis)}"`
    );
  }
  if (cookingMethod) {
    attrs.push(`cooking="${escapeXmlAttribute(cookingMethod)}"`);
  }
  if (stateHint && stateHint !== 'unspecified') {
    attrs.push(`state_hint="${escapeXmlAttribute(stateHint)}"`);
  }
  if (stateNote) {
    attrs.push(`state_note="${escapeXmlAttribute(stateNote)}"`);
  }
  if (cleanedPrepNotes.length > 0) {
    attrs.push(
      `prep_notes="${escapeXmlAttribute(cleanedPrepNotes.join(' | '))}"`
    );
  }

  if (ing.candidates.length === 0) {
    return `    <ingredient ${attrs.join(' ')} match_status="unmatched" />\n`;
  }

  let block = `    <ingredient ${attrs.join(' ')} match_status="matched">\n`;
  for (const c of ing.candidates) {
    const cAttrs: string[] = [
      `id="${escapeXmlAttribute(c.id)}"`,
      `similarity="${c.similarity.toFixed(3)}"`,
      `db_name="${escapeXmlAttribute(c.dbName)}"`,
      `db_state="${escapeXmlAttribute(c.dbState)}"`,
      `source="${escapeXmlAttribute(c.source)}"`,
    ];
    if (includeNameEn && c.dbNameEn && c.dbNameEn !== c.dbName) {
      // Insert right after db_name so the two names read as a pair.
      cAttrs.splice(3, 0, `db_name_en="${escapeXmlAttribute(c.dbNameEn)}"`);
    }
    if (c.per100gKcal !== null) {
      cAttrs.push(`db_per_100g_kcal="${c.per100gKcal.toFixed(1)}"`);
    }
    if (c.per100gProteinG !== null) {
      cAttrs.push(`db_per_100g_protein="${c.per100gProteinG.toFixed(1)}"`);
    }
    if (c.per100gCarbohydrateG !== null) {
      cAttrs.push(`db_per_100g_carb="${c.per100gCarbohydrateG.toFixed(1)}"`);
    }
    if (c.per100gFatG !== null) {
      cAttrs.push(`db_per_100g_fat="${c.per100gFatG.toFixed(1)}"`);
    }
    if (c.inediblePct !== null && c.inediblePct > 0) {
      cAttrs.push(`db_inedible_pct="${c.inediblePct.toFixed(0)}"`);
    }
    block += `      <candidate ${cAttrs.join(' ')} />\n`;
  }
  block += `    </ingredient>\n`;
  return block;
}

export function buildIngredientDataBlock(
  mealItems: MealItemWithCandidates[],
  options?: { includeNameEn?: boolean }
): string {
  const includeNameEn = options?.includeNameEn ?? false;
  // Sort meal items + ingredients for deterministic prompt order (helps the
  // dynamic suffix benefit from caching across similar inputs from same user).
  const sortedMealItems = [...mealItems]
    .sort((a, b) => viCollator.compare(a.mealItem.name, b.mealItem.name))
    .map((mi) => ({
      ...mi,
      ingredients: [...mi.ingredients].sort((a, b) =>
        viCollator.compare(a.ingredient.rawName, b.ingredient.rawName)
      ),
    }));

  let out = '<ingredient_data>\n';
  for (const mi of sortedMealItems) {
    const attrs = [
      `name="${escapeXmlAttribute(mi.mealItem.name)}"`,
      `cookingMethod="${escapeXmlAttribute(mi.mealItem.cookingMethod)}"`,
    ];
    if (mi.vesselEnvelope) {
      const vesselGuardEnabled = isVesselGuardEnabled();
      const vesselSize =
        mi.mealItem.vesselSize ??
        (mi.vesselEnvelope.tier === 1
          ? 'small'
          : mi.vesselEnvelope.tier === 2
            ? 'medium'
            : 'large');
      attrs.push(
        `vessel="${escapeXmlAttribute(mi.vesselEnvelope.token)}"`,
        `vessel_size="${escapeXmlAttribute(vesselSize)}"`
      );
      if (vesselGuardEnabled) {
        attrs.push(`vessel_ml="${mi.vesselEnvelope.vesselMl}"`);
      }
      attrs.push(
        `dish_class="${escapeXmlAttribute(mi.vesselEnvelope.dishClass)}"`
      );
      if (vesselGuardEnabled) {
        attrs.push(
          `serve_total_guard_g="${mi.vesselEnvelope.guardG.low}-${mi.vesselEnvelope.guardG.high}"`
        );
      }
    }
    const dishCount = dishPieceCount(mi);
    if (dishCount) {
      attrs.push(
        `dish_count="${dishCount.count}"`,
        `dish_unit="${escapeXmlAttribute(dishCount.unit)}"`
      );
    }
    out += `  <meal_item ${attrs.join(' ')}>\n`;
    for (const ing of mi.ingredients) {
      out += renderIngredient(
        ing,
        includeNameEn,
        ing.ingredient === dishCount?.ingredient
      );
    }
    out += `  </meal_item>\n`;
  }
  out += '</ingredient_data>';
  return out;
}
