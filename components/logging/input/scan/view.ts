import type { BarcodeErrorCode } from '@/lib/domain/barcode/types';
import type {
  OcrErrorCode,
  ParsedNutritionLabel,
} from '@/lib/domain/nutrition/ocr/schema';
import {
  type ScanFood,
  scanFoodFromBarcode,
  scanFoodFromLabel,
} from '@/lib/domain/scan/food';
import type { ScanLookup } from './use-lookup';

export type ScanMode = 'barcode' | 'label';

/**
 * What stands over the camera right now — the web twin of the Flutter app's
 * `buildScanPanel`, as data so the dialog can also tell whether the camera
 * should be live. `camera` is the live camera with its tools; `busy` the
 * darkened frame while a code is looked up or a photo is read.
 */
export type ScanView =
  | { kind: 'camera' }
  | { kind: 'busy'; text: 'lookingUp' | 'reading' }
  | { kind: 'editor'; food: ScanFood; isNew: boolean }
  | { kind: 'result'; food: ScanFood; key: string }
  | { kind: 'typing' }
  | { kind: 'notFound'; code: string }
  | { kind: 'lookupFailed'; error: BarcodeErrorCode }
  | { kind: 'labelFailed'; error: OcrErrorCode; temporary: boolean };

export function scanViewFor({
  mode,
  lookup,
  label,
  typing,
  editing,
  editedFood,
  fallbackName,
}: {
  mode: ScanMode;
  lookup: ScanLookup;
  label: {
    reading: boolean;
    label: ParsedNutritionLabel | null;
    error: OcrErrorCode | null;
    photo: string | null;
  };
  typing: boolean;
  editing: { food: ScanFood; isNew: boolean } | null;
  editedFood: ScanFood | null;
  fallbackName: string;
}): ScanView {
  if (editing) return { kind: 'editor', ...editing };
  if (editedFood) return { kind: 'result', food: editedFood, key: 'edited' };

  if (mode === 'barcode') {
    if (typing) return { kind: 'typing' };
    switch (lookup.phase) {
      case 'searching':
        return { kind: 'busy', text: 'lookingUp' };
      case 'found':
        return {
          kind: 'result',
          food: scanFoodFromBarcode(lookup.product),
          key: `barcode-${lookup.code}`,
        };
      case 'miss':
        return lookup.error === 'not_found'
          ? { kind: 'notFound', code: lookup.code }
          : { kind: 'lookupFailed', error: lookup.error };
      default:
        return { kind: 'camera' };
    }
  }

  if (label.reading) return { kind: 'busy', text: 'reading' };
  if (label.label) {
    return {
      kind: 'result',
      food: scanFoodFromLabel(label.label, fallbackName),
      key: 'label',
    };
  }
  // The paywall and the consent ask are the dialog's to open, not a failure.
  if (
    label.error &&
    label.error !== 'feature_locked' &&
    label.error !== 'ai_consent_required'
  ) {
    return {
      kind: 'labelFailed',
      error: label.error,
      // A busy or failed SERVICE can read the same photo next time; a photo
      // with no readable table cannot, so it is never offered again.
      temporary:
        label.photo !== null &&
        (label.error === 'rate_limited' || label.error === 'server_error'),
    };
  }
  return { kind: 'camera' };
}
