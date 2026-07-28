import 'package:flutter/material.dart';

import '../../../../models/cheat.dart';
import '../../../../models/meal.dart';
import '../../data/stream_analysis_controller.dart';
import '../../logic/feed/view_state.dart';
import '../../logic/logging_spacing.dart';
import '../cheat_slider_card.dart';
import '../meal_entry.dart';
import '../terminal/failed_attempt_card.dart';
import '../streaming_entry.dart';

/// The live tail of the feed, below every saved meal: the server's staged
/// pending cards, the streaming card, the revealed (confirmable) answer, and
/// the failed attempt.
class FeedFooter extends StatelessWidget {
  const FeedFooter({
    super.key,
    required this.view,
    required this.stream,
    required this.streamingRawInput,
    required this.confirmPending,
    required this.onConfirm,
    required this.onConfirmReveal,
    required this.onConfirmCheat,
    required this.onConfirmCheatReveal,
    required this.onClarifyCheat,
    required this.revealRawInput,
    required this.failedText,
    required this.failedRetryable,
    required this.onRetry,
    required this.onDiscardFailed,
  });

  final FeedViewState view;
  final String? revealRawInput;

  /// The just-typed text of the in-flight analysis, shown on the streaming card
  /// immediately so the card carries the user's words while it analyzes.
  final String? streamingRawInput;
  final StreamAnalysisState stream;
  final bool confirmPending;
  final void Function(String analysisId, List<MealQuantityEdit> edits)
  onConfirm;
  final void Function(String analysisId, List<MealQuantityEdit> edits)
  onConfirmReveal;
  final void Function(String analysisId, CheatSliderLevels levels)
  onConfirmCheat;
  final ValueChanged<CheatSliderLevels> onConfirmCheatReveal;
  final ValueChanged<String> onClarifyCheat;
  final String? failedText;
  final bool failedRetryable;
  final VoidCallback onRetry;
  final VoidCallback onDiscardFailed;

  @override
  Widget build(BuildContext context) {
    final pendingConfirmations = view.pendingConfirmations;
    final hasFailed = failedText != null;
    // The index of the last pending entry that actually RENDERS. An entry with
    // neither a cheatSpec nor a parsedMeal draws nothing, so comparing against
    // `length - 1` would hand `isLast` to no one whenever such an entry sits
    // at the end of the list.
    final lastRendered = pendingConfirmations.lastIndexWhere(
      (p) => p.cheatSpec != null || p.parsedMeal != null,
    );
    // The footer's cards carry no margins of their own, so the stack spaces
    // them at the same block gap the card list uses above.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: LoggingSpacing.block,
      children: [
        for (var i = 0; i < pendingConfirmations.length; i++)
          if (pendingConfirmations[i].cheatSpec case final cheatSpec?)
            CheatSliderCard(
              key: ValueKey(pendingConfirmations[i].id),
              spec: cheatSpec,
              rawInput: pendingConfirmations[i].rawInput,
              busy: confirmPending,
              onConfirm:
                  (levels) =>
                      onConfirmCheat(pendingConfirmations[i].id, levels),
            )
          else if (pendingConfirmations[i].parsedMeal case final parsedMeal?)
            MealEntry(
              key: ValueKey(pendingConfirmations[i].id),
              rawInput: pendingConfirmations[i].rawInput,
              parsedMeal: parsedMeal,
              busy: confirmPending,
              isLast:
                  !view.isStreaming &&
                  !view.isRevealing &&
                  !view.isCheatRevealing &&
                  !hasFailed &&
                  i == lastRendered,
              onConfirm:
                  (edits) => onConfirm(pendingConfirmations[i].id, edits),
            ),
        if (view.isStreaming)
          StreamingEntry(
            status: stream.status,
            items: stream.items,
            completedItems: stream.completedItems,
            rawInput: streamingRawInput,
            isLast: !hasFailed,
          ),
        // The completed answer in the streaming card's slot: per-row macros
        // already real, totals count up, the spinner row swapped for
        // Edit/Confirm. This IS a remount (StreamingEntry and MealEntry are
        // different widgets) — the `revealing` flag softens the seam: the card
        // background matches the streaming card's and the item rows crossfade
        // in place instead of re-entering.
        if (view.isRevealing)
          MealEntry(
            key: ValueKey('reveal-${stream.analysisId}'),
            rawInput: revealRawInput ?? '',
            parsedMeal: stream.result!,
            busy: confirmPending,
            revealing: true,
            isLast: !hasFailed,
            onConfirm: (edits) => onConfirmReveal(stream.analysisId!, edits),
          ),
        // The cheat reveal: an interactive slider card when the estimate is
        // staged (analysisId set), or the clarifying-question card when the
        // input was too vague (no analysisId — answering re-runs the
        // estimator).
        if (view.isCheatRevealing)
          CheatSliderCard(
            key: ValueKey('cheat-reveal-${stream.analysisId ?? 'clarify'}'),
            spec: stream.cheatSpec!,
            rawInput: revealRawInput ?? '',
            busy: confirmPending,
            onConfirm: onConfirmCheatReveal,
            onClarify: onClarifyCheat,
          ),
        if (hasFailed)
          FailedAttemptCard(
            rawInput: failedText!,
            retryable: failedRetryable,
            onRetry: onRetry,
            onDiscard: onDiscardFailed,
          ),
      ],
    );
  }
}
