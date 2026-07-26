/**
 * Provider-agnostic seam for barcode product lookup.
 *
 * Every source (Open Food Facts, USDA FoodData Central, …) is one descriptor
 * implementing this interface; resolution order and the hedged runner live in
 * `lib/barcode/chain.ts`, and nothing outside that file knows which source
 * answered. Adding a source is one adapter file, one descriptor, one
 * `ingredient_sources` row and one env var.
 *
 * Adapters NEVER throw for an expected failure (timeout, non-2xx, malformed
 * body, no match): they `console.error` and return null. Only the service
 * layer turns an exhausted chain into a `BarcodeServiceError`.
 */
import type {
  BarcodeProviderId,
  ParsedBarcodeProduct,
} from '@/lib/barcode/types';

export interface BarcodeProvider {
  id: BarcodeProviderId;
  /** `ingredient_sources.code` this provider's cached rows are attributed to. */
  sourceCode: string;
  /** Primary-key prefix for its rows in `vietnamese_food_composition`. */
  cachePrefix: string;
  /** Wall-clock bound for a single lookup. */
  timeoutMs: number;
  /**
   * Whether the provider's credentials are present. Evaluated per call against
   * the live env so tests can vary it and secret-injection order never
   * matters; an unconfigured provider is skipped, which is a normal state and
   * not an error.
   */
  isConfigured(env: NodeJS.ProcessEnv): boolean;
  fetch(
    barcode: string,
    timeoutMs: number
  ): Promise<ParsedBarcodeProduct | null>;
}
