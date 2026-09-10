/// What the scan sheet came back with.
///
/// The sheet has two jobs now, and the caller decides which it opened it for.
/// From the mode chooser it LOGS: scan, pick an amount, save, one toast. From
/// the composer's own scan icon it PICKS: the product comes back as a
/// reference the sentence being typed can hold, exactly as a `/` relog pick
/// does, and nothing is written until that sentence is sent.
///
/// The nutrition-LABEL branch always logs, even in pick mode: a photographed
/// table is not a product the server can re-resolve, so there is no reference
/// to hand back.
library;

import 'relog.dart';

sealed class ScanOutcome {
  const ScanOutcome();
}

/// A meal was written. The caller toasts.
class ScanSaved extends ScanOutcome {
  const ScanSaved();
}

/// A product, at the amount the user chose, for the composer to splice into
/// whatever is being typed.
class ScanPicked extends ScanOutcome {
  /// What the composer writes into its own text — the product's name and the
  /// amount, so the sentence reads back as what was scanned.
  final String label;

  /// The reference that rides the submit. No nutrition: the server re-resolves
  /// the product from its barcode cache and scales the label itself.
  final BarcodeRef ref;

  const ScanPicked({required this.label, required this.ref});
}
