import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../features/dashboard/widgets/weight/weight_log_sheet.dart';
import '../../features/logging/widgets/sheets/quick_log_sheet.dart';
import '../../shared/widgets/list/list_row.dart';
import '../../shared/widgets/sheet/kallo_sheet.dart';
import '../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../theme/calm_tokens.dart';
import '../../theme/kallo_theme.dart';

/// The tab bar's center "+" sheet (native pass, 2026-08-31): two 64pt rows —
/// "Log a meal" opening the quick-log flow and "Log weight" opening the
/// weight sheet. Replaces both the floating meal FAB and the weight card's
/// tan pill as the app's one add entry point.
Future<void> showAddSheet(BuildContext context, WidgetRef ref) {
  return showNhamSheet<void>(
    context,
    builder: (sheetContext) => KalloSheetSurface(
      padding: EdgeInsets.only(
        left: KalloSpacing.sp4,
        right: KalloSpacing.sp4,
        // The 34pt home inset IS the sheet's bottom gap — a spacing token on
        // top of it reads as a stray band under the last row. Phones without
        // a home indicator report 0, so the gap floors at sp4.
        bottom: math.max(
          MediaQuery.viewPaddingOf(sheetContext).bottom,
          KalloSpacing.sp4,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KalloSheetHeader(title: tr('app.addSheet.title')),
          ListRow(
            icon: LucideIcons.utensils300,
            label: tr('app.addSheet.logMeal'),
            subline: tr('app.addSheet.logMealHint'),
            showChevron: true,
            onTap: () {
              Navigator.of(sheetContext).pop();
              showQuickLogSheet(context, ref);
            },
          ),
          // Separator inset to the text column, as in every grouped card.
          const Padding(
            padding: EdgeInsets.only(left: 36),
            child: ColoredBox(color: kHairline, child: SizedBox(height: 1)),
          ),
          ListRow(
            icon: LucideIcons.gauge300,
            label: tr('app.addSheet.logWeight'),
            subline: tr('app.addSheet.logWeightHint'),
            showChevron: true,
            onTap: () {
              Navigator.of(sheetContext).pop();
              showWeightLogSheet(context, ref);
            },
          ),
        ],
      ),
    ),
  );
}
