import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/list/list_row.dart';
import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/meal_log_mode.dart';

/// Opens the "select mode" chooser — the first step before the composer.
/// Returns the picked mode (or null if dismissed).
Future<MealLogMode?> showMealModeSheet(
  BuildContext context, {
  required MealLogMode current,
}) {
  return showNhamSheet<MealLogMode>(
    context,
    builder: (context) => _MealModeSheet(current: current),
  );
}

/// The mode rows in the app's shared row anatomy (native pass, 2026-08-31):
/// leading 24pt ink glyph, 14/500 title over a 12 muted description (64pt with
/// the subline), the selected row washed beige with an ink check.
///
/// The icons lost their per-mode colours here: the palette keeps tan and umber
/// for non-text moments, and four differently-tinted glyphs in one list read as
/// four categories rather than one choice. Selection carries the state instead.
class _MealModeSheet extends StatelessWidget {
  const _MealModeSheet({required this.current});

  final MealLogMode current;

  @override
  Widget build(BuildContext context) {
    // Floors at sp4 for phones with no home indicator to inset against.
    final bottomInset = math.max(
      MediaQuery.viewPaddingOf(context).bottom,
      KalloSpacing.sp4,
    );
    return KalloSheetSurface(
      // Four description rows overflowed a short phone at large Dynamic Type
      // (104px past the old 9/16 cap) — the last mode was unreachable.
      scrollable: true,
      padding: EdgeInsets.only(
        left: KalloSpacing.sp4,
        right: KalloSpacing.sp4,
        bottom: bottomInset,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KalloSheetHeader(title: 'logging.modeSelector.title'.tr()),
          for (final mode in MealLogMode.values)
            if (mode != MealLogMode.barcode || isBarcodeLoggingSupported)
              _ModeRow(
                mode: mode,
                selected: current == mode,
                onTap: () {
                  HapticFeedback.selectionClick();
                  Navigator.of(context).pop(mode);
                },
              ),
        ],
      ),
    );
  }
}

class _ModeRow extends StatelessWidget {
  const _ModeRow({
    required this.mode,
    required this.selected,
    required this.onTap,
  });

  final MealLogMode mode;
  final bool selected;
  final VoidCallback onTap;

  static String _key(MealLogMode mode) => switch (mode) {
    MealLogMode.normal => 'normal',
    MealLogMode.cheat => 'cheat',
    MealLogMode.manual => 'manual',
    MealLogMode.barcode => 'barcode',
  };

  @override
  Widget build(BuildContext context) {
    final key = _key(mode);
    return ClipRRect(
      borderRadius: BorderRadius.circular(KalloRadii.containerLg),
      child: ColoredBox(
        color: selected ? KalloColors.hover : Colors.transparent,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp2),
          child: ListRow(
            icon: mealModeIcon(mode),
            label: 'logging.modeSelector.$key'.tr(),
            subline: 'logging.modeSelector.${key}Desc'.tr(),
            onTap: onTap,
            trailing: selected
                ? const Icon(
                    LucideIcons.check300,
                    size: KalloIcons.size,
                    color: KalloColors.text,
                  )
                : null,
          ),
        ),
      ),
    );
  }
}
