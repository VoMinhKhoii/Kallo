import type { ParsedBarcodeProduct } from '@/lib/domain/barcode/types';
import {
  type NutritionValues,
  OCR_NUTRIENT_KEYS,
  type OcrConfidence,
  type OcrQuantityUnit,
  type OcrReviewPayload,
  type ParsedNutritionLabel,
} from '@/lib/domain/nutrition/ocr/schema';

/**
 * One food the scan dialog shows, whatever it came from — a barcode product, a
 * read nutrition label, or one typed by hand ("Enter manually"). Mirrors the
 * Flutter app's `ScanFood` (`apps/mobile-flutter/lib/features/logging/logic/scan/scan_food.dart`).
 *
 * Values are held PER BASIS ("per 100 ml", "per serving"), apart from the
 * amount being logged: the result scales them to the chosen amount, the editor
 * edits them against the basis, and a save scales once. Keys are the label
 * log's (`NutritionValues`); null means the source doesn't list it — unknown,
 * never 0.
 */
export type ScanFoodSource = 'barcode' | 'label' | 'manual';

export interface ScanFood {
  name: string;
  brand: string | null;
  unit: OcrQuantityUnit;
  /** The amount `values` are for, in `unit` — 100 for "per 100 ml". */
  basisAmount: number;
  values: NutritionValues;
  source: ScanFoodSource;
  /** One serving / one pack, in `unit`; null when the source doesn't say. */
  servingSize: number | null;
  packageSize: number | null;
  /** Set for a barcode product only. */
  barcode: string | null;
  /** True once the user changed anything in the editor. */
  edited: boolean;
  confidence: OcrConfidence | null;
}

export const REQUIRED_SCAN_NUTRIENTS = [
  'calories',
  'proteinGrams',
  'carbsGrams',
  'fatGrams',
] as const satisfies readonly (keyof NutritionValues)[];

export function emptyNutrition(): NutritionValues {
  return Object.fromEntries(
    OCR_NUTRIENT_KEYS.map((key) => [key, null])
  ) as NutritionValues;
}

/** A barcode product: per 100 of its unit, sized by its serving and pack. */
export function scanFoodFromBarcode(product: ParsedBarcodeProduct): ScanFood {
  return {
    name: product.name,
    brand: product.brand,
    unit: product.amountUnit,
    basisAmount: 100,
    source: 'barcode',
    barcode: product.barcode,
    servingSize: product.servingSizeG,
    packageSize: product.packageSizeG,
    edited: false,
    confidence: null,
    values: {
      ...emptyNutrition(),
      ...product.micronutrients,
      calories: product.caloriesKcal,
      proteinGrams: product.proteinG,
      carbsGrams: product.carbohydrateG,
      fatGrams: product.fatG,
      fiberGrams: product.fiberG,
      sodiumMg: product.sodiumMg,
    },
  };
}

/** The printed column a label's numbers belong to, and what it is per. */
export function labelColumn(label: ParsedNutritionLabel): {
  values: NutritionValues;
  referenceAmount: number;
  unit: OcrQuantityUnit;
} {
  switch (label.basis) {
    case 'per_100g':
      return { values: label.per100g, referenceAmount: 100, unit: 'g' };
    case 'per_100ml':
      return { values: label.per100ml, referenceAmount: 100, unit: 'ml' };
    case 'per_container':
      return {
        values: label.perContainer,
        referenceAmount: label.netContent.value,
        unit: label.netContent.unit,
      };
    default:
      return label.servingSize
        ? {
            values: label.perServing,
            referenceAmount: label.servingSize.value,
            unit: label.servingSize.unit,
          }
        : { values: label.perServing, referenceAmount: 1, unit: 'serving' };
  }
}

/** The serving and pack a label states, in `unit`. */
export function labelSizes(
  label: ParsedNutritionLabel,
  unit: OcrQuantityUnit
): { servingSize: number | null; packageSize: number | null } {
  const serving = label.servingSize;
  const servingSize =
    serving?.unit === unit ? serving.value : unit === 'serving' ? 1 : null;
  let packageSize: number | null = null;
  if (label.basis === 'per_container' && label.netContent.unit === unit) {
    packageSize = label.netContent.value;
  } else if (servingSize && label.servingsPerContainer) {
    packageSize = servingSize * label.servingsPerContainer;
  }
  return { servingSize, packageSize };
}

/** A read label: the column its numbers belong to, sized as it prints. */
export function scanFoodFromLabel(
  label: ParsedNutritionLabel,
  fallbackName: string
): ScanFood {
  const column = labelColumn(label);
  const printed = label.productName?.trim();
  return {
    name: printed || fallbackName,
    brand: null,
    unit: column.unit,
    basisAmount: column.referenceAmount,
    source: 'label',
    barcode: null,
    ...labelSizes(label, column.unit),
    edited: false,
    confidence: label.confidence,
    values: { ...emptyNutrition(), ...column.values },
  };
}

/** "Enter manually": nothing known yet, per 100 g until the user says. */
export function blankScanFood(): ScanFood {
  return {
    name: '',
    brand: null,
    unit: 'g',
    basisAmount: 100,
    source: 'manual',
    barcode: null,
    servingSize: null,
    packageSize: null,
    edited: false,
    confidence: null,
    values: emptyNutrition(),
  };
}

/** Logs by barcode: a product the user hasn't changed. The server re-resolves
 *  the shared product row; an edited one logs its own numbers instead. */
export const logsByBarcode = (food: ScanFood) =>
  food.barcode !== null && !food.edited;

/** `key`'s value for `amount` (in the food's unit); null stays null. */
export function valueFor(
  food: ScanFood,
  key: keyof NutritionValues,
  amount: number
): number | null {
  const perBasis = food.values[key];
  if (perBasis === null || food.basisAmount <= 0) return null;
  return (perBasis * amount) / food.basisAmount;
}

/** Every nutrient scaled to `amount`, rounded to two decimals as the label log
 *  expects. Nulls are kept. */
export function nutritionFor(food: ScanFood, amount: number): NutritionValues {
  return Object.fromEntries(
    OCR_NUTRIENT_KEYS.map((key) => {
      const value = valueFor(food, key, amount);
      return [key, value === null ? null : Math.round(value * 100) / 100];
    })
  ) as NutritionValues;
}

/** The four the log refuses to save without are all known. */
export const hasRequired = (food: ScanFood) =>
  REQUIRED_SCAN_NUTRIENTS.every((key) => food.values[key] !== null);

/** An edit: the user's name, basis and values. A new unit makes the old
 *  serving and pack sizes meaningless, so they go. */
export function editScanFood(
  food: ScanFood,
  edit: {
    name: string;
    unit: OcrQuantityUnit;
    basisAmount: number;
    values: NutritionValues;
  }
): ScanFood {
  const sameUnit = edit.unit === food.unit;
  return {
    ...food,
    ...edit,
    servingSize: sameUnit ? food.servingSize : null,
    packageSize: sameUnit ? food.packageSize : null,
    edited: true,
  };
}

/** The label log's body for `food` at `amount` (a food that `hasRequired`):
 *  its name, amount, unit and confidence, and every nutrient it knows scaled
 *  to the amount — what the source never listed is left out, not sent null. */
export function labelLogPayload(
  food: ScanFood,
  amount: number
): OcrReviewPayload {
  const known = Object.fromEntries(
    Object.entries(nutritionFor(food, amount)).filter(([, v]) => v !== null)
  );
  return {
    ...(known as Pick<
      OcrReviewPayload,
      'calories' | 'proteinGrams' | 'carbsGrams' | 'fatGrams'
    >),
    productName: food.name.trim(),
    amount,
    unit: food.unit,
    confidence: food.confidence ?? 'low',
  };
}
