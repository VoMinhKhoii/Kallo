/// How a confirmed scan result is written — one policy for every source.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/logging/scan_outcome.dart';
import '../../data/barcode_providers.dart';
import '../../data/label_scan_providers.dart';
import '../relog/scan_purpose.dart';
import 'scan_food.dart';

/// Log [food] at [amount] (in its unit).
///
/// A barcode product the user left alone goes BY ITS BARCODE through the
/// scan's [purpose]: the server re-resolves the shared product row, or the
/// composer takes it back as a pick. Anything else — a read label, an edited
/// product, a food typed by hand — logs its own numbers through the label log
/// (Premium, like label scan).
///
/// [mealId] is the result's own and stays the same across its retries, so a
/// save whose answer was lost comes back as saved, never as a second meal.
///
/// Resolves to the outcome to close with, or to the l10n key saying why not.
Future<({ScanOutcome? outcome, String? errorKey})> logScanFood(
  WidgetRef ref, {
  required ScanPurpose purpose,
  required ScanFood food,
  required double amount,
  required String userId,
  required String date,
  required String mealId,
}) async {
  final product = ref.read(barcodeFlowProvider).product;
  if (food.logsByBarcode && product != null) {
    final outcome = await purpose.commit(
      ref,
      product: product,
      // The amount the preview showed, not rounded to a whole gram: a
      // 12.5 ml serving logs 12.5 ml.
      grams: amount,
      userId: userId,
      date: date,
      mealId: mealId,
    );
    return (outcome: outcome, errorKey: ref.read(barcodeFlowProvider).errorKey);
  }
  final errorKey = await ref
      .read(labelScanProvider.notifier)
      .logEntry(
        userId: userId,
        date: date,
        food: food,
        amount: amount,
        mealId: mealId,
      );
  return (
    outcome: errorKey == null ? const ScanSaved() : null,
    errorKey: errorKey,
  );
}
