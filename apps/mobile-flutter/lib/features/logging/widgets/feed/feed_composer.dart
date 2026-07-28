import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/cheat.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_theme.dart';
import '../../../settings/controls/option_strip.dart';
import '../../logic/feed/view_state.dart';
import '../../logic/logging_spacing.dart';
import '../cheat_occasion_chips.dart';
import '../composer_dock.dart';
import '../meal_input.dart';
import '../partial_day_notice.dart';
import '../sheets/meal_mode_sheet.dart';

/// Everything inside the floating dock: the under-logged notice, the inline
/// confirm error, cheat mode's per-meal controls, and the meal input itself.
class FeedComposer extends StatelessWidget {
  const FeedComposer({
    super.key,
    required this.view,
    required this.calorieTarget,
    required this.errorText,
    required this.mode,
    required this.cheatIntensity,
    required this.onCheatIntensityChange,
    required this.userId,
    required this.stagingRepeat,
    required this.onRepeatCheat,
    required this.controller,
    required this.onSubmit,
    required this.onCancel,
    required this.analyzing,
    required this.onModePressed,
    required this.onBarcodePressed,
    required this.onHeightChanged,
    required this.onDismissNotice,
    required this.noticeDismissed,
  });

  final FeedViewState view;
  final int calorieTarget;

  /// Inline error for a failed confirm (saving a meal) — not analysis errors,
  /// which surface as the failed-attempt card.
  final String? errorText;
  final MealLogMode mode;
  final CheatIntensity cheatIntensity;
  final ValueChanged<CheatIntensity> onCheatIntensityChange;
  final String userId;

  /// True while a "log it again" occasion is being re-staged server-side.
  final bool stagingRepeat;
  final ValueChanged<RecentCheatOccasion> onRepeatCheat;
  final MealInputController controller;
  final ValueChanged<String> onSubmit;
  final VoidCallback onCancel;
  final bool analyzing;
  final VoidCallback onModePressed;
  final VoidCallback onBarcodePressed;
  final ValueChanged<double> onHeightChanged;

  /// Dismisses the under-logged note for the day on screen.
  final VoidCallback onDismissNotice;

  /// True once the note has been dismissed for THIS day. The underlying
  /// condition stays true, so this is the only thing that hides it.
  final bool noticeDismissed;

  @override
  Widget build(BuildContext context) {
    return ComposerDock(
      onHeightChanged: onHeightChanged,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (errorText != null)
            Padding(
              padding: const EdgeInsets.only(bottom: LoggingSpacing.block),
              child: Text(
                errorText!,
                // Grey copy; the red lives on the affordances.
                style: dashMeta(),
              ),
            ),
          // Cheat mode's per-meal controls sit above the composer: the
          // light/medium/heavy intensity strip and the "log it again" chips
          // (the web keeps both above the input too).
          if (mode == MealLogMode.cheat) ...[
            CheatOccasionChips(
              userId: userId,
              disabled: stagingRepeat || analyzing,
              onSelect: onRepeatCheat,
            ),
            _CheatIntensityRow(
              value: cheatIntensity,
              onChange: onCheatIntensityChange,
            ),
            const SizedBox(height: LoggingSpacing.block),
          ],
          MealInput(
            controller: controller,
            onSubmit: onSubmit,
            onCancel: onCancel,
            analyzing: analyzing,
            // Under-logged past day: the note rides INSIDE the field's card,
            // because the way to fix the day is to type the meal missing from
            // it — message and remedy as one object.
            notice:
                view.showPartialDayNotice && !noticeDismissed
                    ? PartialDayNotice(
                      calories: view.dailyCalories,
                      target: calorieTarget,
                      onDismiss: onDismissNotice,
                    )
                    : null,
            modeLabel: mealModeLabel(mode),
            modeIcon: mealModeIcon(mode),
            hintText:
                mode == MealLogMode.cheat
                    ? 'logging.cheatPlaceholder'.tr()
                    : null,
            onModePressed: onModePressed,
            // iOS-only for now (matches the mode sheet's gating); null hides
            // the composer icon entirely. Gated via the shared
            // `isBarcodeLoggingSupported` (same source of truth as the mode
            // sheet).
            onBarcodePressed:
                isBarcodeLoggingSupported ? onBarcodePressed : null,
          ),
        ],
      ),
    );
  }
}

/// The light/medium/heavy intensity picker shown above the composer in cheat
/// mode — a quiet label + the shared segmented strip.
class _CheatIntensityRow extends StatelessWidget {
  const _CheatIntensityRow({required this.value, required this.onChange});

  final CheatIntensity value;
  final ValueChanged<CheatIntensity> onChange;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('logging.cheatIntensity.label'.tr(), style: dashMeta()),
              const SizedBox(height: 2),
              Text('logging.cheatIntensity.helper'.tr(), style: dashMeta()),
            ],
          ),
        ),
        const SizedBox(width: NhamSpacing.sp3),
        SizedBox(
          width: 200,
          child: OptionStrip(
            value: value.name,
            options: [
              for (final intensity in CheatIntensity.values)
                OptionStripItem(
                  value: intensity.name,
                  label: 'logging.cheatIntensity.${intensity.name}'.tr(),
                ),
            ],
            onChange: (name) => onChange(CheatIntensity.values.byName(name)),
          ),
        ),
      ],
    );
  }
}
