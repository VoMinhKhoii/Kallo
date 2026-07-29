/**
 * Persistent barcode cache, stored in `vietnamese_food_composition`.
 *
 * Rows are keyed `<prefix><barcode>`, so the same barcode can legitimately be
 * cached under more than one provider. Reads therefore fetch every prefixed id
 * in one query and pick the winner by provider rank in JS — never by returned
 * row order, which Postgres does not define for an `IN` list.
 *
 * A cache hit short-circuits the provider chain, so an existing `off_` row is
 * never upgraded to a higher-ranked source. That is deliberate: a repeat scan
 * must stay instant and free. A future backfill that inserts `fdc_` siblings
 * would be preferred automatically by the rank-ordered read, with no code
 * change here.
 */
import { inArray } from 'drizzle-orm';
import { extractNutritionValues } from '@/lib/actions/persisted-meal';
import { parseSizeGrams } from '@/lib/barcode/providers/normalize';
import type {
  BarcodeProviderId,
  ParsedBarcodeProduct,
} from '@/lib/barcode/types';
import { db } from '@/lib/db';
import { ingredientSources, vietnameseFoodComposition } from '@/lib/db/schema';

/** Primary-key prefix per provider. Legacy rows are all `off_`. */
export const BARCODE_CACHE_PREFIXES: Record<BarcodeProviderId, string> = {
  usda_fdc: 'fdc_',
  off: 'off_',
};

/** `ingredient_sources.code` each provider's rows are attributed to. */
export const BARCODE_SOURCE_CODES: Record<BarcodeProviderId, string> = {
  usda_fdc: 'USDA_FDC',
  off: 'OFF',
};

/** Provider preference for cache reads, best first. */
export const BARCODE_PROVIDER_RANK: readonly BarcodeProviderId[] = [
  'usda_fdc',
  'off',
];

export function barcodeCacheId(
  providerId: BarcodeProviderId,
  barcode: string
): string {
  return `${BARCODE_CACHE_PREFIXES[providerId]}${barcode}`;
}

type BarcodeCacheRow = typeof vietnameseFoodComposition.$inferSelect;

/**
 * The best cached row for a barcode across all providers, or undefined.
 * Used by both the search and the staging path, so staging resolves whichever
 * provider actually answered without needing a provider hint in its input.
 */
export async function findCachedRow(
  barcode: string
): Promise<BarcodeCacheRow | undefined> {
  const rankedIds = BARCODE_PROVIDER_RANK.map((providerId) =>
    barcodeCacheId(providerId, barcode)
  );

  const rows = await db
    .select()
    .from(vietnameseFoodComposition)
    .where(inArray(vietnameseFoodComposition.id, rankedIds))
    .limit(rankedIds.length);

  for (const id of rankedIds) {
    const row = rows.find((candidate) => candidate.id === id);
    if (row) return row;
  }
  return undefined;
}

/**
 * Rebuild the product shape from a cached row. Legacy rows are NOT put through
 * the chain's nutrition gate: meals already logged against a nutrition-less
 * row must keep resolving.
 */
export function rowToProduct(
  barcode: string,
  row: BarcodeCacheRow
): ParsedBarcodeProduct {
  // Parse brand and name from primary name e.g. "[Coca-Cola] Original Taste"
  let brand: string | null = null;
  let name = row.namePrimary;
  const brandMatch = row.namePrimary.match(/^\[(.*?)\]\s*(.*)$/);
  if (brandMatch) {
    brand = brandMatch[1];
    name = brandMatch[2];
  }

  const nutrition = extractNutritionValues(row);

  return {
    barcode,
    name,
    brand,
    caloriesKcal: nutrition.caloriesKcal,
    proteinG: nutrition.proteinG,
    carbohydrateG: nutrition.carbohydrateG,
    fatG: nutrition.fatG,
    fiberG: nutrition.fiberG,
    sodiumMg: nutrition.sodiumMg,
    // numeric columns surface as strings; run through the same sizing
    // validation as ingestion so cache reads apply the identical
    // positivity + 100kg-cap invariant (single source of truth).
    servingSizeG: parseSizeGrams(row.servingSizeG),
    packageSizeG: parseSizeGrams(row.packageSizeG),
  };
}

/** Every provider's `ingredient_sources` id, keyed by code, in one query. */
export async function getBarcodeSourceIds(): Promise<Map<string, number>> {
  const codes = Object.values(BARCODE_SOURCE_CODES);

  const rows = await db
    .select({ id: ingredientSources.id, code: ingredientSources.code })
    .from(ingredientSources)
    .where(inArray(ingredientSources.code, codes))
    .limit(codes.length);

  return new Map(rows.map((row) => [row.code, row.id]));
}

export async function cacheBarcodeProduct(params: {
  providerId: BarcodeProviderId;
  barcode: string;
  product: ParsedBarcodeProduct;
  sourceId: number;
}): Promise<void> {
  const { providerId, barcode, product, sourceId } = params;
  const namePrimary = product.brand
    ? `[${product.brand}] ${product.name}`
    : product.name;

  // onConflictDoNothing: two concurrent first-time scans of the same barcode
  // would otherwise race on the primary key; the loser is harmlessly ignored.
  await db
    .insert(vietnameseFoodComposition)
    .values({
      id: barcodeCacheId(providerId, barcode),
      namePrimary,
      nameEn: product.name,
      typeVn: 'Sản phẩm đóng gói',
      typeEn: 'Packaged product',
      sourceId,
      state: 'cooked',
      servingSizeG:
        product.servingSizeG !== null ? String(product.servingSizeG) : null,
      packageSizeG:
        product.packageSizeG !== null ? String(product.packageSizeG) : null,
      caloriesKcal:
        product.caloriesKcal !== null ? String(product.caloriesKcal) : null,
      proteinG: product.proteinG !== null ? String(product.proteinG) : null,
      carbohydrateG:
        product.carbohydrateG !== null ? String(product.carbohydrateG) : null,
      fatG: product.fatG !== null ? String(product.fatG) : null,
      fiberG: product.fiberG !== null ? String(product.fiberG) : null,
      sodiumMg: product.sodiumMg !== null ? String(product.sodiumMg) : null,
      // search_text / search_text_ascii are owned by the
      // `on_food_composition_search_text` trigger (migration 20260301022622):
      // it derives search_text from the name columns and unaccents
      // search_text_ascii in Postgres. Supplying them here would be dead
      // writes that mask where the real fold happens.
    })
    .onConflictDoNothing({ target: vietnameseFoodComposition.id });
}
