import type { NutritionNutrientKey } from '@/lib/domain/nutrition/types';

/**
 * Stable, locale-agnostic error codes for the barcode flow. Clients map them
 * to a localized message (web: `t('barcodeError.<code>')`; mobile:
 * `logging.barcode.error.*`). Server-side text is never returned directly, so
 * error copy honors the user's locale.
 *
 * Lives in a dependency-light module (like `constants.ts`) so contracts and
 * clients can import it without pulling in server-only code.
 */
export type BarcodeErrorCode =
  | 'invalid_input'
  | 'not_found'
  | 'not_cached'
  | 'stage_failed'
  | 'rate_limited'
  | 'server_error';

/**
 * Identifier for a barcode lookup source. Doubles as the key for its cache
 * prefix (`lib/domain/barcode/cache.ts`) and its chain descriptor
 * (`lib/domain/barcode/chain.ts`).
 */
export type BarcodeProviderId = 'usda_fdc' | 'off';

/**
 * The unit a product is measured in: 'ml' for drinks labelled per 100ml, 'g'
 * otherwise. Sizes, the logged amount and the per-100 nutrition all share it,
 * so per-100ml values scaled by millilitres are exact. Stored amounts treat
 * 1 ml as 1 g, as the nutrition-label scan does.
 */
export type BarcodeAmountUnit = 'g' | 'ml';

/** A stored unit. Rows cached before units were stored hold null: grams. */
export function parseAmountUnit(value: unknown): BarcodeAmountUnit {
  return value === 'ml' ? 'ml' : 'g';
}

/**
 * The micronutrients a product can carry beyond fiber and sodium, which have
 * their own fields. All of them are Premium to see and always saved.
 */
export type BarcodeMicronutrientKey = Exclude<
  NutritionNutrientKey,
  'fiberG' | 'sodiumMg'
>;

/** Per-100 micronutrient values, keyed like `NutritionValues`. */
export type BarcodeMicronutrients = Partial<
  Record<BarcodeMicronutrientKey, number>
>;

export const BARCODE_MICRONUTRIENT_KEYS = [
  'calciumMg',
  'ironMg',
  'magnesiumMg',
  'phosphorusMg',
  'potassiumMg',
  'zincMg',
  'copperMcg',
  'manganeseMg',
  'betaCaroteneMcg',
  'vitaminAMcg',
  'vitaminDMcg',
  'vitaminEMg',
  'vitaminKMcg',
  'vitaminCMg',
  'vitaminB1Mg',
  'vitaminB2Mg',
  'vitaminPpMg',
  'vitaminB5Mg',
  'vitaminB6Mg',
  'vitaminB9Mcg',
  'vitaminB12Mcg',
  'vitaminHMcg',
] as const satisfies readonly BarcodeMicronutrientKey[];

/**
 * A barcode product as the search route and action return it: per-100
 * nutrition in `amountUnit` plus optional sizing. Mirrored field-for-field by
 * the Flutter client (`apps/mobile-flutter/lib/models/nutrition/barcode_product.dart`)
 * and re-exported by the REST contract, so the field set is a cross-client
 * contract: renaming or removing a field breaks mobile; adding one does not.
 */
export interface ParsedBarcodeProduct {
  barcode: string;
  name: string;
  brand: string | null;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
  /** Premium: null for a viewer without micronutrient access. */
  fiberG: number | null;
  /** Premium: null for a viewer without micronutrient access. */
  sodiumMg: number | null;
  /** Amount per serving in `amountUnit`, if the provider gives a plausible value. */
  servingSizeG: number | null;
  /** Amount in the whole package in `amountUnit`, if plausible. */
  packageSizeG: number | null;
  amountUnit: BarcodeAmountUnit;
  /** Our proxy path for the product photo, never the provider's URL. */
  imageUrl: string | null;
  /** Premium: null for a viewer without micronutrient access. */
  micronutrients: BarcodeMicronutrients | null;
}

/**
 * A product as every provider adapter returns it and the store persists it.
 * Server-internal: it carries the provider's own photo URL, which clients
 * never see, and micronutrients no viewer gate has touched yet.
 */
export interface BarcodeProductRecord
  extends Omit<ParsedBarcodeProduct, 'imageUrl' | 'micronutrients'> {
  micronutrients: BarcodeMicronutrients;
  sourceImageUrl: string | null;
}
