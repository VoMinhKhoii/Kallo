import 'dart:async' show unawaited;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../data/api_client.dart';
import '../../../../models/cheat.dart';
import '../../../../models/streaming.dart';
import '../../data/logging_keys.dart';
import '../../data/logging_providers.dart';
import '../../data/stream_analysis_controller.dart';

/// Hand the typed meal to the analyze stream. Shared by a fresh submit, a retry
/// of a failed attempt, and a cheat-clarify resubmit — they differ only in the
/// [attemptId] they carry and whether an answer to a clarifying question rides
/// along.
void startMealAnalysis(
  WidgetRef ref, {
  required String message,
  required String date,
  required bool isCheat,
  required CheatIntensity cheatIntensity,
  String? clarifyAnswer,
  String? attemptId,
}) {
  ref
      .read(streamAnalysisProvider.notifier)
      .analyze(
        StreamAnalyzeInput(
          message: message,
          loggedDate: date,
          timezoneOffset: timezoneOffsetMinutes(),
          mode: isCheat ? 'cheat' : null,
          cheatIntensity: isCheat ? cheatIntensity.name : null,
          clarifyAnswer: clarifyAnswer,
          attemptId: attemptId,
        ),
      );
}

/// The two moments the analyze stream hands control back to the feed.
///
/// On completion: hold the stream alive and let the streaming card morph in
/// place into a confirmable answer (the reveal — per-row macros already real,
/// totals count up, spinner row swaps for Edit/Confirm). One light impact marks
/// the moment the answer lands; nothing unmounts. The refetch + reset happens
/// only once the user confirms.
/// The cheat clarify terminal reaches done with a cheatSpec but NO analysisId
/// (nothing is staged for a vague input) — it still reveals as a card, so it
/// takes the same transition.
///
/// On error: never destroy the typed meal. [onFailed] restores the raw text
/// into the composer AND renders the failed attempt as a feed card (Try again).
void onStreamTransition(
  StreamAnalysisState? prev,
  StreamAnalysisState next, {
  required VoidCallback onRevealed,
  required ValueChanged<bool> onFailed,
}) {
  if (next.status == StreamStatus.done &&
      (next.analysisId != null || next.cheatSpec != null) &&
      prev?.status != StreamStatus.done) {
    onRevealed();
  }
  if (next.status == StreamStatus.error) {
    onFailed(next.retryable);
  }
}

/// A second submit while an unconfirmed reveal is showing must not vaporize the
/// first answer: that analysis is already stored server-side as pending, so
/// refresh its origin day — it resurfaces as a pending-confirmation card.
void refreshRevealedAnalysisDay(
  WidgetRef ref, {
  required String userId,
  required String fallbackDate,
}) {
  final prior = ref.read(streamAnalysisProvider);
  if (prior.status == StreamStatus.done && prior.analysisId != null) {
    final originDate = prior.loggedDate ?? fallbackDate;
    unawaited(
      ref
          .read(loggingDayProvider(LoggingDayArgs(userId, originDate)).notifier)
          .refresh(),
    );
  }
}
