import 'dart:async' show unawaited;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/logging_providers.dart';
import '../../widgets/relog/mention_text_controller.dart';
import '../feed/analysis_run.dart';
import '../meal_log_mode.dart';
import 'composer_submit_plan.dart';
import 'pure_relog_staging.dart';

/// The composer's unified submit: [planComposerSubmit] decides which of the
/// three shapes a submit is, this runs it. One handler covers all three, so a
/// single submit always produces exactly one review card:
///
///  - text only, no picks      → the ordinary AI analysis.
///  - picks only, no free text → stage a deterministic relog analysis and
///                               surface its review card (no AI, no spend).
///  - free text AND picks      → analyze the text alone and send the picks as
///                               `refs`; the server merges the copied dishes
///                               in, so relogged items are never re-analyzed.
class ComposerSubmitter {
  ComposerSubmitter({
    required this.composer,
    required this.run,
    required this.onChanged,
    required this.onStaged,
  });

  /// The composer's text AND the relog picks living inside it — what a submit
  /// is planned from, and what a pure relog clears when its stage lands.
  final MentionTextEditingController composer;

  /// The analysis machine the two AI-bearing shapes start.
  final FeedAnalysisRun run;

  /// Something the feed renders changed — rebuild.
  final VoidCallback onChanged;

  /// A pure relog staged — bring its card into view.
  final VoidCallback onStaged;

  /// True while a pure-relog submit is staging server-side. Read live at submit
  /// time, never captured: the guard exists for the double tap that beats the
  /// rebuild.
  bool _staging = false;

  /// The attempt ids those pure-relog submits stage under.
  final RelogAttemptLedger _attempts = RelogAttemptLedger();

  void submit(
    BuildContext context,
    WidgetRef ref, {
    required String userId,
    required String date,
    required String text,
  }) {
    final plan = planComposerSubmit(
      isNormal: ref.read(mealLogModeProvider) == MealLogMode.normal,
      staged: composer.entries,
      text: text,
      freeText: composer.freeText,
    );
    switch (plan) {
      case PlainAnalysis(:final text):
        run.startPlain(ref, userId: userId, date: date, text: text);
      case PureRelog(:final refs, :final stageIds):
        if (_staging) return;
        unawaited(
          stagePureRelog(
            context,
            ref,
            ledger: _attempts,
            composer: composer,
            userId: userId,
            date: date,
            refs: refs,
            stageIds: stageIds,
            onStaged: onStaged,
            onStagingChange: (staging) {
              _staging = staging;
              onChanged();
            },
          ),
        );
      case CombinedAnalysis(:final freeText, :final refs, :final pickNames):
        run.startCombined(
          ref,
          userId: userId,
          date: date,
          freeText: freeText,
          refs: refs,
          pickNames: pickNames,
        );
    }
  }
}
