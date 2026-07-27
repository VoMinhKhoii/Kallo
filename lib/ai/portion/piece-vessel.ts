import { nearestPieceTier, normalizeVesselToken } from './vessel-data';
import type { PieceVessel } from './vessel-types';

const DOMINANT_SHARE = 0.85;

/**
 * Cut-like tokens supported by the quantity resolver plus common Call-1
 * variants for the same physical piece/slice concepts.
 */
export const PIECE_UNIT_TOKENS = new Set([
  'mieng',
  'lat',
  'khuc',
  'khua',
  'khoanh',
  'phi le',
  'fillet',
  'piece',
  'pieces',
  'slice',
  'slices',
  'steak',
  'chunk',
  'cut',
]);

const ANIMAL_PROTEIN =
  /\b(ca|fish|salmon|tuna|basa|mackerel|cod|trout|bo|heo|thit|beef|pork|steak|ba chi|suon|lamb|cuu|ga|chicken|vit|duck|muc|squid|tom|shrimp|prawn|cua|crab)\b/;

const FISH_OR_SEAFOOD =
  /\b(ca|fish|salmon|tuna|basa|mackerel|cod|trout|muc|squid|tom|shrimp|prawn|cua|crab)\b/;

const POULTRY = /\b(ga|chicken|vit|duck|turkey|quail|chim cut|cut bird)\b/;

const FOOD_GROUP_KIND_RULES: ReadonlyArray<{
  fragments: readonly string[];
  kind: PieceVessel['kind'] | null;
}> = [
  { fragments: ['sausages and luncheon meats'], kind: null },
  {
    fragments: [
      'finfish and shellfish products',
      'fish, shellfish and products',
    ],
    kind: 'fish',
  },
  { fragments: ['poultry products'], kind: 'poultry' },
  {
    fragments: [
      'beef products',
      'pork products',
      'lamb, veal, and game products',
      'meat and meat products',
    ],
    kind: 'meat',
  },
];

function normalizeWords(value: string): string {
  return normalizeVesselToken(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isAnimalProtein(names: string): boolean {
  return ANIMAL_PROTEIN.test(normalizeWords(names));
}

function pieceKind(names: string): PieceVessel['kind'] {
  const normalized = normalizeWords(names);
  if (FISH_OR_SEAFOOD.test(normalized)) return 'fish';
  if (POULTRY.test(normalized)) return 'poultry';
  return 'meat';
}

function pieceKindFromFoodGroup(
  foodGroupEn: string
): PieceVessel['kind'] | null {
  const normalized = foodGroupEn.trim().toLocaleLowerCase('en');
  for (const rule of FOOD_GROUP_KIND_RULES) {
    if (rule.fragments.some((fragment) => normalized.includes(fragment))) {
      return rule.kind;
    }
  }
  return null;
}

export interface PieceDishLike {
  ingredients: Array<{
    rawName?: string;
    canonicalName?: string;
    count?: number;
    unitToken?: string;
  }>;
}

export interface PieceMealItemLike {
  vessel?: unknown;
  ingredients: Array<{
    ingredientName: string;
    estimatedGrams: number;
    foodGroupEn?: string;
  }>;
}

/** Derive deterministic piece metadata from Call-1 quantity evidence. */
export function resolvePieceVessel(
  mealItem: PieceMealItemLike,
  dish: PieceDishLike
): (PieceVessel & { provenance: 'piece_prior' }) | null {
  if (mealItem.vessel || mealItem.ingredients.length === 0) return null;

  const displayedTotal = mealItem.ingredients.reduce(
    (sum, ingredient) => sum + ingredient.estimatedGrams,
    0
  );
  if (!(displayedTotal > 0)) return null;

  const dominantIngredients = mealItem.ingredients
    .map((ingredient) => ({
      ingredient,
      share: ingredient.estimatedGrams / displayedTotal,
    }))
    .filter(({ share }) => share >= DOMINANT_SHARE);
  if (dominantIngredients.length !== 1) return null;

  const dominant = dominantIngredients[0];
  const dominantName = normalizeWords(dominant.ingredient.ingredientName);
  if (!dominantName) return null;

  const sources = dish.ingredients.filter(
    (ingredient) =>
      normalizeWords(ingredient.rawName ?? '') === dominantName ||
      normalizeWords(ingredient.canonicalName ?? '') === dominantName
  );
  if (sources.length !== 1) return null;

  const source = sources[0];
  if (source.count === undefined || source.count < 1) return null;
  if (
    !source.unitToken ||
    !PIECE_UNIT_TOKENS.has(normalizeWords(source.unitToken))
  ) {
    return null;
  }

  const sourceNames = `${source.rawName} ${source.canonicalName}`;
  const kind = dominant.ingredient.foodGroupEn
    ? pieceKindFromFoodGroup(dominant.ingredient.foodGroupEn)
    : isAnimalProtein(sourceNames)
      ? pieceKind(sourceNames)
      : null;
  if (!kind) return null;

  const dominantGrams = displayedTotal * dominant.share;
  return {
    family: 'piece',
    tier: nearestPieceTier(dominantGrams / source.count),
    count: source.count,
    kind,
    provenance: 'piece_prior',
  };
}
