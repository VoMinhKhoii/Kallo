import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/profile/weight.dart';
import '../../../../services/auth/session_provider.dart';
import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../shared/logic/display_format.dart';
import '../../data/dashboard_providers.dart';
import 'compact_weight_log.dart';

/// Opens the "log today's weight" bottom sheet from anywhere — the tab bar's
/// "+" Add sheet is the primary entry point now that the weight card's tan
/// pill is retired (native pass, 2026-08-31). Reads the dashboard bundle for
/// prefills (warm cache in the common case) before presenting.
Future<void> showWeightLogSheet(BuildContext context, WidgetRef ref) async {
  final userId = ref.read(currentSessionProvider)?.user.id;
  if (userId == null) return;
  final todayDate = todayDateString();
  final args = (userId: userId, date: todayDate);
  final DashboardBundle bundle;
  try {
    bundle = await ref.read(dashboardBundleProvider(args).future);
  } catch (_) {
    // A failed bundle used to dead-end here: the Add sheet had already closed
    // and no weight sheet ever arrived, so the row read as broken. Say so.
    if (context.mounted) {
      showTopToast(
        context,
        tr('dashboard.weightCard.loadFailed'),
        variant: TopToastVariant.error,
      );
    }
    return;
  }
  if (!context.mounted) return;
  showWeightLogSheetWithData(
    context,
    data: bundle.weightSummary,
    todayDate: todayDate,
    args: args,
  );
}

/// The sheet itself, for hosts that already hold the weight data (the
/// dashboard weight card). A keypad-first form: handle-less unified header,
/// the [CompactWeightLog] field + Save, and viewInsets padding lifting the
/// stack above the keyboard.
void showWeightLogSheetWithData(
  BuildContext context, {
  required WeightSummaryData data,
  required String todayDate,
  required DashboardArgs args,
}) {
  HapticFeedback.lightImpact(); // open cue, matching the meal trigger
  showNhamSheet<void>(
    context,
    builder: (sheetContext) {
      final mq = MediaQuery.of(sheetContext);
      // Keypad-first sheet: it wraps its content (header + field + Save)
      // instead of claiming a fixed slice of the screen, and rides right above
      // the keyboard — `KalloSheetSurface` owns that inset for every sheet now.
      // `scrollable` keeps it safe when the height is tight (landscape,
      // split-screen).
      return KalloSheetSurface(
        scrollable: true,
        padding: EdgeInsets.only(
          left: KalloSpacing.sp4,
          right: KalloSpacing.sp4,
          // The keyboard's own inset clears the home indicator while the
          // pad is up; at rest the 34pt inset is the sheet's bottom gap.
          bottom:
              mq.viewInsets.bottom > 0
                  ? KalloSpacing.sp3
                  : math.max(mq.viewPadding.bottom, KalloSpacing.sp4),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            KalloSheetHeader(title: tr('dashboard.weightCard.todaysWeight')),
            const SizedBox(height: KalloSpacing.sp2),
            CompactWeightLog(
              currentWeight: data.currentWeight,
              todayWeight: data.todayWeight,
              todayDate: todayDate,
              args: args,
              autofocus: true,
              onSaved: () => Navigator.of(sheetContext).pop(),
            ),
          ],
        ),
      );
    },
  );
}
