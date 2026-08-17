import 'package:flutter/material.dart';

import '../../logic/meal_log_mode.dart';
import '../composer/composer_actions.dart';
import 'manual_log_sheet.dart';

/// The sheets the feed composer can open over itself.
///
/// All three open OVER the feed: there is no sheet of ours in the way, so the
/// mode sheet's own dismissal is the only thing to wait on. The dashboard's
/// quick-log sheet cannot do this — a sheet must not stack on a sheet, so it
/// closes itself and hands the launch back to the surface underneath.
class FeedSheets {
  const FeedSheets({
    required this.context,
    required this.userId,
    required this.date,
    required this.mode,
    required this.onPersistentMode,
    required this.onFallbackToText,
  });

  final BuildContext context;
  final String userId;
  final String date;

  /// The persistent mode the chooser opens on.
  final MealLogMode mode;

  /// Normal / Cheat — the chooser's two persistent outcomes.
  final ValueChanged<MealLogMode> onPersistentMode;

  /// Barcode gave up (product not found): hand the user the keyboard instead.
  final VoidCallback onFallbackToText;

  Future<void> openMode() => chooseLogMode(
    context,
    current: mode,
    onPersistentMode: onPersistentMode,
    onManual: openManual,
    onBarcode: openBarcode,
  );

  Future<void> openManual() =>
      showManualLogSheet(context, userId: userId, date: date);

  Future<void> openBarcode() => openBarcodeLogSheet(
    context,
    userId: userId,
    date: date,
    onFallbackToText: onFallbackToText,
  );
}
