/// SSE streaming event models.
///
/// Ported from `lib/ai/streaming/types.ts`.
library;

import 'cheat.dart';
import 'meal.dart';

/// Pipeline stages emitted as progress updates.
enum PipelineStage {
  authenticating,
  decomposing,
  matching,
  estimating,
  assembling,
}

/// Union of all SSE event types.
sealed class StreamEvent {
  const StreamEvent();

  factory StreamEvent.fromJson(Map<String, dynamic> json) {
    final type = json['type'] as String;
    return switch (type) {
      'stage' => StageEvent.fromJson(json),
      'item_name' => ItemNameEvent.fromJson(json),
      'item_macros' => ItemMacrosEvent.fromJson(json),
      'result' => ResultEvent.fromJson(json),
      'cheat_estimate' => CheatEstimateEvent.fromJson(json),
      'analysis_complete' => AnalysisCompleteEvent.fromJson(json),
      'error' => StreamErrorEvent.fromJson(json),
      _ => throw ArgumentError('Unknown StreamEvent type: $type'),
    };
  }

  /// Whether this frame ends the analysis stream. The single source of truth for
  /// the "terminal frame" rule, consumed by BOTH the SSE generator
  /// (`api_client.analyzeMeal`) and the stream controller
  /// (`stream_analysis_controller`) so the two can never drift apart.
  ///
  /// Terminal frames:
  ///  - [AnalysisCompleteEvent] — the durable, confirmable result.
  ///  - [StreamErrorEvent] — a fatal error.
  ///  - [CheatEstimateEvent] ONLY when it carries a `clarifyingQuestion` — the
  ///    same re-ask round-trip. A plain cheat spec is confirmable, so the stream
  ///    continues on to analysis_complete.
  ///
  /// Everything else (stage / item_name / item_macros / result) is a progress
  /// frame and returns false.
  ///
  /// Folding the cheat-clarify case in here means the api_client generator now
  /// RETURNS on a cheat-clarify frame instead of waiting for the server to close
  /// the stream. That alignment is intended and safe: the controller already
  /// tears down on that frame, and the server closes the stream immediately
  /// after emitting it anyway.
  bool get isTerminal => false;
}

/// Progress update -- which pipeline stage is active.
class StageEvent extends StreamEvent {
  final PipelineStage stage;
  final String? message;

  const StageEvent({required this.stage, this.message});

  factory StageEvent.fromJson(Map<String, dynamic> json) => StageEvent(
    stage: PipelineStage.values.byName(json['stage'] as String),
    message: json['message'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'type': 'stage',
    'stage': stage.name,
    'message': message,
  };
}

/// Single meal item name discovered during decomposition streaming.
class ItemNameEvent extends StreamEvent {
  final String name;
  final int index;
  final String mealItemId;

  const ItemNameEvent({
    required this.name,
    required this.index,
    required this.mealItemId,
  });

  factory ItemNameEvent.fromJson(Map<String, dynamic> json) => ItemNameEvent(
    name: json['name'] as String,
    index: json['index'] as int,
    mealItemId: json['mealItemId'] as String,
  );

  Map<String, dynamic> toJson() => {
    'type': 'item_name',
    'name': name,
    'index': index,
    'mealItemId': mealItemId,
  };
}

/// Single meal item with macros estimated during nutrition streaming.
class ItemMacrosEvent extends StreamEvent {
  final String mealItemId;
  final MealItem item;

  const ItemMacrosEvent({required this.mealItemId, required this.item});

  factory ItemMacrosEvent.fromJson(Map<String, dynamic> json) =>
      ItemMacrosEvent(
        mealItemId: json['mealItemId'] as String,
        item: MealItem.fromJson(json['item'] as Map<String, dynamic>),
      );

  Map<String, dynamic> toJson() => {
    'type': 'item_macros',
    'mealItemId': mealItemId,
    'item': item.toJson(),
  };
}

/// Final display-optimized result for the client.
class ResultEvent extends StreamEvent {
  final ParsedMeal data;

  const ResultEvent({required this.data});

  factory ResultEvent.fromJson(Map<String, dynamic> json) => ResultEvent(
    data: ParsedMeal.fromJson(json['data'] as Map<String, dynamic>),
  );

  Map<String, dynamic> toJson() => {'type': 'result', 'data': data.toJson()};
}

/// Cheat-meal slider spec (mode='cheat'); replaces `result`. When the spec
/// carries a clarifyingQuestion the stream ends WITHOUT analysis_complete —
/// the client must re-ask with `clarifyAnswer`.
class CheatEstimateEvent extends StreamEvent {
  final CheatSliderSpec spec;

  const CheatEstimateEvent({required this.spec});

  factory CheatEstimateEvent.fromJson(Map<String, dynamic> json) =>
      CheatEstimateEvent(
        spec: CheatSliderSpec.fromJson(json['spec'] as Map<String, dynamic>),
      );

  Map<String, dynamic> toJson() => {
    'type': 'cheat_estimate',
    'spec': spec.toJson(),
  };

  /// Terminal only when the spec carries a clarifying question — then the stream
  /// ends WITHOUT analysis_complete and the client re-asks. A plain spec is
  /// confirmable and the stream continues.
  @override
  bool get isTerminal => spec.clarifyingQuestion != null;
}

/// Analysis stored durably -- safe to confirm and persist.
class AnalysisCompleteEvent extends StreamEvent {
  final String analysisId;

  const AnalysisCompleteEvent({required this.analysisId});

  factory AnalysisCompleteEvent.fromJson(Map<String, dynamic> json) =>
      AnalysisCompleteEvent(analysisId: json['analysisId'] as String);

  Map<String, dynamic> toJson() => {
    'type': 'analysis_complete',
    'analysisId': analysisId,
  };

  @override
  bool get isTerminal => true;
}

/// Error during streaming -- terminal event.
class StreamErrorEvent extends StreamEvent {
  final String code;
  final String message;
  final bool retryable;

  /// HTTP status when this error came from a non-2xx SSE response.
  final int? status;

  const StreamErrorEvent({
    required this.code,
    required this.message,
    required this.retryable,
    this.status,
  });

  factory StreamErrorEvent.fromJson(Map<String, dynamic> json) =>
      StreamErrorEvent(
        code: json['code'] as String,
        message: json['message'] as String,
        retryable: json['retryable'] as bool,
        status: json['status'] is int ? json['status'] as int : null,
      );

  bool get isPaymentRequired => status == 402;

  Map<String, dynamic> toJson() => {
    'type': 'error',
    'code': code,
    'message': message,
    'retryable': retryable,
    if (status != null) 'status': status,
  };

  @override
  bool get isTerminal => true;
}

/// Client-side stream status.
enum StreamStatus {
  idle,
  connecting,
  authenticating,
  decomposing,
  matching,
  estimating,
  assembling,
  done,
  error,
}
