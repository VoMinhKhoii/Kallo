/**
 * Provider chain for barcode lookup.
 *
 * Every configured provider is dispatched at once and the results are awaited
 * in rank order — a hedge, not a cascade, so a lower-ranked source never adds
 * latency to a higher-ranked hit and the worst case is the slowest single
 * provider rather than their sum.
 *
 * Selection is by nutrition usability, not by barcode match: a product card
 * with no calories cannot be logged, so such a "hit" must never shadow a
 * lower-ranked source that carries real values. A gated candidate that is also
 * complete ends the chain immediately; an incomplete one is held and only
 * returned if nothing better arrives.
 *
 * There is deliberately no `withRetry` here. The chain IS the redundancy:
 * re-asking a source that just failed would spend the scan's latency budget
 * twice while a sibling's answer is already in flight.
 */
import {
  BARCODE_CACHE_PREFIXES,
  BARCODE_PROVIDER_RANK,
  BARCODE_SOURCE_CODES,
} from '@/lib/barcode/cache';
import {
  fetchProductFromOpenFoodFacts,
  OFF_TIMEOUT_MS,
} from '@/lib/barcode/openfoodfacts';
import {
  hasUsableNutrition,
  isNutritionComplete,
  isPlausiblePer100g,
  nutritionCompleteness,
} from '@/lib/barcode/providers/normalize';
import type {
  BarcodeProvider,
  BarcodeProviderEnv,
} from '@/lib/barcode/providers/types';
import type {
  BarcodeProviderId,
  ParsedBarcodeProduct,
} from '@/lib/barcode/types';

const openFoodFactsProvider: BarcodeProvider = {
  id: 'off',
  sourceCode: BARCODE_SOURCE_CODES.off,
  cachePrefix: BARCODE_CACHE_PREFIXES.off,
  timeoutMs: OFF_TIMEOUT_MS,
  // Open Food Facts is an open API — no credentials to check.
  isConfigured: () => true,
  fetch: (barcode, timeoutMs) =>
    fetchProductFromOpenFoodFacts(barcode, timeoutMs),
};

const PROVIDER_DESCRIPTORS: Partial<
  Record<BarcodeProviderId, BarcodeProvider>
> = {
  off: openFoodFactsProvider,
};

/**
 * Providers in resolution order. Ordered by the cache's rank so a fresh lookup
 * and a cache read can never disagree about which source wins.
 */
export const BARCODE_PROVIDERS: readonly BarcodeProvider[] =
  BARCODE_PROVIDER_RANK.map((id) => PROVIDER_DESCRIPTORS[id]).filter(
    (provider): provider is BarcodeProvider => provider !== undefined
  );

export interface BarcodeChainResult {
  provider: BarcodeProvider;
  product: ParsedBarcodeProduct;
}

export async function resolveBarcodeProduct(
  barcode: string,
  env: BarcodeProviderEnv = process.env
): Promise<BarcodeChainResult | null> {
  const inFlight = BARCODE_PROVIDERS.filter((provider) => {
    if (provider.isConfigured(env)) return true;
    console.info(
      `Barcode provider ${provider.id} is not configured — skipping`
    );
    return false;
  }).map((provider) => ({
    provider,
    // The rejection handler is attached at dispatch, not at await: returning
    // early leaves siblings in flight, and their rejection must never surface
    // as an unhandled one.
    settled: provider.fetch(barcode, provider.timeoutMs).catch((error) => {
      console.error(`Barcode provider ${provider.id} threw:`, error);
      return null;
    }),
  }));

  let fallback: BarcodeChainResult | null = null;
  let fallbackScore = -1;

  for (const { provider, settled } of inFlight) {
    const product = await settled;
    if (!product) continue;

    if (!isPlausiblePer100g(product)) {
      console.warn(
        `Barcode provider ${provider.id} returned implausible per-100g values for ${barcode} — discarded`
      );
      continue;
    }

    if (!hasUsableNutrition(product)) {
      console.info(
        `Barcode provider ${provider.id} matched ${barcode} but carries no nutrition — discarded`
      );
      continue;
    }

    if (isNutritionComplete(product)) {
      return { provider, product };
    }

    const score = nutritionCompleteness(product);
    if (score > fallbackScore) {
      fallback = { provider, product };
      fallbackScore = score;
    }
  }

  return fallback;
}
