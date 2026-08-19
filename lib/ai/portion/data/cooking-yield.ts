/**
 * Cooked-to-raw weight conversion factors by cooking method.
 * Multiplied by cooked weight to get raw equivalent weight.
 * E.g., 150g cooked rice × 0.38 = 57g raw rice.
 *
 * Sources: FAO food yield factors for Vietnamese ingredients.
 * Data only — the lookup that applies it lives in ../cooked-to-raw.ts.
 */
export const COOKED_TO_RAW_FACTOR: Record<string, number> = {
  // Vietnamese cooking methods
  nấu: 0.38, // rice/grains: cooked is ~2.6× heavier than raw (1/2.6 ≈ 0.38)
  luộc: 0.75, // boiled: slight water absorption (meat/eggs)
  chiên: 0.85, // fried: loses moisture
  xào: 0.85, // stir-fried: loses moisture
  kho: 0.8, // braised: loses some moisture, absorbs sauce
  nướng: 0.75, // grilled: loses moisture/fat
  hấp: 0.9, // steamed: minimal change
  rán: 0.85, // deep-fried: loses moisture
  rang: 0.85, // dry-roasted: loses moisture
  ninh: 0.75, // slow-simmered: loses moisture (similar to boiled)
  // English cooking method aliases
  boil: 0.75,
  boiled: 0.75,
  simmer: 0.75,
  simmered: 0.75,
  'slow-simmer': 0.75,
  'slow-simmered': 0.75,
  braise: 0.8,
  braised: 0.8,
  fry: 0.85,
  fried: 0.85,
  'pan-fry': 0.85,
  'pan-fried': 0.85,
  'deep-fry': 0.85,
  'deep-fried': 0.85,
  'stir-fry': 0.85,
  'stir-fried': 0.85,
  grill: 0.75,
  grilled: 0.75,
  roast: 0.75,
  roasted: 0.75,
  bake: 0.75,
  baked: 0.75,
  steam: 0.9,
  steamed: 0.9,
  'dry-roast': 0.85,
  'dry-roasted': 0.85,
};

/** Default cooked-to-raw factor when cooking method is unknown or null */
export const DEFAULT_COOKED_TO_RAW_FACTOR = 1.0;
