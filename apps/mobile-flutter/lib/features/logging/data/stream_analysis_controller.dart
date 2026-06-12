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
import '../../../models/meal.dart';
import '../../../models/streaming.dart';

/// Immutable streaming state — the RN `StreamAnalysisState`.
class StreamAnalysisState {
  final StreamStatus status;
  final List<String> items; // streamed dish names (item_name)
  final List<MealItem> completedItems; // dishes with macros, upserted by id
  final ParsedMeal? result;
  final String? analysisId;
  final String? error;
  final bool isAnalyzing;

  /// The day this run logs into (`StreamAnalyzeInput.loggedDate`). Lets the
  /// feed pin the streaming/reveal cards to their origin date, so switching
  /// the selected day doesn't render them on the wrong day's feed.
  final String? loggedDate;

  const StreamAnalysisState({
    this.status = StreamStatus.idle,
    this.items = const [],
    this.completedItems = const [],
    this.result,
    this.analysisId,
    this.error,
    this.isAnalyzing = false,
    this.loggedDate,
  });

  StreamAnalysisState copyWith({
    StreamStatus? status,
    List<String>? items,
    List<MealItem>? completedItems,
    ParsedMeal? result,
    String? analysisId,
    String? error,
    bool? isAnalyzing,
    String? loggedDate,
  }) => StreamAnalysisState(
    status: status ?? this.status,
    items: items ?? this.items,
    completedItems: completedItems ?? this.completedItems,
    result: result ?? this.result,
    analysisId: analysisId ?? this.analysisId,
    error: error ?? this.error,
    isAnalyzing: isAnalyzing ?? this.isAnalyzing,
    loggedDate: loggedDate ?? this.loggedDate,
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
  Timer? _timeout;
  int _requestId = 0;

  // Server caps analyze at 60s (maxDuration); time the client out a bit past
  // that so a stalled pipeline surfaces an error instead of spinning forever.
  static const Duration _analyzeTimeout = Duration(seconds: 70);

  @override
  StreamAnalysisState build() {
    ref.onDispose(_closeStream);
    return StreamAnalysisState.initial;
  }

  void _closeStream() {
    _sub?.cancel();
    _sub = null;
    _timeout?.cancel();
    _timeout = null;
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
      case AnalysisCompleteEvent(:final analysisId):
        state = state.copyWith(
          status: StreamStatus.done,
          analysisId: analysisId,
          isAnalyzing: false,
        );
      case StreamErrorEvent(:final message):
        state = state.copyWith(
          status: StreamStatus.error,
          error: message,
          isAnalyzing: false,
        );
    }
  }

  /// Open a fresh analysis stream. Mirrors the RN `analyze`: tears down any
  /// prior stream, bumps the request id, seeds `connecting`, then routes frames.
  Future<void> analyze(StreamAnalyzeInput input) async {
    _closeStream();
    final reqId = ++_requestId;
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
            if (event is AnalysisCompleteEvent || event is StreamErrorEvent) {
              _closeStream();
            }
          },
          onError: (_) {
            if (reqId != _requestId) return;
            if (state.status == StreamStatus.done) return;
            state = state.copyWith(
              status: StreamStatus.error,
              error: tr('errors.internal'),
              isAnalyzing: false,
            );
            _closeStream();
          },
          cancelOnError: true,
        );

    // Wall-clock guard: a stalled pipeline that never emits analysis_complete /
    // error would otherwise leave the UI spinning with the input disabled.
    _timeout = Timer(_analyzeTimeout, () {
      if (reqId != _requestId || state.status == StreamStatus.done) return;
      state = state.copyWith(
        status: StreamStatus.error,
        error: tr('errors.pipelineTimeout'),
        isAnalyzing: false,
      );
      _closeStream();
    });
  }
}

final streamAnalysisProvider =
    NotifierProvider<StreamAnalysisController, StreamAnalysisState>(
      StreamAnalysisController.new,
    );
