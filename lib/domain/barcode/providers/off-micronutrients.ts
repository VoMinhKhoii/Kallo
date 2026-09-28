/**
 * Open Food Facts micronutrients → our per-100 keys.
 *
 * OFF normalizes every `<nutrient>_100g` mass to grams whatever unit the label
 * was typed in (Vinamilk fresh milk: `calcium_100g: 0.11` with
 * `calcium_unit: "g"` for a printed 110 mg), so each key needs only a fixed
 * factor to our mg / mcg columns. Values are per 100 g or per 100 ml, matching
 * the product's `amountUnit`.
 */
import { parseNumber } from '@/lib/domain/barcode/providers/normalize';
import type {
  BarcodeMicronutrientKey,
  BarcodeMicronutrients,
} from '@/lib/domain/barcode/types';

const MG_PER_G = 1_000;
const MCG_PER_G = 1_000_000;

const OFF_MICRONUTRIENTS: Record<
  BarcodeMicronutrientKey,
  { offKey: string; factor: number }
> = {
  calciumMg: { offKey: 'calcium', factor: MG_PER_G },
  ironMg: { offKey: 'iron', factor: MG_PER_G },
  magnesiumMg: { offKey: 'magnesium', factor: MG_PER_G },
  phosphorusMg: { offKey: 'phosphorus', factor: MG_PER_G },
  potassiumMg: { offKey: 'potassium', factor: MG_PER_G },
  zincMg: { offKey: 'zinc', factor: MG_PER_G },
  copperMcg: { offKey: 'copper', factor: MCG_PER_G },
  manganeseMg: { offKey: 'manganese', factor: MG_PER_G },
  betaCaroteneMcg: { offKey: 'beta-carotene', factor: MCG_PER_G },
  vitaminAMcg: { offKey: 'vitamin-a', factor: MCG_PER_G },
  vitaminDMcg: { offKey: 'vitamin-d', factor: MCG_PER_G },
  vitaminEMg: { offKey: 'vitamin-e', factor: MG_PER_G },
  vitaminKMcg: { offKey: 'vitamin-k', factor: MCG_PER_G },
  vitaminCMg: { offKey: 'vitamin-c', factor: MG_PER_G },
  vitaminB1Mg: { offKey: 'vitamin-b1', factor: MG_PER_G },
  vitaminB2Mg: { offKey: 'vitamin-b2', factor: MG_PER_G },
  vitaminPpMg: { offKey: 'vitamin-pp', factor: MG_PER_G },
  vitaminB5Mg: { offKey: 'pantothenic-acid', factor: MG_PER_G },
  vitaminB6Mg: { offKey: 'vitamin-b6', factor: MG_PER_G },
  vitaminB9Mcg: { offKey: 'vitamin-b9', factor: MCG_PER_G },
  vitaminB12Mcg: { offKey: 'vitamin-b12', factor: MCG_PER_G },
  vitaminHMcg: { offKey: 'biotin', factor: MCG_PER_G },
};

/**
 * No single micronutrient can outweigh the 100 g basis it is stated against;
 * a larger figure is a typo or a unit slip, not data.
 */
const MAX_GRAMS_PER_100 = 100;

/** Rounds away float noise from the unit conversion (0.11 × 1000). */
function round3(value: number): number {
  return Number(value.toFixed(3));
}

export function parseOffMicronutrients(
  nutriments: Record<string, unknown> | null | undefined
): BarcodeMicronutrients {
  const result: BarcodeMicronutrients = {};
  if (!nutriments) return result;

  for (const [key, { offKey, factor }] of Object.entries(OFF_MICRONUTRIENTS)) {
    const grams = parseNumber(nutriments[`${offKey}_100g`]);
    if (grams === null || grams < 0 || grams > MAX_GRAMS_PER_100) continue;
    result[key as BarcodeMicronutrientKey] = round3(grams * factor);
  }
  return result;
}
