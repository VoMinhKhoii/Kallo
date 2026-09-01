import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/logging/cheat.dart';
import '../../data/logging_providers.dart';
import '../../widgets/composer/composer_actions.dart';
import '../../widgets/composer/meal_input.dart';
import '../meal_log_mode.dart';
import 'analysis_actions.dart';
import 'analysis_run.dart';

/// The feed's cheat branch: the composer's persistent mode and its intensity,
/// plus the two ways a cheat estimate is (re)started — answering the estimator's
/// vague-input question, and "log it again" on a past occasion.
///
/// Rebuilt every frame like its [FeedConfirmActions] / [FeedMealActions]
/// siblings, so the day and the mode it acts on are always the ones on screen.
/// The one thing it must NOT capture is the repeat guard: a double tap beats
/// the rebuild, so [isStaging] reads the flag live.
class FeedCheatActions {
  const FeedCheatActions({
    required this.context,
    required this.ref,
    required this.userId,
    required this.date,
    required this.run,
    required this.input,
    required this.isStaging,
    required this.onStagingChange,
    required this.onStaged,
  });

  final BuildContext context;
  final WidgetRef ref;
  final String userId;
  final String date;

  /// The analysis machine a clarify restarts.
  final FeedAnalysisRun run;

  /// Focused again after a mode switch — the cursor belongs back in the field.
  final MealInputController input;

  /// Is a "log it again" already in flight? Read at tap time, never captured.
  final bool Function() isStaging;

  final ValueChanged<bool> onStagingChange;

  /// A repeat landed — bring its card into view.
  final VoidCallback onStaged;

  /// Normal and Cheat are the persistent modes — selecting one keeps the
  /// composer in it and puts the cursor straight back in the field.
  void setMode(MealLogMode mode) {
    ref.read(mealLogModeProvider.notifier).state = mode;
    input.focus();
  }

  /// Vague-input fallback: the estimator could not read the occasion, so re-run
  /// it on the same text with the answer the user picked attached (mirrors web
  /// `handleCheatClarify`).
  void clarify(String answer) {
    final retake = run.retakeReveal();
    if (retake == null) return;
    startMealAnalysis(
      ref,
      message: retake.text,
      date: date,
      isCheat: true,
      cheatIntensity: ref.read(cheatIntensityProvider),
      clarifyAnswer: answer,
      attemptId: retake.attemptId,
    );
  }

  /// "Log it again" — one re-stage at a time; the chips are disabled while it
  /// runs, and this guard covers a double tap that beats the rebuild.
  Future<void> repeat(RecentCheatOccasion occasion) async {
    if (isStaging()) return;
    await repeatCheatOccasion(
      context,
      ref,
      occasion: occasion,
      userId: userId,
      date: date,
      onStaged: onStaged,
      onStagingChange: onStagingChange,
    );
  }
}
