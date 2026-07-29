/// Riverpod port of the RN `useStreamAnalysis` hook
/// (`apps/mobile/src/lib/logging/hooks/use-stream-analysis.ts`).
///
/// Consumes the SSE stream from `ApiClient.analyzeMeal` (named-event frames
/// already parsed into [StreamEvent]s) and reduces it into a [StreamAnalysisState]
/// exactly as the RN reducer does: stage → status, item_name → items,
/// item_macros → upsert by run-scoped mealItemId, result → result,
/// analysis_complete → done + analysisId, error → error.
///
/// A monotonically-increasing request id invalidates handlers from a superseded
/// run (the RN `requestIdRef`); cancelling/resetting bumps it and tears down the
/// subscription (the RN `closeStream`). No auto-reconnect (`pollingInterval: 0`).
library;

import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api_client.dart';
import '../../../models/cheat.dart';
import '../../../models/meal.dart';
import '../../../models/streaming.dart';

/// Immutable streaming state — the RN `StreamAnalysisState`.
class StreamAnalysisState {
  final StreamStatus status;
  final List<String> items; // streamed dish names (item_name)
  final List<MealItem> completedItems; // dishes with macros, upserted by id
  final ParsedMeal? result;

  /// Cheat-meal slider spec (mode='cheat'); replaces [result]. A spec carrying
  /// a clarifyingQuestion is terminal with no [analysisId] — the user must
  /// re-ask with `clarifyAnswer`.
  final CheatSliderSpec? cheatSpec;
  final String? analysisId;
  final String? error;

  /// Whether the terminal [error] is worth retrying. Defaults true (matches the
  /// server contract's default and covers the inactivity-timeout error, which
  /// is always retryable). Only a server `error` frame can set it false.
  final bool retryable;
  final bool isAnalyzing;

  /// Set when the analysis failed with HTTP 402 (feature locked) — the UI
  /// routes to the paywall instead of showing a retry error.
  final bool paymentRequired;

  /// The day this run logs into (`StreamAnalyzeInput.loggedDate`). Lets the
  /// feed pin the streaming/reveal cards to their origin date, so switching
  /// the selected day doesn't render them on the wrong day's feed.
  final String? loggedDate;

  const StreamAnalysisState({
    this.status = StreamStatus.idle,
    this.items = const [],
    this.completedItems = const [],
    this.result,
    this.cheatSpec,
    this.analysisId,
    this.error,
    this.retryable = true,
    this.isAnalyzing = false,
    this.loggedDate,
    this.paymentRequired = false,
  });

  StreamAnalysisState copyWith({
    StreamStatus? status,
    List<String>? items,
    List<MealItem>? completedItems,
    ParsedMeal? result,
    CheatSliderSpec? cheatSpec,
    String? analysisId,
    String? error,
    bool? retryable,
    bool? isAnalyzing,
    String? loggedDate,
    bool? paymentRequired,
  }) => StreamAnalysisState(
    status: status ?? this.status,
    items: items ?? this.items,
    completedItems: completedItems ?? this.completedItems,
    result: result ?? this.result,
    cheatSpec: cheatSpec ?? this.cheatSpec,
    analysisId: analysisId ?? this.analysisId,
    error: error ?? this.error,
    retryable: retryable ?? this.retryable,
    isAnalyzing: isAnalyzing ?? this.isAnalyzing,
    loggedDate: loggedDate ?? this.loggedDate,
    paymentRequired: paymentRequired ?? this.paymentRequired,
  );

  static const StreamAnalysisState initial = StreamAnalysisState();
}

/// Maps a [PipelineStage] (from a `stage` event) to the matching [StreamStatus].
StreamStatus _statusForStage(PipelineStage stage) => switch (stage) {
  PipelineStage.authenticating => StreamStatus.authenticating,
  PipelineStage.decomposing => StreamStatus.decomposing,
  PipelineStage.matching => StreamStatus.matching,
  PipelineStage.estimating => StreamStatus.estimating,
  PipelineStage.assembling => StreamStatus.assembling,
};

class StreamAnalysisController extends Notifier<StreamAnalysisState> {
  StreamSubscription<StreamEvent>? _sub;
  Timer? _watchdog;
  int _requestId = 0;

  /// Set once any terminal event arrives for the current run, so the watchdog
  /// stops re-arming — a slow socket close after a successful/settled analysis
  /// must never trip a spurious timeout.
  bool _receivedTerminal = false;

  // Inactivity watchdog: if the SSE stream goes completely silent for this long
  // (no frame at all, and no terminal event yet), abort and surface a retryable
  // timeout instead of spinning forever. Reset on every frame — a slow but
  // progressing pipeline keeps emitting stage/item frames — and disarmed once
  // any terminal event arrives. Mirrors the web hook's INACTIVITY watchdog
  // (which replaced the old wall-clock timeout).
  static const Duration _inactivityTimeout = Duration(seconds: 45);

  @override
  StreamAnalysisState build() {
    ref.onDispose(_closeStream);
    return StreamAnalysisState.initial;
  }

  void _closeStream() {
    _sub?.cancel();
    _sub = null;
    _watchdog?.cancel();
    _watchdog = null;
  }

  /// (Re)start the inactivity watchdog for [reqId]. A no-op once the run is
  /// terminal — the server just needs to close the socket, and its delay must
  /// not fire a timeout over an already-settled analysis.
  void _armWatchdog(int reqId) {
    _watchdog?.cancel();
    if (_receivedTerminal) return;
    _watchdog = Timer(_inactivityTimeout, () {
      if (reqId != _requestId || _receivedTerminal) return;
      state = state.copyWith(
        status: StreamStatus.error,
        error: tr('errors.pipelineTimeout'),
        retryable: true,
        isAnalyzing: false,
      );
      _closeStream();
    });
  }

  /// Reset to idle WITHOUT bumping the request id (the RN `reset`, called after
  /// a completed/errored run is consumed). The stream is already torn down.
  void reset() {
    state = StreamAnalysisState.initial;
  }

  /// Cancel an in-flight run: invalidate handlers, tear down, reset.
  void cancel() {
    _requestId += 1;
    _closeStream();
    state = StreamAnalysisState.initial;
  }

  /// Apply one event to the state, ignoring events from a superseded run.
  void _apply(StreamEvent event, int reqId) {
    if (reqId != _requestId) return;
    switch (event) {
      case StageEvent(:final stage):
        state = state.copyWith(status: _statusForStage(stage));
      case ItemNameEvent(:final name):
        state = state.copyWith(items: [...state.items, name]);
      case ItemMacrosEvent(:final mealItemId, :final item):
        // Upsert by run-scoped mealItemId — a retry re-emits the same slot.
        final next = item.copyWith(id: mealItemId);
        final idx = state.completedItems.indexWhere((i) => i.id == mealItemId);
        if (idx >= 0) {
          final updated = [...state.completedItems];
          updated[idx] = next;
          state = state.copyWith(completedItems: updated);
        } else {
          state = state.copyWith(
            completedItems: [...state.completedItems, next],
          );
        }
      case ResultEvent(:final data):
        state = state.copyWith(result: data);
      case CheatEstimateEvent(:final spec):
        // A clarifying-question spec ends the stream with no analysis_complete
        // (the client must re-ask with clarifyAnswer), so settle here. A full
        // spec keeps streaming until analysis_complete. Mirrors the web hook.
        if (spec.clarifyingQuestion != null) {
          state = state.copyWith(
            cheatSpec: spec,
            status: StreamStatus.done,
            isAnalyzing: false,
          );
        } else {
          state = state.copyWith(cheatSpec: spec);
        }
      case AnalysisCompleteEvent(:final analysisId):
        state = state.copyWith(
          status: StreamStatus.done,
          analysisId: analysisId,
          isAnalyzing: false,
        );
      case StreamErrorEvent(:final message, :final retryable):
        state = state.copyWith(
          status: StreamStatus.error,
          error: message,
          retryable: retryable,
          isAnalyzing: false,
          // 402 (feature locked, post Phase E) → route to the paywall instead
          // of the retry-error card. Flagged here; the feed reads it on error.
          paymentRequired: event.isPaymentRequired,
        );
    }
  }

  /// Open a fresh analysis stream. Mirrors the RN `analyze`: tears down any
  /// prior stream, bumps the request id, seeds `connecting`, then routes frames.
  Future<void> analyze(StreamAnalyzeInput input) async {
    _closeStream();
    final reqId = ++_requestId;
    _receivedTerminal = false;
    state = StreamAnalysisState(
      status: StreamStatus.connecting,
      isAnalyzing: true,
      loggedDate: input.loggedDate,
    );

    final api = ref.read(apiClientProvider);
    _sub = api
        .analyzeMeal(input)
        .listen(
          (event) {
            _apply(event, reqId);
            // Terminal frames end the run: analysis_complete, error, or a
            // cheat_estimate carrying a clarifyingQuestion (which ends the
            // stream WITHOUT analysis_complete). The rule is the single
            // `StreamEvent.isTerminal` predicate. Mark terminal and tear down —
            // this also disarms the inactivity watchdog.
            if (event.isTerminal) {
              _receivedTerminal = true;
              _closeStream();
            } else {
              // Progress frame — reset the inactivity watchdog.
              _armWatchdog(reqId);
            }
          },
          onError: (_) {
            if (reqId != _requestId) return;
            if (state.status == StreamStatus.done) return;
            state = state.copyWith(
              status: StreamStatus.error,
              error: tr('errors.internal'),
              retryable: true,
              isAnalyzing: false,
            );
            _closeStream();
          },
          onDone: () {
            if (reqId != _requestId || _receivedTerminal) return;
            // The transport closed without ever delivering a terminal frame:
            // the server hung up early, or it ended the run with a frame this
            // client doesn't model (a `clarify` ask-back, say — deliberately
            // unparsed, so `flush()` drops it). Nothing is staged and nothing
            // more is coming, so settle IMMEDIATELY as a retryable failure
            // rather than leaving the UI spinning until the 45s inactivity
            // watchdog fires.
            state = state.copyWith(
              status: StreamStatus.error,
              error: tr('errors.internal'),
              retryable: true,
              isAnalyzing: false,
            );
            _closeStream();
          },
          cancelOnError: true,
        );

    // Arm the inactivity watchdog for the initial connect — a stalled pipeline
    // that never emits a frame surfaces a retryable timeout instead of leaving
    // the UI spinning with the input disabled.
    _armWatchdog(reqId);
  }
}

final streamAnalysisProvider =
    NotifierProvider<StreamAnalysisController, StreamAnalysisState>(
      StreamAnalysisController.new,
    );
