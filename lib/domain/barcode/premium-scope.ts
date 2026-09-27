/**
 * Micronutrients on a scanned product are Premium to SEE, never to store.
 *
 * The cached row and every meal logged from it keep all of them whoever
 * scanned, so an upgrade reveals history instead of starting from zero. Only
 * the search response is scoped, and it is scoped SERVER-SIDE, like
 * `lib/domain/nutrition/premium-scope.ts`: a viewer without access never
 * receives the figures at all. Fiber and sodium count as micronutrients here,
 * as they do on the Nutrition page (`NutritionNutrientKey`).
 */

import { searchBarcodeProduct } from '@/lib/domain/barcode/service';
import type { ParsedBarcodeProduct } from '@/lib/domain/barcode/types';
import {
  checkFeatureGate,
  type FeatureGateInput,
} from '@/lib/domain/billing/feature-gate';

/** The product with every Premium figure removed. Pure. */
export function stripBarcodeMicronutrients(
  product: ParsedBarcodeProduct
): ParsedBarcodeProduct {
  return { ...product, fiberG: null, sodiumMg: null, micronutrients: null };
}

/**
 * Search a barcode as `viewer` sees it. The entitlement read overlaps the
 * lookup instead of adding a round trip after it.
 */
export async function searchBarcodeProductForViewer(
  barcode: string,
  viewer: FeatureGateInput
): Promise<ParsedBarcodeProduct> {
  const gatePromise = checkFeatureGate(viewer, 'micronutrients');
  // A lookup failure below would leave this rejecting with nobody listening.
  // The no-op observer marks it handled; it is still awaited on success.
  gatePromise.catch(() => {});

  const product = await searchBarcodeProduct(barcode);
  const gate = await gatePromise;
  return gate.locked ? stripBarcodeMicronutrients(product) : product;
}
