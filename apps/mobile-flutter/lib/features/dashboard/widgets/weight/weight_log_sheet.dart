import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/profile/weight.dart';
import '../../../../services/auth/session_provider.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../theme/calm_tokens.dart';
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
  final bundle = await ref.read(dashboardBundleProvider(args).future);
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
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: kCardSurface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(kCardRadius)),
    ),
    builder: (sheetContext) {
      final mq = MediaQuery.of(sheetContext);
      // Keypad-first sheet: it wraps its content (header + field + Save)
      // instead of claiming a fixed slice of the screen, and the viewInsets
      // padding lifts that compact stack to ride right above the keyboard.
      // SingleChildScrollView + MainAxisSize.min keep it scroll-safe when
      // the height is tight (landscape, split-screen).
      return Padding(
        padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              KalloSheetHeader(
                title: tr('dashboard.weightCard.todaysWeight'),
              ),
              const SizedBox(height: KalloSpacing.sp3),
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: KalloSpacing.sp5,
                ),
                child: CompactWeightLog(
                  currentWeight: data.currentWeight,
                  todayWeight: data.todayWeight,
                  todayDate: todayDate,
                  args: args,
                  autofocus: true,
                  onSaved: () => Navigator.of(sheetContext).pop(),
                ),
              ),
              // Breathing gap above the keypad. viewPadding.bottom is NOT
              // reduced by the keyboard, so only add the home-indicator inset
              // while the keypad is dismissed.
              SizedBox(
                height: KalloSpacing.sp4 +
                    (mq.viewInsets.bottom > 0 ? 0 : mq.viewPadding.bottom),
              ),
            ],
          ),
        ),
      );
    },
  );
}
