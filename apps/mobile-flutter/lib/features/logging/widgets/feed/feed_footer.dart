import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/cheat.dart';
import '../../../../models/meal.dart';
import '../../data/stream_analysis_controller.dart';
import '../../logic/feed/view_state.dart';
import '../../logic/logging_spacing.dart';
import '../cheat_slider_card.dart';
import '../entrances.dart';
import '../meal_entry.dart';
import '../meal_time_divider.dart';
import 'pending_confirmation_cards.dart';
import '../streaming/streaming_entry.dart';
import '../user_message_bubble.dart';
import '../terminal/failed_attempt_card.dart';

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
    required this.loaderIndex,
    required this.sentAt,
  });

  /// Which loader the in-flight analysis draws — picked once per meal by the
  /// feed, so it survives any rebuild of this footer.
  final int loaderIndex;

  /// When the user hit send. The live turn's time divider goes above the chat
  /// bubble from that moment, rather than appearing only once the card lands.
  final DateTime? sentAt;

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
    final hasFailed = failedText != null;
    // The user's own words, carried across the whole live turn: they go up the
    // instant the meal is sent and stay put while the streamed rows below them
    // are replaced by the finished card. Because the bubble survives that
    // swap, both reveal cards below are handed an EMPTY rawInput — their own
    // Lora quote would otherwise print the same sentence twice.
    final bubbleText = view.isStreaming ? streamingRawInput : revealRawInput;
    final showBubble =
        (view.isStreaming || view.isRevealing || view.isCheatRevealing) &&
        bubbleText != null &&
        bubbleText.trim().isNotEmpty;
    // The footer's cards carry no margins of their own, so the stack spaces
    // them at the same block gap the card list uses above.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: LoggingSpacing.block,
      children: [
        if (view.pendingConfirmations.isNotEmpty)
          PendingConfirmationCards(
            pending: view.pendingConfirmations,
            busy: confirmPending,
            tailIsBusy:
                view.isStreaming ||
                view.isRevealing ||
                view.isCheatRevealing ||
                hasFailed,
            onConfirm: onConfirm,
            onConfirmCheat: onConfirmCheat,
          ),
        // The live turn's header goes directly above the live turn's OWN
        // content, BELOW anything staged earlier. Emitted before the pending
        // cards it split the turn in half: send a second meal while the first
        // is unconfirmed and your new message appeared above the older meal,
        // with its own streaming rows below it. The feed has to read down in
        // the order things happened.
        if (showBubble && sentAt != null)
          MealTimeDivider(
            key: const ValueKey('turn-divider'),
            time: DateFormat.jm(context.locale.toString()).format(sentAt!),
          ),
        if (showBubble)
          // A constant key: the bubble must NOT remount when the sibling below
          // it changes type at reveal, or it would replay its entrance. The key
          // also survives the index shifting as pending cards come and go.
          _MaybeEntrance(
            key: const ValueKey('user-bubble'),
            child: UserMessageBubble(text: bubbleText),
          ),
        if (view.isStreaming)
          StreamingEntry(stream: stream, loaderIndex: loaderIndex),
        // The completed answer, closing around the rows that were already on
        // screen: per-row macros already real, totals count up, the ticker line
        // swapped for Edit/Confirm. This IS a remount (StreamingEntry and
        // MealEntry are different widgets) — the `revealing` flag softens the
        // seam by crossfading the item rows in place instead of re-entering
        // them, and both keep the same 16px content inset so nothing shifts
        // sideways as the card chrome appears.
        //
        if (view.isRevealing)
          MealEntry(
            key: ValueKey('reveal-${stream.analysisId}'),
            rawInput: revealRawInput ?? '',
            // The footer already drew the divider above the bubble.
            showTimeDivider: false,
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

/// Slides its child up on mount, unless the user has asked for less motion.
/// `entrances.dart` carries no reduce-motion seam of its own, so it is gated
/// here rather than played unconditionally.
class _MaybeEntrance extends StatelessWidget {
  const _MaybeEntrance({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return child;
    return FadeInUp(offset: 8, child: child);
  }
}
