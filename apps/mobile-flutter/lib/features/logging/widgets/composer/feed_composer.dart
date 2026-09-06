import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/logging/cheat.dart';
import '../../../../models/logging/relog.dart' show RelogCandidate;
import '../../../../theme/calm_tokens.dart';
import '../../logic/composer/composer_refill.dart';
import '../../logic/feed/view_state.dart';
import '../../logic/logging_spacing.dart';
import '../../logic/meal_log_mode.dart';
import '../cheat/cheat_intensity_group.dart';
import '../cheat/cheat_occasion_chips.dart';
import 'composer_dock.dart';
import 'meal_input.dart';
import '../timeline/partial_day_notice.dart';
import '../relog/mention_text_controller.dart';
import '../relog/relog_picker_section.dart';

/// Everything inside the floating dock: the under-logged notice, the inline
/// confirm error, cheat mode's per-meal controls, and the meal input itself.
///
/// Also where a message sent back by the Edit action lands: the dock holds
/// both controllers it takes to refill the field, and it is on screen for as
/// long as the bubbles that can write to it are. [FeedArea] never sees it go
/// past — see [listenForComposerRefill].
class FeedComposer extends ConsumerWidget {
  const FeedComposer({
    super.key,
    required this.view,
    required this.calorieTarget,
    required this.errorText,
    required this.mode,
    required this.cheatIntensity,
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
    required this.textController,
    required this.onSync,
    this.relogQuery,
    required this.onSelectRelog,
    required this.onDismissRelog,
  });

  final FeedViewState view;
  final int calorieTarget;

  /// Inline error for a failed confirm (saving a meal) — not analysis errors,
  /// which surface as the failed-attempt card.
  final String? errorText;
  final MealLogMode mode;

  /// Read-only here: the mode sheet owns the writing. It rides the mode pill so
  /// the magnitude the next send will use is legible without opening anything.
  final CheatIntensity cheatIntensity;
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

  /// The composer's text, plus the relog picks tinted inside it.
  final MentionTextEditingController textController;

  /// Fired whenever the value or the caret may have moved — what drives the
  /// `/` picker.
  final VoidCallback onSync;

  /// The debounced `/` query, or null when no token is open. Relog is
  /// NORMAL-MODE ONLY: manual and cheat own the composer's slots themselves,
  /// and the server rejects cheat submissions that carry picks.
  final String? relogQuery;
  final ValueChanged<RelogCandidate> onSelectRelog;
  final VoidCallback onDismissRelog;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    listenForComposerRefill(
      ref,
      context: context,
      composer: textController,
      input: controller,
    );
    // Nothing here is derived from the controller's own state: a pick lives as
    // text INSIDE the field, so the value, its tint and the send button's arming
    // all rebuild from `MealInput`'s own listener. The dock stays out of the
    // keystroke path entirely.
    return ComposerDock(
      onHeightChanged: onHeightChanged,
      child: _buildDock(context),
    );
  }

  Widget _buildDock(BuildContext context) {
    final isNormal = mode == MealLogMode.normal;
    return Column(
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
        // Cheat mode's "log it again" chips sit above the composer, as on the
        // web. The intensity moved OUT of here: it now hangs off the mode sheet
        // that sets the mode, and reads back on the composer's mode pill.
        if (mode == MealLogMode.cheat) ...[
          CheatOccasionChips(
            userId: userId,
            disabled: stagingRepeat || analyzing,
            onSelect: onRepeatCheat,
          ),
          const SizedBox(height: LoggingSpacing.block),
        ],
        MealInput(
          controller: controller,
          textController: textController,
          onSync: onSync,
          onSubmit: onSubmit,
          onCancel: onCancel,
          analyzing: analyzing,
          popupSlot:
              isNormal && relogQuery != null
                  ? RelogPickerSection(
                    userId: userId,
                    query: relogQuery!,
                    onSelect: onSelectRelog,
                    onDismiss: onDismissRelog,
                  )
                  : null,
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
          // Only cheat carries a qualifier; every other mode is its name alone.
          modeDetail:
              mode == MealLogMode.cheat
                  ? cheatIntensityLabel(cheatIntensity)
                  : null,
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
          onBarcodePressed: isBarcodeLoggingSupported ? onBarcodePressed : null,
        ),
      ],
    );
  }
}
