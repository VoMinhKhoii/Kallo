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
import {
  FDC_TIMEOUT_MS,
  fetchProductFromUsdaFdc,
} from '@/lib/barcode/providers/usda-fdc';
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

const usdaFdcProvider: BarcodeProvider = {
  id: 'usda_fdc',
  sourceCode: BARCODE_SOURCE_CODES.usda_fdc,
  cachePrefix: BARCODE_CACHE_PREFIXES.usda_fdc,
  timeoutMs: FDC_TIMEOUT_MS,
  isConfigured: (env) => Boolean(env.USDA_API_KEY),
  fetch: (barcode, timeoutMs) => fetchProductFromUsdaFdc(barcode, timeoutMs),
};

// Total, not Partial: adding a BarcodeProviderId must fail compilation until a
// descriptor exists for it.
const PROVIDER_DESCRIPTORS: Record<BarcodeProviderId, BarcodeProvider> = {
  usda_fdc: usdaFdcProvider,
  off: openFoodFactsProvider,
};

/**
 * Providers in resolution order. Ordered by the cache's rank so a fresh lookup
 * and a cache read can never disagree about which source wins.
 */
export const BARCODE_PROVIDERS: readonly BarcodeProvider[] =
  BARCODE_PROVIDER_RANK.map((id) => PROVIDER_DESCRIPTORS[id]);

export interface BarcodeChainResult {
  provider: BarcodeProvider;
  product: ParsedBarcodeProduct;
}

export interface BarcodeChainOptions {
  env?: BarcodeProviderEnv;
  /**
   * `ingredient_sources.code`s that actually exist in the database. When given,
   * a provider whose source row is absent is skipped: its answer could not be
   * cached and would fail the lookup outright, so it must degrade instead.
   */
  seededSourceCodes?: ReadonlySet<string>;
}

export async function resolveBarcodeProduct(
  barcode: string,
  opts: BarcodeChainOptions = {}
): Promise<BarcodeChainResult | null> {
  const { env = process.env, seededSourceCodes } = opts;

  const inFlight = BARCODE_PROVIDERS.filter((provider) => {
    if (seededSourceCodes && !seededSourceCodes.has(provider.sourceCode)) {
      // A missing seed row is a real misconfiguration (the migration has not
      // been applied) — log loudly, but degrade to the other providers rather
      // than failing the scan.
      console.error(
        `Barcode provider ${provider.id} has no '${provider.sourceCode}' ingredient source — skipping`
      );
      return false;
    }
    if (provider.isConfigured(env)) return true;
    console.info(
      `Barcode provider ${provider.id} is not configured — skipping`
    );
    return false;
  }).map((provider) => ({
    provider,
    // The rejection handler is attached at dispatch, not at await: returning
    // early leaves siblings in flight, and their rejection must never surface
    // as an unhandled one. The Promise.resolve().then() wrapper is load-bearing
    // too: the descriptor seam is public, so a synchronous throw from `fetch`
    // must be contained exactly like an async one.
    settled: Promise.resolve()
      .then(() => provider.fetch(barcode, provider.timeoutMs))
      .catch((error) => {
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
