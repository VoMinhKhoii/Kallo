import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/logging/cheat.dart';
import '../../../../models/logging/scan_outcome.dart';
import '../../../../services/billing/feature_lock.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../data/logging_providers.dart';
import '../../widgets/sheets/meal_mode_sheet.dart';
import '../../widgets/sheets/scan/scan_sheet.dart';
import '../meal_log_mode.dart';
import '../relog/scan_purpose.dart';

/// The first step: choose how to log. Normal and Cheat set the persistent
/// composer mode (via [onPersistentMode]) and focus the field; Manual and
/// Barcode are ONE-SHOTS — they open their own sheet and leave the persistent
/// mode untouched.
///
/// Both one-shots are launched by the CALLER ([onManual] / [onBarcode]) rather
/// than from here, because where they may legally be opened from differs by
/// entry point: the feed composer opens them over itself, while the dashboard's
/// quick-log sheet has to close ITSELF first (a sheet must not stack on a
/// sheet) and therefore hands the launch back to the surface underneath it.
Future<void> chooseLogMode(
  BuildContext context, {
  required MealLogMode current,
  required ValueChanged<MealLogMode> onPersistentMode,
  required VoidCallback onManual,
  required VoidCallback onBarcode,
}) async {
  final picked = await showMealModeSheet(context, current: current);
  if (picked == null || !context.mounted) return;
  switch (picked) {
    case MealLogMode.normal:
      onPersistentMode(MealLogMode.normal);
    case MealLogMode.manual:
      onManual();
    case MealLogMode.barcode:
      onBarcode();
    case MealLogMode.cheat:
      onPersistentMode(MealLogMode.cheat);
  }
}

/// Scan → amount/review → commit, by barcode OR by the nutrition table printed
/// on the package. [ScanPurpose] decides what committing means: log the meal on
/// the spot, or hand the product back to the composer as a pick.
///
/// A saved meal toasts from here, whichever purpose asked for the sheet — the
/// nutrition-LABEL branch always saves (a photographed table is not a product
/// the server can re-resolve, so there is no reference to hand back), and it
/// persists in one server call with no pending card, so the toast is the only
/// confirmation the user gets.
///
/// Null when the user simply closed the sheet — which is NOT nothing to the
/// caller: a cancel must not toast, and must not move the feed.
Future<ScanOutcome?> openScanSheet(
  BuildContext context, {
  required ScanPurpose purpose,
  required String userId,
  required String date,
  required VoidCallback onFallbackToText,
}) async {
  final outcome = await showScanSheet(
    context,
    userId: userId,
    date: date,
    purpose: purpose,
    // Neither the barcode nor the label got us there → the AI composer is the
    // better tool: pop the sheet and hand the user the keyboard.
    onFallbackToText: onFallbackToText,
  );
  if (outcome is ScanSaved && context.mounted) {
    HapticFeedback.mediumImpact();
    showTopToast(context, 'logging.scan.savedMeal'.tr());
  }
  return outcome;
}

/// "Log it again": re-stage a past cheat occasion's sliders (seeded with last
/// time's amounts) without re-running the estimator. The staged pending
/// surfaces as a seeded slider card via the awaited day refresh.
Future<void> repeatCheatOccasion(
  BuildContext context,
  WidgetRef ref, {
  required RecentCheatOccasion occasion,
  required String userId,
  required String date,
  required VoidCallback onStaged,
  required ValueChanged<bool> onStagingChange,
}) async {
  onStagingChange(true);
  try {
    await stageCheatRepeat(
      ref,
      userId: userId,
      sourceMealId: occasion.mealId,
      date: date,
    );
    onStaged();
  } catch (error) {
    // Cheat repeat is gated: a 402 is "not entitled", not an internal error.
    if (context.mounted && !handledFeatureLock(context, error)) {
      showTopToast(context, 'errors.internal'.tr());
    }
  } finally {
    if (context.mounted) onStagingChange(false);
  }
}
