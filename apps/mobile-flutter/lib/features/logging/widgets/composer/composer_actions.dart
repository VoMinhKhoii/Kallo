import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/logging/cheat.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../data/logging_providers.dart';
import '../../logic/meal_log_mode.dart';
import '../sheets/barcode/barcode_scanner_sheet.dart';
import '../sheets/meal_mode_sheet.dart';

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

/// One-shot barcode scan → quantity → save. Unlike manual (which saves
/// silently), barcode persists the meal in one server call with no pending
/// card, so a success toast is the only confirmation the user gets.
Future<void> openBarcodeLogSheet(
  BuildContext context, {
  required String userId,
  required String date,
  required VoidCallback onFallbackToText,
}) async {
  final saved = await showBarcodeScannerSheet(
    context,
    userId: userId,
    date: date,
    // Product not found → the AI composer is the better tool: pop the sheet
    // and hand the user the keyboard.
    onFallbackToText: onFallbackToText,
  );
  if (saved == true && context.mounted) {
    HapticFeedback.mediumImpact();
    showTopToast(context, 'logging.barcode.savedMeal'.tr());
  }
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
  } catch (_) {
    if (context.mounted) showTopToast(context, 'errors.internal'.tr());
  } finally {
    if (context.mounted) onStagingChange(false);
  }
}
