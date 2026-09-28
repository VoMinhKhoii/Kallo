/// Why the scan sheet was opened, as one value instead of a flag.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/logging/relog.dart';
import '../../../../models/logging/scan_outcome.dart';
import '../../../../models/nutrition/barcode_product.dart';
import '../../data/barcode_providers.dart';

/// What a confirmed amount DOES: write the meal, or hand the product back.
///
/// Both branches resolve to the [ScanOutcome] the sheet pops with, or null when
/// there is nothing to pop for (a save that failed keeps its step, amount and
/// error text so the retry is one tap away).
typedef ScanCommit =
    Future<ScanOutcome?> Function(
      WidgetRef ref, {
      required BarcodeProduct product,
      required int grams,
      required String userId,
      required String date,
      required String mealId,
    });

/// What the scan sheet was opened FOR: the CTA it shows on the amount step, and
/// what confirming that amount does.
///
/// This replaces an `asPick` bool that was threaded through four widgets —
/// composer → scan sheet → barcode branch → amount step — to change exactly two
/// things at the far end. A bool carried that far says nothing at any layer it
/// passes through, and every layer had to keep a default for it; the two
/// behaviours are named here, once, and the layers just carry the value.
class ScanPurpose {
  const ScanPurpose._({required this.ctaKey, required this.commit});

  /// The amount step's confirm-button copy.
  final String ctaKey;

  final ScanCommit commit;

  /// One shot, saved on the spot — the mode chooser's Scan row and the
  /// dashboard's quick-log sheet. No pending-confirmation card either way, so
  /// the caller's success toast is the only confirmation the user gets.
  static const ScanPurpose log = ScanPurpose._(
    ctaKey: 'logging.barcode.addMeal',
    commit: _logMeal,
  );

  /// The COMPOSER's own scan icon: the product comes back as a pick for the
  /// sentence being typed, and nothing is written until that sentence is sent.
  /// Scanning is composing here — it is what lets "2 shot cafe + sữa" hold the
  /// sữa's real label instead of logging it as a second meal beside the coffee.
  ///
  /// Barcode only. The nutrition-LABEL branch inside the same sheet still
  /// saves: a photographed table is not a product the server can re-resolve, so
  /// there is no reference to hand back.
  static const ScanPurpose pick = ScanPurpose._(
    ctaKey: 'logging.barcode.addToMeal',
    commit: _pickProduct,
  );
}

Future<ScanOutcome?> _logMeal(
  WidgetRef ref, {
  required BarcodeProduct product,
  required int grams,
  required String userId,
  required String date,
  required String mealId,
}) async {
  final saved = await ref
      .read(barcodeFlowProvider.notifier)
      .logMeal(userId: userId, date: date, grams: grams, mealId: mealId);
  // A failure has already put its message on the amount step. Popping would
  // take that away along with the amount the user chose.
  return saved ? const ScanSaved() : null;
}

Future<ScanOutcome?> _pickProduct(
  WidgetRef ref, {
  required BarcodeProduct product,
  required int grams,
  required String userId,
  required String date,
  required String mealId,
}) async => ScanPicked(
  label: barcodePickLabel(product, grams),
  ref: BarcodeRef(barcode: product.barcode, grams: grams.toDouble()),
);

/// What a scanned product reads as INSIDE the composer's sentence: its brand,
/// its name and the amount, so "2 shot cafe + TH true milk Sữa tươi (180g)"
/// says back what was actually scanned.
///
/// The BRAND is there because a bare name does not identify a package: two
/// "Sữa tươi" from different companies are different products with different
/// numbers, and a sentence holding both would read as the same pick twice —
/// which is also what `reconcileMentions` would then see. Products without one
/// keep the bare name.
///
/// The amount is in the label because it is the half the user chose and the
/// half a bare product name hides — in the product's own unit, so a drink reads
/// "(330ml)". The reference beside it carries the same number, so nothing here
/// is load-bearing — break the text and the pick drops, which is exactly what a
/// broken relog label does.
String barcodePickLabel(BarcodeProduct product, int grams) {
  final brand = product.brand;
  final name = brand == null ? product.name : '$brand ${product.name}';
  return '$name ($grams${product.amountUnit})';
}
