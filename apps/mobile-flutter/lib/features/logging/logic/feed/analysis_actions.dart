import 'dart:async' show unawaited;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../data/api_client.dart';
import '../../../../models/cheat.dart';
import '../../../../models/relog.dart';
import '../../../../models/streaming.dart';
import '../../data/logging_keys.dart';
import '../../data/logging_providers.dart';
import '../../data/stream_analysis_controller.dart';

/// Hand the typed meal to the analyze stream. Shared by a fresh submit, a retry
/// of a failed attempt, and a cheat-clarify resubmit — they differ only in the
/// [attemptId] they carry and whether an answer to a clarifying question rides
/// along.
///
/// [refs] carries relog picks made alongside free text. The server analyzes
/// [message] alone and merges the picks deterministically afterwards, so a
/// relogged dish is copied verbatim rather than re-estimated. Relog is
/// normal-mode only — the server REJECTS cheat+refs rather than silently
/// dropping the picks — so they are dropped here when [isCheat] is set, which
/// keeps a stale draft from turning a cheat estimate into a 400.
void startMealAnalysis(
  WidgetRef ref, {
  required String message,
  required String date,
  required bool isCheat,
  required CheatIntensity cheatIntensity,
  String? clarifyAnswer,
  String? attemptId,
  List<RelogRef>? refs,
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
          refs: isCheat ? null : refs,
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

/// Pull the staged row for a revealed analysis into the day cache.
///
/// A revealed answer is drawn from CLIENT state (`streamAnalysisProvider`),
/// but the server has already staged it as a pending analysis. Until the day is
/// refreshed, that row exists only on the server, and anything that clears the
/// stream — a hot reload, which makes Riverpod re-run `Notifier.build()`, or a
/// relaunch — leaves nothing on screen: the reveal is gone and the cached day
/// predates the staging. The unsaved meal simply vanished.
///
/// Refreshing here means the card is backed by server state from the moment it
/// appears, so it survives all of that. [FeedViewState] hides the pending row
/// while the reveal is still up, so the two never render as one meal twice.
///
/// Also covers a second submit while a reveal is showing: that answer is
/// already staged, so it resurfaces as a pending-confirmation card rather than
/// being vaporized by the new run.
void refreshStagedAnalysisDay(
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
