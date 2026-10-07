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
 *
 * The one exception is a row older than {@link BARCODE_DATA_VERSION}: the
 * parser has learned something since it was written, so its next scan re-asks
 * the same provider once and overwrites it in place (`service.ts`).
 */
import { getTableColumns, inArray, type SQL, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { extractNutritionValues } from '@/lib/actions/logging/persisted-meal';
import type { NutritionValues } from '@/lib/ai/types/nutrition-values';
import { trustedProductImageUrl } from '@/lib/domain/barcode/image/image';
import { parseSizeGrams } from '@/lib/domain/barcode/providers/normalize';
import {
  BARCODE_MICRONUTRIENT_KEYS,
  type BarcodeMicronutrients,
  type BarcodeProductRecord,
  type BarcodeProviderId,
  parseAmountUnit,
} from '@/lib/domain/barcode/types';
import { db } from '@/lib/infra/db/client';
import {
  ingredientSources,
  vietnameseFoodComposition,
} from '@/lib/infra/db/schema';

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

/**
 * The parser generation a cached row was written by. Bump it whenever a
 * provider adapter starts reading something new: every older row then heals on
 * its next scan, with no backfill. 1 = unit, micronutrients and photo.
 * 2 = macros the label's energy proves zero (`providers/zero-macros.ts`).
 */
export const BARCODE_DATA_VERSION = 2;

export function barcodeCacheId(
  providerId: BarcodeProviderId,
  barcode: string
): string {
  return `${BARCODE_CACHE_PREFIXES[providerId]}${barcode}`;
}

/** One cached product row. Exported because the meal-item builder maps it. */
export type BarcodeCacheRow = typeof vietnameseFoodComposition.$inferSelect;

/** Which provider wrote a cached row, read off its id prefix. */
export function providerIdOfRow(
  row: BarcodeCacheRow
): BarcodeProviderId | null {
  return (
    BARCODE_PROVIDER_RANK.find((providerId) =>
      row.id.startsWith(BARCODE_CACHE_PREFIXES[providerId])
    ) ?? null
  );
}

/** Whether a row predates the current parser and should be re-fetched. */
export function isStaleBarcodeRow(row: BarcodeCacheRow): boolean {
  return (row.barcodeDataVersion ?? 0) < BARCODE_DATA_VERSION;
}

/**
 * The best cached row for EACH of `barcodes`, keyed by barcode. Barcodes with
 * nothing cached are simply absent from the map.
 *
 * One query for the whole batch: a composer submit can carry up to 20 scanned
 * picks, and resolving them one at a time would be 20 sequential round trips
 * against a pool that defaults to two connections. Duplicates collapse first,
 * so scanning the same carton twice costs one id in the `IN` list.
 *
 * The winner per barcode is chosen by {@link BARCODE_PROVIDER_RANK} in JS —
 * never by returned row order, which Postgres does not define for an `IN` list.
 */
export async function findCachedRows(
  barcodes: string[]
): Promise<Map<string, BarcodeCacheRow>> {
  const unique = [...new Set(barcodes)];
  if (unique.length === 0) return new Map();

  const ids = unique.flatMap((barcode) =>
    BARCODE_PROVIDER_RANK.map((providerId) =>
      barcodeCacheId(providerId, barcode)
    )
  );

  const rows = await db
    .select()
    .from(vietnameseFoodComposition)
    .where(inArray(vietnameseFoodComposition.id, ids))
    .limit(ids.length);

  const byId = new Map(rows.map((row) => [row.id, row]));
  const best = new Map<string, BarcodeCacheRow>();
  for (const barcode of unique) {
    for (const providerId of BARCODE_PROVIDER_RANK) {
      const row = byId.get(barcodeCacheId(providerId, barcode));
      if (row) {
        best.set(barcode, row);
        break;
      }
    }
  }
  return best;
}

/**
 * The best cached row for a barcode across all providers, or undefined.
 * Used by both the search and the staging path, so staging resolves whichever
 * provider actually answered without needing a provider hint in its input.
 *
 * A single-element {@link findCachedRows}, deliberately: there is ONE ranking
 * rule, and a second copy of it here is how the batch read and the single read
 * would eventually disagree about which provider wins.
 */
export async function findCachedRow(
  barcode: string
): Promise<BarcodeCacheRow | undefined> {
  const rows = await findCachedRows([barcode]);
  return rows.get(barcode);
}

/**
 * Rebuild the product shape from a cached row. Legacy rows are NOT put through
 * the chain's nutrition gate: meals already logged against a nutrition-less
 * row must keep resolving.
 */
export function rowToRecord(
  barcode: string,
  row: BarcodeCacheRow
): BarcodeProductRecord {
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
    amountUnit: parseAmountUnit(row.amountUnit),
    micronutrients: pickMicronutrients(nutrition),
    sourceImageUrl: trustedProductImageUrl(row.imageUrl),
  };
}

function pickMicronutrients(nutrition: NutritionValues): BarcodeMicronutrients {
  const result: BarcodeMicronutrients = {};
  for (const key of BARCODE_MICRONUTRIENT_KEYS) {
    const value = nutrition[key];
    if (value !== null) result[key] = value;
  }
  return result;
}

const toNumeric = (value: number | null | undefined): string | null =>
  value === null || value === undefined ? null : String(value);

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

/**
 * Write a provider's product to its row, or overwrite that row in place.
 *
 * The overwrite is what lets a stale row heal. It touches only what the
 * provider supplies (sizing, unit, photo, nutrition) and stamps the version;
 * the names stay as first cached, so search text, embeddings and the names on
 * already-logged meals never move under a refresh. A refresh fills and
 * corrects but never ERASES: a field the provider now omits keeps its stored
 * value, because OFF has been seen silently dropping fields from a response.
 * Two concurrent first scans both write the same provider answer, so the race
 * is harmless.
 */
export async function cacheBarcodeProduct(params: {
  providerId: BarcodeProviderId;
  barcode: string;
  product: BarcodeProductRecord;
  sourceId: number;
}): Promise<void> {
  const { providerId, barcode, product, sourceId } = params;
  const namePrimary = product.brand
    ? `[${product.brand}] ${product.name}`
    : product.name;

  const providerData = {
    servingSizeG: toNumeric(product.servingSizeG),
    packageSizeG: toNumeric(product.packageSizeG),
    amountUnit: product.amountUnit,
    imageUrl: product.sourceImageUrl,
    barcodeDataVersion: BARCODE_DATA_VERSION,
    caloriesKcal: toNumeric(product.caloriesKcal),
    proteinG: toNumeric(product.proteinG),
    carbohydrateG: toNumeric(product.carbohydrateG),
    fatG: toNumeric(product.fatG),
    fiberG: toNumeric(product.fiberG),
    sodiumMg: toNumeric(product.sodiumMg),
    ...Object.fromEntries(
      BARCODE_MICRONUTRIENT_KEYS.map((key) => [
        key,
        toNumeric(product.micronutrients[key]),
      ])
    ),
  };

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
      ...providerData,
      // search_text / search_text_ascii are owned by the
      // `on_food_composition_search_text` trigger (migration 20260301022622):
      // it derives search_text from the name columns and unaccents
      // search_text_ascii in Postgres. Supplying them here would be dead
      // writes that mask where the real fold happens.
    })
    .onConflictDoUpdate({
      target: vietnameseFoodComposition.id,
      set: keepStoredWhenOmitted(Object.keys(providerData)),
    });
}

/** `coalesce(excluded.<col>, <col>)` for each key: the fresh value, else the stored one. */
function keepStoredWhenOmitted(keys: string[]): Record<string, SQL> {
  const columns = getTableColumns(vietnameseFoodComposition) as Record<
    string,
    AnyPgColumn
  >;
  return Object.fromEntries(
    keys.map((key) => {
      const column = columns[key];
      return [
        key,
        sql`coalesce(excluded.${sql.identifier(column.name)}, ${column})`,
      ];
    })
  );
}
