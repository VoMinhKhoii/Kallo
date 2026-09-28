import { stageBarcodeMealAction } from '@/lib/actions/logging/barcode';
import { stageOcrMealAction } from '@/lib/actions/logging/nutrition-ocr';
import { confirmScanMealAction } from '@/lib/actions/meals/confirm-scan-meal';
import {
  hasRequired,
  labelLogPayload,
  logsByBarcode,
  type ScanFood,
} from '@/lib/domain/scan/food';

/** A save's outcome: done; refused as Premium (the paywall's to answer); or
 *  the `logging` message key saying why not. */
export type ScanSaveResult =
  | { ok: true }
  | { ok: false; locked: true }
  | { ok: false; locked?: false; errorKey: string };

/**
 * Log a scan result at `amount` (in the food's unit), the web twin of the
 * Flutter app's `logScanFood`: a barcode product the user left alone is
 * staged BY ITS BARCODE (the server re-resolves the shared product row);
 * anything else — a read label, an edited product, a food typed by hand —
 * is staged with its own numbers through the label log (Premium, like label
 * scan). Either way the staged meal is confirmed at once: no pending card.
 */
export async function saveScanFood({
  food,
  amount,
  loggedDate,
  mealId,
}: {
  food: ScanFood;
  amount: number;
  loggedDate: string;
  /** The save's own id, kept across its retries: a retry whose first try
   *  landed comes back as saved, never as a second meal. */
  mealId: string;
}): Promise<ScanSaveResult> {
  const timezoneOffset = new Date().getTimezoneOffset();
  const barcode = logsByBarcode(food) ? food.barcode : null;
  if (!barcode && (!hasRequired(food) || !food.name.trim())) {
    return { ok: false, errorKey: 'scan.missingValues' };
  }

  const staged = barcode
    ? await stageBarcodeMealAction({
        barcode,
        grams: amount,
        loggedDate,
        timezoneOffset,
      })
    : await stageOcrMealAction({
        ...labelLogPayload(food, amount),
        loggedDate,
        timezoneOffset,
      });

  if (!staged.success) {
    // A plan that lapsed while the result was open: the paywall, not a line
    // of red text.
    if (staged.code === 'feature_locked') return { ok: false, locked: true };
    const prefix = barcode ? 'barcodeError' : 'ocrError';
    return { ok: false, errorKey: `${prefix}.${staged.code}` };
  }
  const confirmed = await confirmScanMealAction({
    analysisId: staged.analysisId,
    mealId,
  });
  return confirmed.success
    ? { ok: true }
    : { ok: false, errorKey: 'barcodeError.server_error' };
}
