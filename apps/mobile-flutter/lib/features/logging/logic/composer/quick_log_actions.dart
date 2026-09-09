/// Opening the dashboard's quick-log sheet, and dispatching what it resolves to.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../services/auth/session_provider.dart';
import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../data/logging_keys.dart';
import '../../widgets/sheets/manual/manual_log_sheet.dart';
import '../../widgets/sheets/quick_log_sheet.dart';
import '../meal_log_mode.dart';
import '../relog/scan_purpose.dart';
import 'composer_actions.dart';

/// Opens the quick-log sheet — the dashboard FAB's composer.
///
/// A modal sheet rather than a bar hanging off the FAB: the keyboard comes up
/// over a stable surface instead of over a control the user can drag, and
/// there is room for the REAL [MealInput] the logging feed composes with.
///
/// It resolves to a ONE-SHOT mode when the user picks Manual or Barcode inside
/// it: the sheet pops ITSELF and hands the launch back here, so the one-shot
/// opens from the dashboard rather than stacking on a sheet on its way out.
/// Normal / Cheat are persistent — they only change what Send does.
Future<void> showQuickLogSheet(BuildContext context, WidgetRef ref) async {
  final oneShot = await showNhamSheet<MealLogMode>(
    context,
    isScrollControlled: true,
    builder: (context) => const QuickLogSheet(),
  );
  if (oneShot == null || !context.mounted) return;

  final userId = ref.read(currentSessionProvider)?.user.id;
  if (userId == null) return;
  // A meal logged from the dashboard is eaten now: today is the only target.
  final date = todayDateString();

  switch (oneShot) {
    case MealLogMode.manual:
      await showManualLogSheet(context, userId: userId, date: date);
    case MealLogMode.barcode:
      await openScanSheet(
        context,
        purpose: ScanPurpose.log,
        userId: userId,
        date: date,
        // Neither scan got us there → re-open the sheet, caret in the field.
        onFallbackToText: () {
          if (context.mounted) showQuickLogSheet(context, ref);
        },
      );
    case MealLogMode.normal:
    case MealLogMode.cheat:
      break; // persistent modes never resolve the sheet
  }
}
